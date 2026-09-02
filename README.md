# ZigFlames — artist site

Static site for **ZigFlames** (producer/composer). Plain HTML, CSS, and JS. No build step, no paid hosting required.

## Open locally

From this folder:

```bash
# simplest — double-click index.html, or:
open index.html
```

Or serve it (keeps paths and fonts happy):

```bash
# Python 3
python3 -m http.server 8080

# then visit http://localhost:8080
```

Any static server works (`npx serve`, Caddy, nginx). There is no Node compile step.

## Put it on GitHub Pages (free)

1. Create a GitHub repository (public is fine for a free Pages site).
2. Upload everything in this folder to the repo root — `index.html` must sit at the root of the branch GitHub Pages uses.
3. In the repo: **Settings → Pages → Build and deployment**.
4. Source: **Deploy from a branch**. Branch: `main` (or `master`). Folder: `/ (root)`.
5. Save. GitHub will publish at `https://<username>.github.io/<repo>/`.

Custom domain later:

- In Pages settings, add `zigflames.com` (and `www` if you want it).
- GitHub will show the records to create (usually an `A` record set and/or a `CNAME`).

## Domain note — zigflames.com

**zigflames.com is currently a Squarespace parking page.** This repo is not connected to that domain yet. DNS will need to be pointed later (away from Squarespace, toward GitHub Pages or another static host). Until then, the site can live on the free GitHub Pages URL.

Contact: [artist@zigflames.com](mailto:artist@zigflames.com)
