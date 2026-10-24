/* K-Means clustering — interactive canvas with step-by-step Lloyd's algorithm. */
(function () {
  "use strict";
  window.DEMOS = window.DEMOS || {};

  const COLORS = ["#00ff41", "#00e5ff", "#ffb000", "#ff3333", "#39ff14", "#00d4aa"];

  function renderDemo(root) {
    root.innerHTML = `
      <p class="demo-desc"><strong>Click the canvas to add data points</strong> (or generate blobs), pick k, then step through Lloyd's algorithm: assign each point to its nearest centroid (✕), move centroids to the mean, repeat until nothing changes.</p>
      <div class="demo-panel">
        <div class="slider-row">
          <label>Number of clusters k</label>
          <input type="range" id="km-k" min="2" max="6" step="1" value="3" />
          <span class="slider-val" id="km-k-val">k = 3</span>
        </div>
        <div class="slider-row" style="margin-bottom:0">
          <label>Controls</label>
          <div class="pill-btns">
            <button class="pill" id="km-blobs">✨ Generate blobs</button>
            <button class="pill" id="km-init">🎲 Init centroids</button>
            <button class="pill" id="km-step">▶ Step</button>
            <button class="pill" id="km-run">⏩ Run to convergence</button>
            <button class="pill" id="km-clear">🗑 Clear</button>
          </div>
        </div>
      </div>
      <canvas id="km-canvas" class="demo-canvas" height="400" style="cursor:crosshair"></canvas>
      <p class="demo-desc" style="margin-top:.8rem" id="km-status">Canvas empty — click to add points or hit "Generate blobs".</p>`;

    const canvas = root.querySelector("#km-canvas");
    const ctx = canvas.getContext("2d");
    const status = root.querySelector("#km-status");
    const kSlider = root.querySelector("#km-k");

    let points = [];      // {x, y, c}
    let centroids = [];   // {x, y}
    let phase = "assign"; // next half-step of Lloyd's algorithm
    let iterations = 0;

    function sizeCanvas() {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = 400 * devicePixelRatio;
      draw();
    }

    const K = () => +kSlider.value;

    function inertia() {
      let s = 0;
      for (const p of points) {
        if (p.c == null) return null;
        const c = centroids[p.c];
        s += (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      }
      const scale = devicePixelRatio * devicePixelRatio * 1000;
      return s / scale;
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const r = 5 * devicePixelRatio;
      for (const p of points) {
        ctx.fillStyle = p.c == null ? "#5a8a5a" : COLORS[p.c];
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      centroids.forEach((c, i) => {
        ctx.strokeStyle = COLORS[i];
        ctx.lineWidth = 3.5 * devicePixelRatio;
        const s = 9 * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(c.x - s, c.y - s); ctx.lineTo(c.x + s, c.y + s);
        ctx.moveTo(c.x + s, c.y - s); ctx.lineTo(c.x - s, c.y + s);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.5)";
        ctx.lineWidth = devicePixelRatio;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14 * devicePixelRatio, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function initCentroids() {
      if (points.length < K()) { status.textContent = `Need at least ${K()} points.`; return false; }
      // k-means++ style: first random, rest weighted by squared distance
      centroids = [points[Math.floor(Math.random() * points.length)]].map((p) => ({ x: p.x, y: p.y }));
      while (centroids.length < K()) {
        const d2 = points.map((p) => Math.min(...centroids.map((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
        const sum = d2.reduce((a, b) => a + b, 0);
        let r = Math.random() * sum, idx = 0;
        while (r > d2[idx]) { r -= d2[idx]; idx++; }
        centroids.push({ x: points[idx].x, y: points[idx].y });
      }
      points.forEach((p) => (p.c = null));
      phase = "assign";
      iterations = 0;
      status.innerHTML = `Centroids initialized with <strong>k-means++</strong>. Hit "Step" to assign points.`;
      draw();
      return true;
    }

    function stepOnce() {
      if (!centroids.length) { if (!initCentroids()) return false; return true; }
      if (phase === "assign") {
        let changed = 0;
        for (const p of points) {
          let best = 0, bd = Infinity;
          centroids.forEach((c, i) => {
            const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
            if (d < bd) { bd = d; best = i; }
          });
          if (p.c !== best) changed++;
          p.c = best;
        }
        phase = "update";
        iterations++;
        status.innerHTML = `Iteration ${iterations} — <strong>assignment step</strong>: ${changed} points changed cluster. Inertia J = <span class="mono">${inertia().toFixed(1)}</span>`;
        draw();
        return changed > 0 || iterations === 1;
      } else {
        centroids = centroids.map((c, i) => {
          const mine = points.filter((p) => p.c === i);
          if (!mine.length) return c;
          return {
            x: mine.reduce((s, p) => s + p.x, 0) / mine.length,
            y: mine.reduce((s, p) => s + p.y, 0) / mine.length,
          };
        });
        phase = "assign";
        status.innerHTML = `Iteration ${iterations} — <strong>update step</strong>: centroids moved to cluster means. Inertia J = <span class="mono">${inertia().toFixed(1)}</span>`;
        draw();
        return true;
      }
    }

    function runAll() {
      if (!centroids.length && !initCentroids()) return;
      let guard = 0;
      const tick = () => {
        const moved = stepOnce();
        guard++;
        if (moved && guard < 60) setTimeout(tick, 220);
        else status.innerHTML += ` — <strong style="color:#00ff41">converged [OK]</strong>`;
      };
      tick();
    }

    function genBlobs() {
      points = [];
      const k = K();
      const w = canvas.width, h = canvas.height, m = 0.16;
      for (let b = 0; b < k; b++) {
        const cx = (m + Math.random() * (1 - 2 * m)) * w;
        const cy = (m + Math.random() * (1 - 2 * m)) * h;
        const spread = (0.05 + Math.random() * 0.05) * w;
        for (let i = 0; i < 28; i++) {
          // Box-Muller for Gaussian blobs
          const u = Math.random(), v = Math.random();
          const g1 = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
          const g2 = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v);
          points.push({ x: cx + g1 * spread, y: cy + g2 * spread, c: null });
        }
      }
      centroids = [];
      status.textContent = `Generated ${points.length} points in ${k} Gaussian blobs. Init centroids, then step.`;
      draw();
    }

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      points.push({ x: (e.clientX - rect.left) * devicePixelRatio, y: (e.clientY - rect.top) * devicePixelRatio, c: null });
      status.textContent = `${points.length} points placed.`;
      draw();
    });
    kSlider.addEventListener("input", () => (root.querySelector("#km-k-val").textContent = "k = " + K()));
    root.querySelector("#km-blobs").addEventListener("click", genBlobs);
    root.querySelector("#km-init").addEventListener("click", initCentroids);
    root.querySelector("#km-step").addEventListener("click", stepOnce);
    root.querySelector("#km-run").addEventListener("click", runAll);
    root.querySelector("#km-clear").addEventListener("click", () => {
      points = []; centroids = []; iterations = 0;
      status.textContent = "Cleared.";
      draw();
    });

    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    genBlobs();
    return () => window.removeEventListener("resize", sizeCanvas);
  }

  const theoryHTML = `
    <div class="theory">
      <h3>The clustering objective</h3>
      <p>K-means partitions \\(n\\) points into \\(k\\) clusters by minimizing the <strong>within-cluster sum of squares</strong> (inertia):</p>
      $$ J = \\sum_{i=1}^{k} \\sum_{x \\in C_i} \\lVert x - \\mu_i \\rVert^2, \\qquad \\mu_i = \\frac{1}{|C_i|}\\sum_{x \\in C_i} x $$
      <p>Finding the global optimum is NP-hard, so we use a fast alternating heuristic.</p>

      <h3>Lloyd's algorithm (what the demo animates)</h3>
      <ul>
        <li><strong>Assignment step:</strong> give each point to its nearest centroid: \\( c(x) = \\arg\\min_i \\lVert x - \\mu_i \\rVert^2 \\)</li>
        <li><strong>Update step:</strong> move each centroid to the mean of its assigned points.</li>
      </ul>
      <p>Each step can only decrease \\(J\\) (the assignment step is optimal given fixed centroids; the mean is the minimizer of squared distance given fixed assignments), and there are finitely many partitions — so the algorithm <strong>always converges</strong>, though possibly to a local optimum.</p>

      <h3>Why the mean? A one-line proof</h3>
      <p>For a fixed cluster, \\( \\frac{\\partial}{\\partial \\mu} \\sum_x \\lVert x - \\mu \\rVert^2 = -2 \\sum_x (x - \\mu) = 0 \\;\\Rightarrow\\; \\mu = \\frac{1}{|C|}\\sum_x x \\). Squared Euclidean distance is exactly what makes the arithmetic mean optimal.</p>

      <h3>k-means++ initialization</h3>
      <p>Random starts can be terrible. k-means++ picks each new centroid with probability proportional to \\(D(x)^2\\) — the squared distance to the nearest already-chosen centroid — spreading seeds out. It guarantees \\( \\mathbb{E}[J] \\le 8(\\ln k + 2) \\, J_{\\text{opt}} \\).</p>

      <h3>Choosing k</h3>
      <ul>
        <li><strong>Elbow method:</strong> plot \\(J\\) vs \\(k\\), look for the bend.</li>
        <li><strong>Silhouette score:</strong> \\( s = \\frac{b - a}{\\max(a, b)} \\) where \\(a\\) is mean intra-cluster distance and \\(b\\) the nearest-other-cluster distance.</li>
      </ul>

      <div class="callout">💡 <strong>Why employers care:</strong> customer segmentation, anomaly detection and embedding-space exploration all run on clustering. It's also the standard test of whether a candidate understands unsupervised learning beyond calling <code>.fit()</code>.</div>
    </div>`;

  window.DEMOS.kmeans = { title: "🎨 K-Means Customer Segmentation", renderDemo, theoryHTML };
})();
