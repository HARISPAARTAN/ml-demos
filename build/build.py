"""Generates index.html and one page per demo from the manifest below.
Run from the repository root:  python build/build.py
The demo logic lives in js/demos/*.js and is not touched here."""
import pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://harispaartan.github.io/ml-demos/"

DEMOS = [
    {"key": "rag", "file": "rag.html", "title": "RAG document Q&A", "short": "Retrieval-augmented generation",
     "blurb": "Type a question, watch TF-IDF retrieval rank a small knowledge base by cosine similarity, and see an answer grounded in the top passages.",
     "tags": ["TF-IDF", "cosine similarity", "RAG"]},
    {"key": "attention", "file": "attention.html", "title": "Attention visualizer", "short": "Transformer self-attention",
     "blurb": "Type a sentence and see the Q·Kᵀ scores turn into a softmax heatmap, with a causal mask and a temperature control.",
     "tags": ["scaled dot-product attention", "softmax", "causal mask"]},
    {"key": "lora", "file": "lora.html", "title": "LoRA calculator", "short": "Parameter-efficient fine-tuning",
     "blurb": "Pick a model and a rank and see how many parameters LoRA trains and how much GPU memory full fine-tuning, LoRA and QLoRA need.",
     "tags": ["low-rank adapters", "QLoRA", "memory accounting"]},
    {"key": "gradient", "file": "gradient.html", "title": "Gradient descent playground", "short": "Optimisers on a loss surface",
     "blurb": "SGD, momentum and Adam race across a non-convex loss surface while you change the learning rate.",
     "tags": ["SGD", "momentum", "Adam"]},
    {"key": "kmeans", "file": "kmeans.html", "title": "K-means clustering", "short": "Unsupervised segmentation",
     "blurb": "Click to add points or generate blobs, choose k, and step through Lloyd's algorithm with k-means++ initialisation.",
     "tags": ["Lloyd's algorithm", "k-means++", "silhouette"]},
    {"key": "sentiment", "file": "sentiment.html", "title": "Naive Bayes sentiment", "short": "A classifier from scratch",
     "blurb": "A log-odds lexicon classifier with negation handling: every word becomes a chip that shows how it pushed the verdict.",
     "tags": ["Bayes' theorem", "log-odds", "Laplace smoothing"]},
]

SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/></svg>'
LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'

def head(title, description, canonical, katex):
    k = ('\n  <link rel="stylesheet" href="vendor/katex/katex.min.css">' if katex else '')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description)}">
  <link rel="canonical" href="{canonical}">
  <meta name="theme-color" content="#0B0F14">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(description)}">
  <meta property="og:url" content="{canonical}">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/site.css">{k}
  <script>try{{if(localStorage.getItem('hh-theme')==='light')document.documentElement.setAttribute('data-theme','light')}}catch(e){{}}</script>
</head>'''

def header(sub=""):
    return f'''  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <nav class="wrap nav" aria-label="Main">
      <a class="brand" href="./"><span class="mark" aria-hidden="true">ML</span><span>ML demos</span>{f'<small>/ {html.escape(sub)}</small>' if sub else ''}</a>
      <span class="spacer"></span>
      <a class="nav-link portfolio" href="https://harispaartan.github.io/">harispaartan.github.io</a>
      <button id="theme-toggle" class="icon-btn" type="button" aria-pressed="false" aria-label="Switch to light theme" title="Toggle theme">{SUN}</button>
    </nav>
  </header>'''

FOOTER = '''  <footer class="wrap site-footer">
    <span>© 2026 Harithas Harikaran · all demos run in your browser, nothing is sent anywhere</span>
    <span><a href="https://github.com/HARISPAARTAN/ml-demos">Source on GitHub</a></span>
  </footer>'''

def index_page():
    cards = "\n".join(f'''      <a class="card" href="{d["file"]}">
        <span class="num">{i:02d} / {d["short"]}</span>
        <h3>{html.escape(d["title"])}</h3>
        <p>{html.escape(d["blurb"])}</p>
        <span class="tags">{''.join(f'<span>{html.escape(t)}</span>' for t in d["tags"])}</span>
        <span class="cta">Open the demo →</span>
      </a>''' for i, d in enumerate(DEMOS, start=1))
    return f'''{head("ML demos · Harithas Harikaran", "Six small machine-learning demos that run entirely in the browser, each on its own page with the interactive part next to the maths behind it.", SITE, False)}
<body>
{header()}
  <main id="main" class="wrap">
    <section class="hero">
      <p class="eyebrow">// machine learning, in the browser</p>
      <h1>Six small ML demos, each with the maths behind it</h1>
      <p class="lead">Every demo runs <strong>entirely client-side</strong>: the retrieval, the attention weights, the optimiser steps and the clustering are computed in JavaScript as you interact. Each one has its own page with the demo on the left and the theory on the right.</p>
    </section>
    <section class="grid" aria-label="Demos">
{cards}
    </section>
    <section class="section">
      <h2>How it is built</h2>
      <ul>
        <li>Plain HTML, CSS and JavaScript, no framework and no build step for the demos themselves; the pages are generated from one template by a small Python script.</li>
        <li>Each demo is one self-contained module in <code>js/demos/</code> that draws into its page and returns a cleanup function.</li>
        <li>Formulas are typeset with a self-hosted copy of KaTeX; fonts are self-hosted too, so no request leaves the page.</li>
        <li>Light and dark theme, keyboard focus styles and reduced-motion support shared with my portfolio.</li>
      </ul>
    </section>
  </main>
{FOOTER}
  <script src="js/page.js" defer></script>
</body>
</html>
'''

def demo_page(i, d):
    prev = DEMOS[(i - 1) % len(DEMOS)]; nxt = DEMOS[(i + 1) % len(DEMOS)]
    title = f'{d["title"]} · ML demos'
    return f'''{head(title, d["blurb"], SITE + d["file"], True)}
<body data-demo="{d["key"]}">
{header(d["title"])}
  <main id="main" class="wrap">
    <div class="demo-head">
      <div class="intro">
        <p class="eyebrow">{i + 1:02d} / 06 · {html.escape(d["short"])}</p>
        <h1>{html.escape(d["title"])}</h1>
        <p>{html.escape(d["blurb"])}</p>
        <div class="tags">{''.join(f'<span class="tag">{html.escape(t)}</span>' for t in d["tags"])}</div>
      </div>
      <nav class="pager" aria-label="Other demos">
        <a href="{prev["file"]}" rel="prev">{LEFT} {html.escape(prev["title"])}</a>
        <a href="{nxt["file"]}" rel="next">{html.escape(nxt["title"])} {RIGHT}</a>
      </nav>
    </div>
    <div class="layout">
      <section class="panel" aria-labelledby="demo-title">
        <header><b id="demo-title">Interactive demo</b><span class="badge live">runs locally</span></header>
        <div class="inner" id="demo"></div>
      </section>
      <aside class="panel" aria-labelledby="theory-title">
        <header><b id="theory-title">The maths behind it</b><span>theory</span></header>
        <div class="inner" id="theory"></div>
      </aside>
    </div>
  </main>
{FOOTER}
  <script src="vendor/katex/katex.min.js"></script>
  <script src="vendor/katex/contrib/auto-render.min.js"></script>
  <script src="js/demos/{d["key"]}.js"></script>
  <script src="js/page.js"></script>
</body>
</html>
'''

(ROOT / "index.html").write_text(index_page(), encoding="utf-8")
for i, d in enumerate(DEMOS):
    (ROOT / d["file"]).write_text(demo_page(i, d), encoding="utf-8")
print("wrote index.html and", len(DEMOS), "demo pages")
