// Smoke test for the ML demos page.   Run:  node tests/smoke.mjs
//
// Serves this folder on http://127.0.0.1:8091, opens it in Google Chrome through Playwright and checks:
//   - the page contract (title, hero, link back to the portfolio, no leftover sections or dead anchors),
//   - window.DEMOS holds the six demos, and each project card opens a modal with a working demo tab
//     and a theory tab with rendered formulas, and Escape closes it again,
//   - no console errors / uncaught exceptions (KaTeX font messages are ignored),
//   - no request leaves this server except to the KaTeX CDN (cdn.jsdelivr.net).
// It also writes docs/screenshot.png (1440x900, the projects grid).
//
// Needs Node, Google Chrome and the `playwright` package where Node can resolve it.
// The repo itself has no dependencies and no package.json on purpose.

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8091;
const HOST = `127.0.0.1:${PORT}`;
const EXPECTED_DEMOS = ['rag', 'attention', 'lora', 'gradient', 'kmeans', 'sentiment'];
const ALLOWED_HOSTS = new Set([HOST, 'cdn.jsdelivr.net']);
const HUB = 'https://harispaartan.github.io/';

function loadPlaywright() {
  // Normal resolution first, then the shared Playwright install on the machine this was written on.
  for (const base of [import.meta.url, 'E:/Work/Task 4/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* try the next location */ }
  }
  throw new Error('Cannot find the "playwright" package. Install it where Node can resolve it (npm i playwright).');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = resolve(ROOT, `.${rel}`);
      const hidden = rel.split('/').some((part) => part.startsWith('.'));
      if (hidden || !file.startsWith(ROOT + sep)) throw new Error('not served');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(PORT, '127.0.0.1', () => done(server));
  });
}

const ascii = (s) => s.replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();

async function main() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const consoleErrors = [];
  const ignored = [];
  const hosts = new Set();
  let demosOk = 0;

  try {
    console.log(`chrome ${browser.version()} | serving ${ROOT} on http://${HOST}/`);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.host);
    });
    const record = (text, where) => {
      const haystack = `${text} ${where}`;
      if (/katex/i.test(haystack) && /font|woff|ttf/i.test(haystack)) ignored.push(text);
      else consoleErrors.push(where ? `${text} (${where})` : text);
    };
    page.on('console', (msg) => { if (msg.type() === 'error') record(msg.text(), msg.location().url ?? ''); });
    page.on('pageerror', (err) => record(`uncaught: ${err.message}`, ''));

    await page.goto(`http://${HOST}/`, { waitUntil: 'load' });

    // --- page contract -------------------------------------------------------------------------
    check((await page.title()) === 'ML demos · Harithas Harikaran', 'document title');
    check((await page.locator('h1').innerText()).trim() === 'ML demos, in the browser', 'h1 text');
    check((await page.locator('.hero-sub').innerText())
      .includes('Six small machine-learning demos with the maths behind them. No server, no tracking.'), 'hero sub text');
    const back = page.locator('nav a', { hasText: 'Back to portfolio' });
    check((await back.count()) === 1 && (await back.getAttribute('href')) === HUB, 'nav link "Back to portfolio" -> hub');
    check((await page.locator(`footer a[href="${HUB}"]`).count()) === 1, 'footer link -> hub');
    for (const id of ['about', 'education', 'experience', 'skills', 'contact']) {
      check((await page.locator(`#${id}`).count()) === 0, `section #${id} is gone`);
    }
    check((await page.locator('a[href^="tel:"]').count()) === 0, 'no tel: links');
    const deadAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.querySelector(h)));
    check(deadAnchors.length === 0, `dead in-page links: ${deadAnchors.join(', ')}`);

    // --- window.DEMOS and the project cards ----------------------------------------------------
    const sorted = (list) => JSON.stringify([...list].sort());
    const keys = await page.evaluate(() => Object.keys(window.DEMOS || {}));
    check(sorted(keys) === sorted(EXPECTED_DEMOS), `window.DEMOS keys are [${keys.join(', ')}]`);
    const cardKeys = await page.locator('.project-card').evaluateAll((els) => els.map((el) => el.dataset.project));
    check(sorted(cardKeys) === sorted(EXPECTED_DEMOS), `project cards are [${cardKeys.join(', ')}]`);

    // --- every card opens a working modal ------------------------------------------------------
    const overlay = page.locator('#modal-overlay');
    const openDemo = async (key) => {
      const card = page.locator(`.project-card[data-project="${key}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await overlay.waitFor({ state: 'visible' });
      return {
        title: ascii(await page.locator('#modal-title').innerText()),
        demoText: (await page.locator('#tab-demo').innerText()).trim(),
        flatCanvases: await page.locator('#tab-demo canvas')
          .evaluateAll((list) => list.filter((c) => c.width === 0 || c.height === 0).length),
      };
    };
    const closeDemo = async () => {
      await page.keyboard.press('Escape');
      await overlay.waitFor({ state: 'hidden' });
    };
    const demoProblems = (opened, label) => {
      const found = [];
      if (!opened.title) found.push(`${label}empty modal title`);
      if (!opened.demoText) found.push(`${label}empty #tab-demo`);
      if (opened.flatCanvases) found.push(`${label}${opened.flatCanvases} canvas(es) with an empty drawing buffer`);
      return found;
    };

    for (const key of EXPECTED_DEMOS) {
      const problems = [];
      let summary = '';
      let step = 'opening the card';
      try {
        const opened = await openDemo(key);
        problems.push(...demoProblems(opened, ''));

        step = 'reading the theory tab';
        await page.locator('.tab[data-tab="theory"]').click();
        const theory = page.locator('#tab-theory');
        const theoryText = (await theory.innerText()).trim();
        const formulas = await theory.locator('.katex').count();
        if (!theoryText) problems.push('empty #tab-theory');
        if (formulas === 0) problems.push('theory tab has no rendered formulas');

        step = 'closing with Escape';
        await closeDemo();

        // The visit above ended on the theory tab: the demo tab must be shown (and measurable) again.
        step = 'reopening the card';
        problems.push(...demoProblems(await openDemo(key), 'on reopen: '));
        step = 'closing after reopening';
        await closeDemo();

        summary = `${opened.title} (demo ${opened.demoText.length} chars, theory ${theoryText.length} chars, ${formulas} formulas)`;
      } catch (err) {
        problems.push(`${step}: ${err.message.split('\n')[0]}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
      if (problems.length === 0) demosOk += 1;
      else failures.push(`demo ${key}: ${problems.join('; ')}`);
      console.log(`  ${problems.length === 0 ? 'ok  ' : 'FAIL'} ${key.padEnd(10)} ${summary || problems.join('; ')}`);
    }

    // --- screenshot of the projects grid (1440x900) --------------------------------------------
    await page.mouse.move(2, 2); // keep the pointer off the cards so no hover glow is captured
    const gridInView = await page.evaluate(() => {
      const nav = document.querySelector('.nav');
      const top = document.querySelector('#projects').getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - nav.offsetHeight - 8, behavior: 'instant' });
      const grid = document.querySelector('.projects-grid').getBoundingClientRect();
      return grid.top >= nav.offsetHeight && grid.bottom <= window.innerHeight;
    });
    check(gridInView, 'the whole projects grid is inside the 1440x900 viewport for the screenshot');
    await page.waitForTimeout(400);
    await mkdir(resolve(ROOT, 'docs'), { recursive: true });
    await page.screenshot({ path: resolve(ROOT, 'docs', 'screenshot.png'), animations: 'disabled' });
    console.log('screenshot: docs/screenshot.png (1440x900)');
  } catch (err) {
    failures.push(`test aborted: ${err.message}`);
  } finally {
    await browser.close();
    server.closeAllConnections?.();
    server.close();
  }

  // --- network and console -----------------------------------------------------------------------
  const foreign = [...hosts].filter((h) => !ALLOWED_HOSTS.has(h));
  check(foreign.length === 0, `requests to unexpected hosts: ${foreign.join(', ')}`);
  console.log(`requests went to: ${[...hosts].sort().join(', ') || '(none)'}`);
  if (ignored.length) console.log(`ignored ${ignored.length} KaTeX font message(s)`);
  for (const line of consoleErrors) console.log(`  console error: ${line}`);
  for (const line of failures) console.log(`  FAILED: ${line}`);

  const extra = failures.length ? `, ${failures.length} check(s) failed` : '';
  console.log(`${demosOk}/${EXPECTED_DEMOS.length} demos ok, ${consoleErrors.length} console errors${extra}`);
  process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
