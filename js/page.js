// Mounts the demo named in <body data-demo>, renders the theory column, typesets the maths,
// and handles the theme toggle. No network access.
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'hh-theme';
  function current() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function apply(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
    var btn = document.getElementById('theme-toggle');
    if (btn) { btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'); btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false'); }
  }
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    apply(current());
    toggle.addEventListener('click', function () {
      var next = current() === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
      // redraw canvases that read theme colours when the demo re-renders on resize
      window.dispatchEvent(new Event('resize'));
    });
  }

  function typeset(el) {
    if (window.renderMathInElement && el) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  }

  var key = document.body.getAttribute('data-demo');
  if (key) {
    var def = (window.DEMOS || {})[key];
    var demoEl = document.getElementById('demo');
    var theoryEl = document.getElementById('theory');
    if (def && demoEl && theoryEl) {
      theoryEl.innerHTML = def.theoryHTML;
      def.renderDemo(demoEl);
      typeset(theoryEl);
      typeset(demoEl);
    } else if (demoEl) {
      demoEl.innerHTML = '<p class="demo-desc">This demo could not be loaded.</p>';
    }
  }
})();
