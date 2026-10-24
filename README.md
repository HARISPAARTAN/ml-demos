# ML demos in the browser

Six small machine-learning demos that run entirely client-side, each paired with the maths behind it. No server, no build step, no tracking.

Live: https://harispaartan.github.io/ml-demos/ · part of https://harispaartan.github.io/

![The projects grid with six demo cards](docs/screenshot.png)

| Demo | What it shows | Maths in the theory tab |
|---|---|---|
| RAG Document Q&A | TF-IDF retrieval over a small knowledge base, then an answer grounded in the retrieved passages | TF-IDF, cosine similarity, RAG marginalisation |
| Attention Visualizer | A live Q·Kᵀ softmax heatmap for a sentence you type, with causal mask and temperature controls | scaled dot-product attention, softmax, positional encoding |
| LoRA Calculator | Trainable parameters and GPU memory for Llama- and Mistral-class models as you move the rank slider, with a QLoRA toggle | low-rank decomposition ΔW = BA, optimiser memory accounting |
| Gradient Descent Playground | SGD, momentum and Adam racing on a non-convex loss surface with a live learning rate | update rules, bias correction, non-convex optimisation |
| K-Means Segmentation | Click to add points, then step through Lloyd's algorithm with k-means++ initialisation | WCSS objective, convergence, silhouette score |
| Naive Bayes Sentiment | A from-scratch classifier with per-word log-odds chips and negation handling | Bayes' theorem, log-odds, Laplace smoothing |

## Run locally

Any static file server works:

```bash
python -m http.server 8000
# open http://localhost:8000
```

## How it is built

- `index.html` holds the page and the modal; `css/style.css` the terminal-style theme.
- `js/main.js` opens a demo in the modal and renders the formulas; each file in `js/demos/` is one self-contained demo that registers itself into `window.DEMOS`.
- The formulas are typeset with KaTeX, loaded from the jsDelivr CDN. That is the only request that leaves the page.

## Status

Verified on 2026-10-24 with `node tests/smoke.mjs` on Google Chrome: all six demos open, render their demo and theory tabs, and close again; 0 console errors. The smoke test needs Node, Chrome and a Playwright package that Node can resolve; the page itself has no dependencies.

## Licence

MIT, see `LICENSE`.
