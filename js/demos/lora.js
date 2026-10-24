/* LoRA fine-tuning calculator — real parameter & memory math for popular model sizes. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  // Approximate architecture specs (decoder-only transformers)
  const MODELS = [
    { name: "TinyLlama 1.1B", params: 1.1e9, layers: 22, dModel: 2048 },
    { name: "Llama-3 8B", params: 8.0e9, layers: 32, dModel: 4096 },
    { name: "Mistral 7B", params: 7.2e9, layers: 32, dModel: 4096 },
    { name: "Llama-3 70B", params: 70e9, layers: 80, dModel: 8192 },
  ];

  // Target modules per layer: q,k,v,o projections (d_model x d_model each, roughly)
  function loraParams(model, r, targets) {
    return model.layers * targets * 2 * model.dModel * r; // B (d×r) + A (r×d)
  }

  const fmt = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  };
  const gb = (bytes) => (bytes / 1e9).toFixed(1) + " GB";

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc">Full fine-tuning of an 8B model needs server-grade GPUs. <strong>LoRA</strong> freezes the base weights and trains tiny low-rank adapters instead. Drag the sliders — the math updates live.</p>
      <div class="demo-panel">
        <div class="slider-row">
          <label>Base model</label>
          <div class="pill-btns" id="lora-models"></div>
        </div>
        <div class="slider-row">
          <label>LoRA rank \u2009r</label>
          <input type="range" id="lora-r" min="1" max="128" step="1" value="16" />
          <span class="slider-val" id="lora-r-val">r = 16</span>
        </div>
        <div class="slider-row">
          <label>Target modules / layer</label>
          <input type="range" id="lora-t" min="1" max="7" step="1" value="4" />
          <span class="slider-val" id="lora-t-val">4 (QKVO)</span>
        </div>
        <div class="slider-row">
          <label>Quantize base to 4-bit (QLoRA)</label>
          <div class="pill-btns">
            <button class="pill" id="lora-q-on">On</button>
            <button class="pill active" id="lora-q-off">Off (fp16)</button>
          </div>
        </div>
      </div>

      <div class="stat-tiles">
        <div class="stat-tile"><div class="t-label">Frozen base params</div><div class="t-value" id="lora-base">—</div></div>
        <div class="stat-tile highlight"><div class="t-label">Trainable LoRA params</div><div class="t-value" id="lora-train">—</div></div>
        <div class="stat-tile highlight"><div class="t-label">% of full fine-tune</div><div class="t-value" id="lora-pct">—</div></div>
        <div class="stat-tile"><div class="t-label">Adapter file size</div><div class="t-value" id="lora-file">—</div></div>
      </div>

      <div class="demo-panel">
        <h4>Estimated training GPU memory (weights + grads + Adam states)</h4>
        <div class="bar-compare">
          <div class="bc-row"><span class="bc-label">Full fine-tune</span><div class="bc-track"><div class="bc-fill" id="bar-full" style="background:linear-gradient(90deg,#F87171,#60A5FA)"></div></div><span class="bc-val" id="val-full">—</span></div>
          <div class="bc-row"><span class="bc-label">LoRA</span><div class="bc-track"><div class="bc-fill" id="bar-lora" style="background:linear-gradient(90deg,#D9952F,#F2A93B)"></div></div><span class="bc-val" id="val-lora">—</span></div>
        </div>
        <p class="demo-desc" style="margin:0.8rem 0 0" id="lora-verdict"></p>
      </div>`;

    let model = MODELS[1], quant = false;
    const rS = root.querySelector("#lora-r"), tS = root.querySelector("#lora-t");
    const tNames = { 1: "1 (Q)", 2: "2 (QV)", 3: "3 (QKV)", 4: "4 (QKVO)", 5: "5 (+gate)", 6: "6 (+up)", 7: "7 (all linear)" };

    const modelWrap = root.querySelector("#lora-models");
    MODELS.forEach((m, i) => {
      const b = document.createElement("button");
      b.className = "pill" + (i === 1 ? " active" : "");
      b.textContent = m.name;
      b.addEventListener("click", () => {
        model = m;
        modelWrap.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
        b.classList.add("active");
        update();
      });
      modelWrap.appendChild(b);
    });

    root.querySelector("#lora-q-on").addEventListener("click", function () {
      quant = true; this.classList.add("active"); root.querySelector("#lora-q-off").classList.remove("active"); update();
    });
    root.querySelector("#lora-q-off").addEventListener("click", function () {
      quant = false; this.classList.add("active"); root.querySelector("#lora-q-on").classList.remove("active"); update();
    });

    function update() {
      const r = +rS.value, t = +tS.value;
      root.querySelector("#lora-r-val").textContent = "r = " + r;
      root.querySelector("#lora-t-val").textContent = tNames[t];

      const trainable = loraParams(model, r, t);
      const pct = (trainable / model.params) * 100;

      // memory: full FT = 16 bytes/param (fp16 weights 2 + grads 2 + Adam m,v fp32 8 + master fp32 4)
      const fullMem = model.params * 16;
      const baseBytes = quant ? 0.55 : 2; // 4-bit + overhead vs fp16
      const loraMem = model.params * baseBytes + trainable * 16;

      root.querySelector("#lora-base").textContent = fmt(model.params);
      root.querySelector("#lora-train").textContent = fmt(trainable);
      root.querySelector("#lora-pct").textContent = pct < 0.01 ? pct.toExponential(1) + "%" : pct.toFixed(2) + "%";
      root.querySelector("#lora-file").textContent = (trainable * 2 / 1e6).toFixed(0) + " MB";

      root.querySelector("#val-full").textContent = gb(fullMem);
      root.querySelector("#val-lora").textContent = gb(loraMem);
      root.querySelector("#bar-full").style.width = "100%";
      root.querySelector("#bar-lora").style.width = Math.max(1.5, (loraMem / fullMem) * 100) + "%";

      const fits = loraMem <= 24e9;
      root.querySelector("#lora-verdict").innerHTML = fits
        ? `[OK] <strong style="color:#F2A93B">Fits on a single 24 GB consumer GPU (RTX 4090)</strong> — a ${(fullMem / loraMem).toFixed(0)}× memory reduction vs full fine-tuning.`
        : `⚠️ Needs ${gb(loraMem)} — try a smaller model, lower rank, or enable QLoRA 4-bit quantization.`;
    }

    rS.addEventListener("input", update);
    tS.addEventListener("input", update);
    update();
  }

  const theoryHTML = `
    <div class="theory">
      <h3>The problem with full fine-tuning</h3>
      <p>Adapting an LLM by updating all weights requires storing, for every parameter: the weight, its gradient, and two Adam moment estimates — roughly <strong>16 bytes per parameter</strong>. For an 8B model that's ~128 GB, far beyond any single GPU.</p>

      <h3>The low-rank hypothesis</h3>
      <p>LoRA (Hu et al., 2021) observes that the <em>change</em> in weights during adaptation has low intrinsic rank. So instead of learning a full update \\(\\Delta W \\in \\mathbb{R}^{d \\times d}\\), learn a rank-\\(r\\) factorization:</p>
      $$ W' = W_0 + \\Delta W = W_0 + \\frac{\\alpha}{r} BA, \\qquad B \\in \\mathbb{R}^{d \\times r},\\; A \\in \\mathbb{R}^{r \\times d},\\; r \\ll d $$
      <p>\\(W_0\\) stays <strong>frozen</strong>; only \\(A\\) and \\(B\\) train. \\(A\\) is initialized Gaussian, \\(B\\) to zero, so \\(\\Delta W = 0\\) at the start and training begins exactly at the pretrained model. \\(\\alpha\\) is a scaling hyperparameter.</p>

      <h3>The parameter count</h3>
      <p>Per adapted matrix, trainable parameters drop from \\(d^2\\) to:</p>
      $$ |B| + |A| = dr + rd = 2dr $$
      <p>With \\(d = 4096\\) and \\(r = 16\\): \\(2 \\cdot 4096 \\cdot 16 = 131\\text{K}\\) vs \\(16.8\\text{M}\\) — a <strong>128× reduction</strong> per matrix. That's exactly what the demo computes across all layers.</p>

      <h3>QLoRA: 4-bit bases</h3>
      <p>QLoRA (Dettmers et al., 2023) quantizes the frozen base weights to 4-bit NormalFloat (NF4) and dequantizes on the fly during forward passes. Memory for the base drops ~4× while LoRA adapters still train in bf16 — enabling 70B fine-tuning on a single 48 GB card.</p>

      <h3>Why inference stays fast</h3>
      <p>After training, the adapter can be merged: \\(W' = W_0 + \\frac{\\alpha}{r}BA\\) computed once. <strong>Zero extra latency</strong> at inference — unlike adapter layers or prefix tuning.</p>

      <div class="callout">💡 <strong>Why employers care:</strong> LoRA/QLoRA is how real teams customize LLMs on a budget. Knowing the memory math (weights vs grads vs optimizer states) is a classic ML-engineer interview question.</div>
    </div>`;

  window.DEMOS.lora = { title: "🪄 LoRA Fine-Tuning Calculator", renderDemo, theoryHTML };
})();
