/* Gradient descent playground — SGD vs Momentum vs Adam racing on a non-convex loss surface. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  // Non-convex double-well loss surface
  const f = (x, y) => 0.25 * x * x * x * x - 0.5 * x * x + 0.08 * x + 0.5 * y * y + 0.15 * Math.sin(3 * x) * Math.cos(2 * y) + 0.4;
  const grad = (x, y) => {
    const eps = 1e-4;
    return [
      (f(x + eps, y) - f(x - eps, y)) / (2 * eps),
      (f(x, y + eps) - f(x, y - eps)) / (2 * eps),
    ];
  };

  const DOMAIN = 2.2; // x,y in [-DOMAIN, DOMAIN]
  const OPTS = [
    { key: "sgd", name: "SGD", color: "#ff3333" },
    { key: "mom", name: "Momentum", color: "#ffb000" },
    { key: "adam", name: "Adam", color: "#00ff41" },
  ];

  function makeStates(x0, y0) {
    return {
      sgd: { x: x0, y: y0, trail: [[x0, y0]] },
      mom: { x: x0, y: y0, vx: 0, vy: 0, trail: [[x0, y0]] },
      adam: { x: x0, y: y0, m: [0, 0], v: [0, 0], t: 0, trail: [[x0, y0]] },
    };
  }

  function step(states, lr) {
    // SGD
    let g = grad(states.sgd.x, states.sgd.y);
    states.sgd.x -= lr * g[0]; states.sgd.y -= lr * g[1];
    states.sgd.trail.push([states.sgd.x, states.sgd.y]);

    // Momentum (β = 0.9)
    g = grad(states.mom.x, states.mom.y);
    states.mom.vx = 0.9 * states.mom.vx - lr * g[0];
    states.mom.vy = 0.9 * states.mom.vy - lr * g[1];
    states.mom.x += states.mom.vx; states.mom.y += states.mom.vy;
    states.mom.trail.push([states.mom.x, states.mom.y]);

    // Adam (β1=0.9, β2=0.999)
    const a = states.adam;
    a.t += 1;
    g = grad(a.x, a.y);
    for (let i = 0; i < 2; i++) {
      a.m[i] = 0.9 * a.m[i] + 0.1 * g[i];
      a.v[i] = 0.999 * a.v[i] + 0.001 * g[i] * g[i];
    }
    const mh = a.m.map((m) => m / (1 - Math.pow(0.9, a.t)));
    const vh = a.v.map((v) => v / (1 - Math.pow(0.999, a.t)));
    a.x -= (lr * 3) * mh[0] / (Math.sqrt(vh[0]) + 1e-8);
    a.y -= (lr * 3) * mh[1] / (Math.sqrt(vh[1]) + 1e-8);
    a.trail.push([a.x, a.y]);
  }

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc"><strong>Click anywhere on the loss surface</strong> to drop three optimizers and watch them race to a minimum. The surface is non-convex (two basins + ripples) — sometimes SGD gets trapped while Momentum escapes.</p>
      <div class="demo-panel">
        <div class="slider-row">
          <label>Learning rate \u03b7</label>
          <input type="range" id="gd-lr" min="-3" max="-0.4" step="0.05" value="-1.6" />
          <span class="slider-val" id="gd-lr-val">0.025</span>
        </div>
        <div class="slider-row" style="margin-bottom:0">
          <label>Legend</label>
          <div class="pill-btns">${OPTS.map((o) => `<span class="pill" style="color:${o.color};border-color:${o.color}">● ${o.name}</span>`).join("")}
            <button class="pill" id="gd-reset">↺ Reset</button>
          </div>
        </div>
      </div>
      <canvas id="gd-canvas" class="demo-canvas" height="420" style="cursor:crosshair"></canvas>
      <p class="demo-desc" style="margin-top:.8rem" id="gd-status">Waiting for a starting point — click the surface above.</p>`;

    const canvas = root.querySelector("#gd-canvas");
    const ctx = canvas.getContext("2d");
    const lrSlider = root.querySelector("#gd-lr");
    const lrVal = root.querySelector("#gd-lr-val");
    const status = root.querySelector("#gd-status");

    let states = null, iter = 0, raf = null, surface = null;

    function sizeCanvas() {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = 420 * devicePixelRatio;
      surface = null;
    }
    sizeCanvas();

    const toPx = (x, y) => [
      ((x + DOMAIN) / (2 * DOMAIN)) * canvas.width,
      ((y + DOMAIN) / (2 * DOMAIN)) * canvas.height,
    ];
    const toXY = (px, py) => [
      (px / canvas.width) * 2 * DOMAIN - DOMAIN,
      (py / canvas.height) * 2 * DOMAIN - DOMAIN,
    ];

    function drawSurface() {
      if (!surface) {
        // render loss heatmap once to an offscreen canvas
        surface = document.createElement("canvas");
        surface.width = canvas.width; surface.height = canvas.height;
        const sctx = surface.getContext("2d");
        const img = sctx.createImageData(surface.width, surface.height);
        let fmin = Infinity, fmax = -Infinity;
        const cell = 4;
        for (let py = 0; py < surface.height; py += cell)
          for (let px = 0; px < surface.width; px += cell) {
            const [x, y] = toXY(px, py);
            const v = f(x, y);
            if (v < fmin) fmin = v;
            if (v > fmax) fmax = v;
          }
        for (let py = 0; py < surface.height; py++) {
          for (let px = 0; px < surface.width; px++) {
            const [x, y] = toXY(px, py);
            const t = Math.pow((f(x, y) - fmin) / (fmax - fmin), 0.6);
            const i = (py * surface.width + px) * 4;
            // dark (low loss) → matrix green → amber (high loss)
            img.data[i] = 5 + t * 180;
            img.data[i + 1] = 12 + (1 - t) * 180 + t * 60;
            img.data[i + 2] = 8 + t * 30;
            img.data[i + 3] = 255;
          }
        }
        sctx.putImageData(img, 0, 0);
      }
      ctx.drawImage(surface, 0, 0);
    }

    function drawTrails() {
      if (!states) return;
      for (const o of OPTS) {
        const s = states[o.key];
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.beginPath();
        s.trail.forEach(([x, y], i) => {
          const [px, py] = toPx(x, y);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
        const [px, py] = toPx(s.x, s.y);
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(px, py, 5 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      const lr = Math.pow(10, parseFloat(lrSlider.value));
      if (states && iter < 400) {
        for (let k = 0; k < 2; k++) step(states, lr);
        iter += 2;
        const losses = OPTS.map((o) => `${o.name}: ${f(states[o.key].x, states[o.key].y).toFixed(3)}`).join("  ·  ");
        status.innerHTML = `Iteration <strong>${iter}</strong> — loss → <span class="mono">${losses}</span>`;
      }
      drawSurface();
      drawTrails();
      raf = requestAnimationFrame(frame);
    }

    lrSlider.addEventListener("input", () => {
      lrVal.textContent = Math.pow(10, parseFloat(lrSlider.value)).toFixed(3);
    });
    lrVal.textContent = Math.pow(10, parseFloat(lrSlider.value)).toFixed(3);

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const [x, y] = toXY((e.clientX - rect.left) * devicePixelRatio, (e.clientY - rect.top) * devicePixelRatio);
      states = makeStates(x, y);
      iter = 0;
    });
    root.querySelector("#gd-reset").addEventListener("click", () => {
      states = null; iter = 0;
      status.textContent = "Waiting for a starting point — click the surface above.";
    });

    const onResize = () => { sizeCanvas(); };
    window.addEventListener("resize", onResize);
    frame();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }

  const theoryHTML = `
    <div class="theory">
      <h3>Training = optimization</h3>
      <p>Every neural network is trained by minimizing a loss \\(\\mathcal{L}(\\theta)\\) over millions of parameters. We can't solve it analytically, so we walk downhill along the negative gradient.</p>

      <h3>Vanilla (stochastic) gradient descent</h3>
      $$ \\theta_{t+1} = \\theta_t - \\eta \\, \\nabla_\\theta \\mathcal{L}(\\theta_t) $$
      <p>\\(\\eta\\) is the learning rate — the most important hyperparameter in deep learning. Too small: crawling. Too large: divergence (try \\(\\eta > 0.2\\) in the demo and watch it explode). "Stochastic" means the gradient is estimated on a mini-batch, which adds noise that can actually help escape bad minima.</p>

      <h3>Momentum: a heavy ball rolling downhill</h3>
      $$ v_{t+1} = \\beta v_t - \\eta \\nabla\\mathcal{L}(\\theta_t), \\qquad \\theta_{t+1} = \\theta_t + v_{t+1} $$
      <p>The velocity \\(v\\) accumulates an exponential moving average of past gradients (\\(\\beta \\approx 0.9\\)). It damps oscillations across narrow ravines and powers through small bumps and saddle points — watch it overshoot then settle in the demo.</p>

      <h3>Adam: adaptive learning rates per parameter</h3>
      $$ m_t = \\beta_1 m_{t-1} + (1-\\beta_1) g_t, \\qquad v_t = \\beta_2 v_{t-1} + (1-\\beta_2) g_t^2 $$
      $$ \\hat m_t = \\frac{m_t}{1-\\beta_1^t}, \\quad \\hat v_t = \\frac{v_t}{1-\\beta_2^t}, \\qquad \\theta_{t+1} = \\theta_t - \\eta \\, \\frac{\\hat m_t}{\\sqrt{\\hat v_t} + \\epsilon} $$
      <ul>
        <li>\\(m_t\\): momentum-style first moment (mean of gradients).</li>
        <li>\\(v_t\\): second moment (uncentered variance) — parameters with consistently large gradients get their effective step size shrunk.</li>
        <li>The \\(1 - \\beta^t\\) terms correct the bias from zero-initialization in early steps.</li>
      </ul>
      <p>Adam (and AdamW, which fixes weight decay) is the default optimizer for transformers and LLM training.</p>

      <h3>Non-convexity</h3>
      <p>The demo surface has two basins, like real loss landscapes which contain saddle points and many minima. In high dimensions most critical points are saddles, and noise + momentum are key to escaping them. Surprisingly, most local minima in deep nets generalize about equally well.</p>

      <div class="callout">💡 <strong>Why employers care:</strong> learning-rate tuning, divergence debugging, and optimizer choice are daily realities of training models. This is also the most common "explain the math" interview topic.</div>
    </div>`;

  window.DEMOS.gradient = { title: "⛰️ Gradient Descent Playground", renderDemo, theoryHTML };
})();
