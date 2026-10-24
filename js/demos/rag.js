/* RAG Document Q&A — real TF-IDF retrieval over a mini knowledge base, in-browser. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  const CORPUS = [
    { title: "Refund Policy", text: "Customers can request a full refund within 30 days of purchase. Refunds are processed back to the original payment method within 5 business days. After 30 days, only store credit is offered." },
    { title: "Shipping Guide", text: "Standard shipping takes 3 to 5 business days. Express shipping delivers within 24 hours for an extra fee. International orders may take up to 14 days and can incur customs charges." },
    { title: "Account Security", text: "Enable two factor authentication to protect your account. If you forget your password, use the reset link sent to your registered email. We never ask for your password over the phone." },
    { title: "Subscription Plans", text: "The Pro plan costs 12 dollars per month and includes unlimited projects. The free tier allows 3 projects. Annual billing gives a 20 percent discount on every plan." },
    { title: "Data Privacy", text: "We encrypt all user data at rest and in transit. Personal data is never sold to third parties. You can request deletion of your data at any time from the settings page." },
    { title: "Returns Process", text: "To return an item, print the prepaid label from your orders page and drop the package at any courier point. Returns are inspected within 2 days of arrival before the refund is approved." },
  ];

  const STOP = new Set(["the", "a", "an", "is", "are", "to", "of", "and", "or", "in", "on", "for", "at", "any", "your", "we", "you", "can", "be", "may", "it", "from", "with", "over", "within", "all"]);

  function tokenize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
  }

  // Build TF-IDF index once
  const docsTokens = CORPUS.map((d) => tokenize(d.title + " " + d.text));
  const df = {};
  docsTokens.forEach((toks) => new Set(toks).forEach((t) => (df[t] = (df[t] || 0) + 1)));
  const N = CORPUS.length;
  const idf = (t) => Math.log((N + 1) / ((df[t] || 0) + 1)) + 1;

  function vectorize(tokens) {
    const tf = {};
    tokens.forEach((t) => (tf[t] = (tf[t] || 0) + 1));
    const v = {};
    let norm = 0;
    for (const t in tf) {
      const w = (tf[t] / tokens.length) * idf(t);
      v[t] = w;
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const t in v) v[t] /= norm;
    return v;
  }
  const docVecs = docsTokens.map(vectorize);

  function cosine(a, b) {
    let s = 0;
    for (const t in a) if (b[t]) s += a[t] * b[t];
    return s;
  }

  function answerFrom(doc, query) {
    const qTok = new Set(tokenize(query));
    const sentences = doc.text.split(/(?<=\.)\s+/);
    let best = sentences[0], bestScore = -1;
    for (const s of sentences) {
      const overlap = tokenize(s).filter((t) => qTok.has(t)).length;
      if (overlap > bestScore) { bestScore = overlap; best = s; }
    }
    return best.trim();
  }

  const EXAMPLES = [
    "How long do refunds take?",
    "Is my data sold to anyone?",
    "How much is the pro plan?",
    "I forgot my password",
  ];

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc">A miniature RAG pipeline running <strong>entirely in your browser</strong>: your question is embedded as a TF-IDF vector, scored against every document by cosine similarity, and the best passage grounds the answer. Try it:</p>
      <div class="demo-row">
        <input class="demo-input" id="rag-q" placeholder="Ask a question about the knowledge base…" />
        <button class="btn" id="rag-go">Retrieve →</button>
      </div>
      <div class="pill-btns" id="rag-examples" style="margin-bottom:1.2rem"></div>
      <div id="rag-answer"></div>
      <div class="demo-panel">
        <h4>Retrieved documents (cosine similarity)</h4>
        <div id="rag-results"><p class="demo-desc" style="margin:0">Ask something to see ranked retrieval scores.</p></div>
      </div>`;

    const input = root.querySelector("#rag-q");
    const results = root.querySelector("#rag-results");
    const answerBox = root.querySelector("#rag-answer");
    const exWrap = root.querySelector("#rag-examples");

    EXAMPLES.forEach((ex) => {
      const b = document.createElement("button");
      b.className = "pill";
      b.textContent = ex;
      b.addEventListener("click", () => { input.value = ex; run(); });
      exWrap.appendChild(b);
    });

    function run() {
      const q = input.value.trim();
      if (!q) return;
      const qVec = vectorize(tokenize(q));
      const scored = CORPUS.map((d, i) => ({ ...d, score: cosine(qVec, docVecs[i]) }))
        .sort((a, b) => b.score - a.score);
      const max = scored[0].score || 1;

      results.innerHTML = scored.map((d, i) => `
        <div class="result-doc ${i === 0 && d.score > 0 ? "top" : ""}">
          <div class="doc-title"><span>${i === 0 && d.score > 0 ? "🥇 " : ""}${d.title}</span>
            <span class="doc-score">cos θ = ${d.score.toFixed(3)}</span></div>
          <div class="doc-text">${d.text.slice(0, 110)}…</div>
          <div class="score-bar"><div class="score-fill" style="width:0%"></div></div>
        </div>`).join("");

      requestAnimationFrame(() => {
        results.querySelectorAll(".score-fill").forEach((el, i) => {
          el.style.width = `${(scored[i].score / max) * 100}%`;
        });
      });

      if (scored[0].score > 0.05) {
        answerBox.innerHTML = `<div class="answer-box" style="margin-bottom:1rem">
          <span class="label">🤖 Grounded answer (from "${scored[0].title}")</span>
          ${answerFrom(scored[0], q)}</div>`;
      } else {
        answerBox.innerHTML = `<div class="answer-box" style="margin-bottom:1rem">
          <span class="label">🤖 Grounded answer</span>
          I couldn't find anything relevant in the knowledge base — this is exactly how RAG avoids hallucination: no evidence, no made-up answer.</div>`;
      }
    }

    root.querySelector("#rag-go").addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }

  const theoryHTML = `
    <div class="theory">
      <h3>What is Retrieval-Augmented Generation?</h3>
      <p>LLMs hallucinate because they answer from frozen parametric memory. RAG fixes this by <strong>retrieving relevant documents at query time</strong> and conditioning the generation on them: <code>retrieve → augment prompt → generate</code>.</p>

      <h3>Step 1 — Embedding text as vectors</h3>
      <p>Each document \\(d\\) and query \\(q\\) is mapped to a vector. This demo uses TF-IDF; production systems use learned dense embeddings (e.g. <code>text-embedding-3</code>, sentence-transformers). TF-IDF weights a term \\(t\\) by how frequent it is in the document and how rare it is in the corpus:</p>
      $$ w_{t,d} = \\underbrace{\\frac{f_{t,d}}{|d|}}_{\\text{term frequency}} \\cdot \\underbrace{\\log\\frac{N+1}{n_t+1} + 1}_{\\text{inverse document frequency}} $$
      <p>where \\(N\\) is the corpus size and \\(n_t\\) the number of documents containing \\(t\\).</p>

      <h3>Step 2 — Scoring by cosine similarity</h3>
      <p>Relevance is the angle between query and document vectors — invariant to document length:</p>
      $$ \\text{sim}(q, d) = \\cos\\theta = \\frac{q \\cdot d}{\\lVert q \\rVert \\, \\lVert d \\rVert} = \\frac{\\sum_i q_i d_i}{\\sqrt{\\sum_i q_i^2}\\sqrt{\\sum_i d_i^2}} $$
      <p>With unit-normalized vectors this reduces to a dot product, which vector databases (FAISS, Pinecone, pgvector) accelerate with approximate nearest-neighbour indexes like HNSW.</p>

      <h3>Step 3 — Grounded generation</h3>
      <p>The top-\\(k\\) chunks are injected into the LLM prompt. Formally, RAG models the answer distribution by marginalising over retrieved documents:</p>
      $$ p(y \\mid x) = \\sum_{d \\in \\text{top-}k} \\; \\underbrace{p_\\eta(d \\mid x)}_{\\text{retriever}} \\; \\underbrace{p_\\theta(y \\mid x, d)}_{\\text{generator}} $$

      <div class="callout">💡 <strong>Why employers care:</strong> RAG is the #1 production GenAI pattern — it grounds answers in private data, slashes hallucination, and keeps knowledge fresh without retraining the model.</div>

      <h3>Production stack I'd use</h3>
      <ul>
        <li><strong>Chunking:</strong> semantic splitting with overlap (~512 tokens)</li>
        <li><strong>Embeddings + store:</strong> sentence-transformers → FAISS / pgvector</li>
        <li><strong>Reranking:</strong> cross-encoder over top-50 → top-5</li>
        <li><strong>Evaluation:</strong> faithfulness &amp; answer-relevance metrics (RAGAS)</li>
      </ul>
    </div>`;

  window.DEMOS.rag = { title: "🔍 RAG Document Q&A Engine", renderDemo, theoryHTML };
})();
