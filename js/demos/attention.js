/* Transformer self-attention visualizer — deterministic toy embeddings, real QK^T softmax math. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  const D = 16; // embedding dim

  // Deterministic pseudo-random embedding per token (hash-seeded), so words are stable.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function embed(token, posIdx) {
    const rnd = mulberry32(hash(token.toLowerCase()));
    const v = Array.from({ length: D }, () => rnd() * 2 - 1);
    // sinusoidal positional encoding added on top
    for (let i = 0; i < D; i += 2) {
      const freq = 1 / Math.pow(10000, i / D);
      v[i] += 0.4 * Math.sin(posIdx * freq);
      if (i + 1 < D) v[i + 1] += 0.4 * Math.cos(posIdx * freq);
    }
    return v;
  }

  // Fixed random projection matrices for Q and K (seeded once)
  function randMat(seed) {
    const rnd = mulberry32(seed);
    return Array.from({ length: D }, () => Array.from({ length: D }, () => (rnd() * 2 - 1) / Math.sqrt(D)));
  }
  const Wq = randMat(42), Wk = randMat(1337);
  const matVec = (M, v) => M.map((row) => row.reduce((s, m, i) => s + m * v[i], 0));
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  function attention(tokens, causal, temp) {
    const X = tokens.map((t, i) => embed(t, i));
    const Q = X.map((x) => matVec(Wq, x));
    const K = X.map((x) => matVec(Wk, x));
    const scale = Math.sqrt(D) * temp;
    return Q.map((q, i) => {
      const scores = K.map((k, j) => (causal && j > i ? -Infinity : dot(q, k) / scale));
      const mx = Math.max(...scores);
      const exps = scores.map((s) => Math.exp(s - mx));
      const Z = exps.reduce((a, b) => a + b, 0);
      return exps.map((e) => e / Z);
    });
  }

  function colorFor(w) {
    // 0 → deep navy, 1 → bright blue/purple
    const a = Math.min(1, w * 1.6);
    const pct = Math.round(8 + a * 92);
    return `background:color-mix(in srgb, var(--accent) ${pct}%, var(--surface-2));color:${a > 0.5 ? '#1A1200' : 'var(--text)'}`;
  }

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc">Type a sentence and watch <strong>scaled dot-product self-attention</strong> computed live: each row shows how much one token (the query) attends to every other token (the keys). Real Q·Kᵀ → softmax math on toy embeddings.</p>
      <div class="demo-row">
        <input class="demo-input" id="att-input" value="the robot read the book because it was curious" />
      </div>
      <div class="demo-panel">
        <div class="slider-row">
          <label>Softmax temperature \u03c4</label>
          <input type="range" id="att-temp" min="0.2" max="3" step="0.1" value="1" />
          <span class="slider-val" id="att-temp-val">1.0</span>
        </div>
        <div class="slider-row">
          <label>Causal mask (GPT-style)</label>
          <div class="pill-btns">
            <button class="pill active" id="att-causal-on">On — decoder</button>
            <button class="pill" id="att-causal-off">Off — encoder</button>
          </div>
        </div>
      </div>
      <div class="demo-panel">
        <h4>Attention weights — row = query token, column = key token</h4>
        <div class="heat-wrap" id="att-heat"></div>
        <p class="demo-desc" style="margin:0.8rem 0 0">Lower temperature → sharper attention (winner-take-all). Causal mask zeroes the upper triangle so tokens can't peek at the future.</p>
      </div>`;

    const input = root.querySelector("#att-input");
    const tempSlider = root.querySelector("#att-temp");
    const tempVal = root.querySelector("#att-temp-val");
    const heat = root.querySelector("#att-heat");
    const onBtn = root.querySelector("#att-causal-on");
    const offBtn = root.querySelector("#att-causal-off");
    let causal = true;

    function draw() {
      const tokens = input.value.trim().split(/\s+/).filter(Boolean).slice(0, 10);
      if (tokens.length < 2) { heat.innerHTML = "<p class='demo-desc'>Type at least two words.</p>"; return; }
      const temp = parseFloat(tempSlider.value);
      tempVal.textContent = temp.toFixed(1);
      const A = attention(tokens, causal, temp);

      let html = "<table class='heat-table'><tr><th></th>";
      tokens.forEach((t) => (html += `<th>${t}</th>`));
      html += "</tr>";
      A.forEach((row, i) => {
        html += `<tr><th style="text-align:right">${tokens[i]}</th>`;
        row.forEach((w) => {
          html += `<td><div class="heat-cell" style="${colorFor(w)}" title="weight ${w.toFixed(3)}">${w < 0.005 ? "" : w.toFixed(2)}</div></td>`;
        });
        html += "</tr>";
      });
      heat.innerHTML = html + "</table>";
    }

    input.addEventListener("input", draw);
    tempSlider.addEventListener("input", draw);
    onBtn.addEventListener("click", () => { causal = true; onBtn.classList.add("active"); offBtn.classList.remove("active"); draw(); });
    offBtn.addEventListener("click", () => { causal = false; offBtn.classList.add("active"); onBtn.classList.remove("active"); draw(); });
    draw();
  }

  const theoryHTML = `
    <div class="theory">
      <h3>Self-attention: the engine of every LLM</h3>
      <p>A transformer layer lets every token gather information from every other token. Each token's embedding \\(x_i\\) is projected into three roles — <strong>query</strong> (what am I looking for?), <strong>key</strong> (what do I contain?) and <strong>value</strong> (what do I pass on?):</p>
      $$ Q = XW_Q, \\quad K = XW_K, \\quad V = XW_V $$

      <h3>Scaled dot-product attention</h3>
      $$ \\text{Attention}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right) V $$
      <ul>
        <li>\\(QK^\\top\\) — a similarity score between every query and every key (the heatmap in the demo).</li>
        <li>\\(\\sqrt{d_k}\\) — without this, dot products grow with dimension, pushing softmax into near-zero-gradient saturation. Since for random unit-variance vectors \\(\\mathrm{Var}(q \\cdot k) = d_k\\), dividing by \\(\\sqrt{d_k}\\) keeps scores at unit variance.</li>
        <li>softmax — turns each row of scores into a probability distribution: \\( \\alpha_{ij} = \\frac{e^{s_{ij}}}{\\sum_j e^{s_{ij}}} \\), so each row of the heatmap sums to 1.</li>
      </ul>

      <h3>Causal masking</h3>
      <p>Decoder-only models (GPT) must not see future tokens during training, so scores above the diagonal are set to \\(-\\infty\\) before softmax:</p>
      $$ s_{ij} = \\begin{cases} \\dfrac{q_i \\cdot k_j}{\\sqrt{d_k}} & j \\le i \\\\[4pt] -\\infty & j > i \\end{cases} $$
      <p>Toggle the mask in the demo — the upper triangle goes dark.</p>

      <h3>Temperature</h3>
      <p>Dividing logits by a temperature \\(\\tau\\) controls sharpness: \\(\\tau \\to 0\\) approaches hard argmax attention, large \\(\\tau\\) approaches uniform. The same trick controls randomness in LLM sampling.</p>

      <h3>Multi-head attention</h3>
      <p>Running \\(h\\) attention heads in parallel on subspaces of size \\(d_k = d_{model}/h\\) lets the model attend to different relationships (syntax, coreference, position) simultaneously:</p>
      $$ \\text{MultiHead}(Q,K,V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h) W_O $$

      <div class="callout">💡 <strong>Why employers care:</strong> attention is the core primitive behind GPT, Llama and every modern LLM. Being able to derive and debug it (KV-cache, FlashAttention, masking bugs) separates LLM engineers from API users.</div>
    </div>`;

  window.DEMOS.attention = { title: "🎯 Transformer Attention Visualizer", renderDemo, theoryHTML };
})();
