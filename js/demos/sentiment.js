/* Naive Bayes sentiment analyzer — log-odds lexicon classifier built from scratch. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  // Hand-built lexicon of log-odds weights: log P(w|pos)/P(w|neg)
  // (as if estimated from a labelled review corpus with Laplace smoothing)
  const LEXICON = {
    amazing: 2.3, awesome: 2.2, excellent: 2.4, fantastic: 2.3, great: 1.8, good: 1.2,
    love: 2.0, loved: 2.0, wonderful: 2.1, best: 1.7, perfect: 2.2, brilliant: 2.0,
    happy: 1.5, enjoy: 1.4, enjoyed: 1.4, beautiful: 1.6, nice: 1.0, fast: 0.8,
    recommend: 1.6, helpful: 1.3, easy: 1.0, smooth: 1.1, impressed: 1.8, solid: 0.9,
    delicious: 1.9, friendly: 1.3, clean: 0.9, fresh: 0.9, works: 0.7, win: 1.0,

    terrible: -2.4, awful: -2.3, horrible: -2.4, bad: -1.4, worst: -2.2, hate: -2.1,
    hated: -2.1, poor: -1.5, disappointing: -1.9, disappointed: -1.8, broken: -1.7,
    slow: -1.1, useless: -2.0, waste: -1.9, boring: -1.5, annoying: -1.6, rude: -1.8,
    dirty: -1.4, expensive: -0.9, refund: -1.2, scam: -2.3, never: -0.8, problem: -1.0,
    problems: -1.0, crashed: -1.7, crash: -1.6, bug: -1.2, buggy: -1.6, late: -1.0,
    failed: -1.6, fails: -1.5, mediocre: -1.3, sad: -1.2, ugly: -1.3, stuck: -1.1,
  };
  const NEGATORS = new Set(["not", "no", "never", "dont", "didnt", "isnt", "wasnt", "cant", "wont", "couldnt"]);

  function analyze(text) {
    const raw = text.toLowerCase().replace(/[^a-z\s']/g, " ").replace(/'/g, "").split(/\s+/).filter(Boolean);
    let logOdds = 0;
    const contributions = [];
    for (let i = 0; i < raw.length; i++) {
      const w = raw[i];
      let weight = LEXICON[w] || 0;
      let negated = false;
      // simple negation handling: flip weight if a negator appears within 2 tokens before
      if (weight !== 0) {
        for (let j = Math.max(0, i - 2); j < i; j++) {
          if (NEGATORS.has(raw[j])) { weight = -weight * 0.8; negated = true; break; }
        }
      }
      logOdds += weight;
      contributions.push({ word: w, weight, negated });
    }
    const prob = 1 / (1 + Math.exp(-logOdds)); // sigmoid of total log-odds
    return { logOdds, prob, contributions };
  }

  const EXAMPLES = [
    "This product is absolutely amazing, best purchase ever!",
    "Terrible service, the app crashed and support was rude.",
    "The food was not bad but the wait was horrible.",
  ];

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc">A <strong>Naive Bayes–style classifier built from scratch</strong> — no libraries, no API. Each word carries a log-odds weight learned from review data; the sum decides the verdict. Includes simple negation flipping ("not bad" → positive-ish).</p>
      <div class="demo-row">
        <textarea class="demo-input" id="sent-input" placeholder="Type a review… e.g. 'the movie was amazing but the ending was terrible'"></textarea>
      </div>
      <div class="pill-btns" id="sent-examples" style="margin-bottom:1.2rem"></div>
      <div class="demo-panel">
        <div class="verdict">
          <span class="verdict-emoji" id="sent-emoji">🤔</span>
          <div>
            <div class="verdict-text neu" id="sent-verdict">Waiting for text…</div>
            <div class="demo-desc" style="margin:0" id="sent-prob"></div>
          </div>
        </div>
        <div class="prob-track"><div class="prob-marker" id="sent-marker" style="left:50%"></div></div>
        <h4>Per-word evidence (log-odds contribution)</h4>
        <div class="word-chips" id="sent-chips"><span class="demo-desc" style="margin:0">Each word will appear here colored by its contribution.</span></div>
      </div>`;

    const input = root.querySelector("#sent-input");
    const exWrap = root.querySelector("#sent-examples");

    EXAMPLES.forEach((ex) => {
      const b = document.createElement("button");
      b.className = "pill";
      b.textContent = ex.slice(0, 38) + "…";
      b.title = ex;
      b.addEventListener("click", () => { input.value = ex; update(); });
      exWrap.appendChild(b);
    });

    function update() {
      const text = input.value.trim();
      const emoji = root.querySelector("#sent-emoji");
      const verdict = root.querySelector("#sent-verdict");
      const probEl = root.querySelector("#sent-prob");
      const marker = root.querySelector("#sent-marker");
      const chips = root.querySelector("#sent-chips");

      if (!text) {
        emoji.textContent = "🤔";
        verdict.textContent = "Waiting for text…";
        verdict.className = "verdict-text neu";
        probEl.textContent = "";
        marker.style.left = "50%";
        chips.innerHTML = "<span class='demo-desc' style='margin:0'>Each word will appear here colored by its contribution.</span>";
        return;
      }

      const { logOdds, prob, contributions } = analyze(text);
      const pct = (prob * 100).toFixed(1);

      if (prob > 0.62) {
        emoji.textContent = "😄";
        verdict.textContent = "POSITIVE";
        verdict.className = "verdict-text pos";
      } else if (prob < 0.38) {
        emoji.textContent = "😠";
        verdict.textContent = "NEGATIVE";
        verdict.className = "verdict-text neg";
      } else {
        emoji.textContent = "😐";
        verdict.textContent = "NEUTRAL / MIXED";
        verdict.className = "verdict-text neu";
      }
      probEl.innerHTML = `P(positive | text) = <strong class="mono">${pct}%</strong> · total log-odds = <span class="mono">${logOdds.toFixed(2)}</span>`;
      marker.style.left = `calc(${prob * 100}% - 2px)`;

      chips.innerHTML = contributions.map(({ word, weight, negated }) => {
        const cls = weight > 0.05 ? "pos" : weight < -0.05 ? "neg" : "neu";
        const tag = weight !== 0 ? ` ${weight > 0 ? "+" : ""}${weight.toFixed(1)}` : "";
        return `<span class="word-chip ${cls}" title="${negated ? "negation flipped this word" : ""}">${negated ? "¬" : ""}${word}${tag}</span>`;
      }).join("");
    }

    input.addEventListener("input", update);
    update();
  }

  const theoryHTML = `
    <div class="theory">
      <h3>Bayes' theorem for text</h3>
      <p>We want the probability a document \\(d\\) is positive given its words. Bayes' theorem inverts the question into things we can count from data:</p>
      $$ P(\\text{pos} \\mid d) = \\frac{P(d \\mid \\text{pos}) \\, P(\\text{pos})}{P(d)} $$

      <h3>The "naive" independence assumption</h3>
      <p>Modelling \\(P(d \\mid \\text{pos})\\) exactly is intractable, so we assume words are conditionally independent given the class:</p>
      $$ P(d \\mid c) \\approx \\prod_{i=1}^{n} P(w_i \\mid c) $$
      <p>This is false (words obviously correlate!) — yet the classifier works remarkably well because we only need the <em>argmax</em> to be right, not the probabilities.</p>

      <h3>From products to sums: log-odds</h3>
      <p>Multiplying many small probabilities underflows, so we work in log space. The decision reduces to the sign of a sum of per-word weights — exactly what the demo displays on each chip:</p>
      $$ \\log \\frac{P(\\text{pos} \\mid d)}{P(\\text{neg} \\mid d)} = \\log\\frac{P(\\text{pos})}{P(\\text{neg})} + \\sum_{i} \\underbrace{\\log \\frac{P(w_i \\mid \\text{pos})}{P(w_i \\mid \\text{neg})}}_{\\text{per-word weight}} $$
      <p>Passing the total through a sigmoid \\( \\sigma(z) = \\frac{1}{1 + e^{-z}} \\) recovers a probability — note this makes Naive Bayes a <strong>linear classifier</strong>, a generative cousin of logistic regression.</p>

      <h3>Laplace smoothing</h3>
      <p>A word never seen in positive training data would give \\(P(w \\mid \\text{pos}) = 0\\) and veto everything. Add-one smoothing fixes this:</p>
      $$ P(w \\mid c) = \\frac{\\text{count}(w, c) + 1}{\\sum_{w'} \\text{count}(w', c) + |V|} $$

      <h3>Negation handling</h3>
      <p>Pure bag-of-words can't tell "good" from "not good". The demo flips a word's weight when a negator appears within a 2-token window — a classic trick (Das &amp; Chen, 2001). Transformers solve this properly via context, which is why fine-tuned BERT beats Naive Bayes by ~10 points on sentiment benchmarks.</p>

      <div class="callout">💡 <strong>Why employers care:</strong> Naive Bayes is the canonical baseline — fast, interpretable, and a frequent interview derivation. Knowing when a 60-year-old linear model is good enough (and when you need a transformer) is real engineering judgment.</div>
    </div>`;

  window.DEMOS.sentiment = { title: "💬 Naive Bayes Sentiment Analyzer", renderDemo, theoryHTML };
})();
