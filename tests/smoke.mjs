// Smoke test for the ML demos site.   Run:  node tests/smoke.mjs
//
// Serves the repository on http://127.0.0.1:8091, opens it in Google Chrome through Playwright and checks
// the overview page and every demo page: the demo mounted (#demo has content), the theory column has
// typeset formulas (.katex elements), no console errors or uncaught exceptions, no horizontal overflow at
// 390 px, and no request leaves the local server. It writes docs/screenshot.png (overview, 1440x900) and
// docs/<demo>.png for each demo page.
//
// Needs Node, Google Chrome and a `playwright` package that Node can resolve. The site itself has no dependencies.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8091;
let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { playwright = createRequire('E:/Work/Task 4/package.json')('playwright'); }
const { chromium } = playwright;

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}/`;
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });

const DEMOS = ['rag', 'attention', 'lora', 'gradient', 'kmeans', 'sentiment'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
console.log(`chrome ${browser.version()} | serving ${ROOT} on ${BASE}`);
let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL', m); };

async function visit(file, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [], foreign = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (new URL(r.url()).hostname !== '127.0.0.1') foreign.push(r.url()); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(BASE + file, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  return { page, errors, foreign, failed, overflow };
}

// overview
{
  const { page, errors, foreign, failed, overflow } = await visit('', 1440, 900);
  const cards = await page.locator('a.card').count();
  if (cards !== 6) fail(`overview: expected 6 cards, found ${cards}`);
  if (errors.length) fail('overview: console errors ' + JSON.stringify(errors.slice(0, 2)));
  if (foreign.length) fail('overview: external requests ' + foreign.slice(0, 2).join(' '));
  if (failed.length) fail('overview: failed requests ' + failed.slice(0, 2).join(' '));
  if (overflow) fail('overview: horizontal overflow at 1440');
  await page.screenshot({ path: path.join(ROOT, 'docs', 'screenshot.png') });
  console.log(`  ok   overview (${cards} cards)`);
  await page.close();
}
// demo pages, desktop
for (const key of DEMOS) {
  const { page, errors, foreign, failed, overflow } = await visit(`${key}.html`, 1440, 900);
  const demoLen = await page.evaluate(() => (document.getElementById('demo') || {}).innerHTML?.length || 0);
  const formulas = await page.locator('#theory .katex').count();
  const title = await page.title();
  if (demoLen < 200) fail(`${key}: demo did not render (${demoLen} chars)`);
  if (formulas === 0) fail(`${key}: no typeset formulas in the theory column`);
  if (errors.length) fail(`${key}: console errors ` + JSON.stringify(errors.slice(0, 2)));
  if (foreign.length) fail(`${key}: external requests ` + foreign.slice(0, 2).join(' '));
  if (failed.length) fail(`${key}: failed requests ` + failed.slice(0, 2).join(' '));
  if (overflow) fail(`${key}: horizontal overflow at 1440`);
  await page.screenshot({ path: path.join(ROOT, 'docs', `${key}.png`) });
  console.log(`  ok   ${key.padEnd(10)} ${title} (demo ${demoLen} chars, ${formulas} formulas)`);
  await page.close();
}
// phone width
for (const key of ['', 'attention.html', 'kmeans.html']) {
  const { page, overflow, errors } = await visit(key, 390, 844);
  if (overflow) fail(`${key || 'overview'}: horizontal overflow at 390`);
  if (errors.length) fail(`${key || 'overview'}: console errors at 390 ` + JSON.stringify(errors.slice(0, 2)));
  await page.close();
}
await browser.close();
server.close();
console.log(failures ? `${failures} FAILURE(S)` : `6/6 demos ok, overview ok, 0 console errors, no external requests`);
process.exit(failures ? 1 : 0);
