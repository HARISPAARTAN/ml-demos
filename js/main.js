/* Core site logic: matrix hero, boot typing, modal, KaTeX. */
(function () {
  "use strict";

  /* ============ Matrix rain hero ============ */
  const canvas = document.getElementById("hero-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const CHARS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    let w, h, cols, drops;

    function resize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
      cols = Math.floor(w / (14 * devicePixelRatio));
      drops = Array.from({ length: cols }, () => Math.random() * h / devicePixelRatio);
    }
    resize();
    window.addEventListener("resize", resize);

    (function tick() {
      ctx.fillStyle = "rgba(5, 8, 5, 0.08)";
      ctx.fillRect(0, 0, w, h);
      const fs = 13 * devicePixelRatio;
      ctx.font = `${fs}px JetBrains Mono, monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * 14 * devicePixelRatio;
        const y = drops[i] * devicePixelRatio;
        const bright = Math.random() > 0.96;
        ctx.fillStyle = bright ? "#ffffff" : `rgba(0, ${180 + Math.random() * 75 | 0}, 65, ${0.5 + Math.random() * 0.5})`;
        ctx.fillText(ch, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.6 + Math.random() * 0.8;
      }
      requestAnimationFrame(tick);
    })();
  }

  /* ============ Boot typing line ============ */
  const bootLine = document.getElementById("boot-line");
  if (bootLine) {
    const msgs = [
      "initializing neural modules... OK",
      "loading transformers... OK",
      "mounting /dev/projects... OK",
      "system ready. awaiting input.",
    ];
    let mi = 0, ci = 0;
  const type = () => {
      if (mi >= msgs.length) {
        bootLine.innerHTML = '<span class="prompt">$</span> _<span class="cursor-blink">█</span>';
        return;
      }
      const msg = msgs[mi];
      if (ci <= msg.length) {
        bootLine.innerHTML = `<span class="dim">[boot]</span> ${msg.slice(0, ci)}<span class="cursor-blink">█</span>`;
        ci++;
        setTimeout(type, ci === msg.length + 1 ? 400 : 28);
        if (ci > msg.length) { mi++; ci = 0; }
      }
    };
    setTimeout(type, 600);
  }

  /* ============ Live clock / uptime ============ */
  const navClock = document.getElementById("nav-clock");
  const footerUptime = document.getElementById("footer-uptime");
  const start = Date.now();
  setInterval(() => {
    const now = new Date();
  if (navClock) navClock.textContent = `[${now.toISOString().slice(11, 19)} UTC]`;
    if (footerUptime) {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      footerUptime.textContent = `${h}:${m}:${sec}`;
    }
  }, 1000);

  /* ============ Modal + tabs ============ */
  const overlay = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const titleBar = document.getElementById("modal-title-bar");
  const demoPanel = document.getElementById("tab-demo");
  const theoryPanel = document.getElementById("tab-theory");
  const tabs = document.querySelectorAll(".modal-tabs .tab");
  let activeCleanup = null;

  function renderMath(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  function openProject(key) {
    const def = (window.DEMOS || {})[key];
    if (!def) return;
    const clean = def.title.replace(/[^\w\s./-]/g, "").trim().toLowerCase().replace(/\s+/g, "_");
    titleEl.textContent = def.title;
    if (titleBar) titleBar.textContent = `~/bin/${clean} — pid ${Math.floor(Math.random() * 9000) + 1000}`;
    demoPanel.innerHTML = "";
    theoryPanel.innerHTML = def.theoryHTML;
    // Show the modal and the demo tab first: the canvas demos measure their own size while rendering,
    // and a hidden element measures 0 (the gradient demo threw and never opened, k-means got a 0px canvas).
    setTab("demo");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    activeCleanup = def.renderDemo(demoPanel) || null;
    renderMath(theoryPanel);
    renderMath(demoPanel);
  }

  function closeProject() {
    if (typeof activeCleanup === "function") activeCleanup();
    activeCleanup = null;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  function setTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    demoPanel.classList.toggle("active", name === "demo");
    theoryPanel.classList.toggle("active", name === "theory");
  }

  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => openProject(card.dataset.project));
  });
  tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
  document.getElementById("modal-close").addEventListener("click", closeProject);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeProject(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeProject();
  });
})();
