# Deploying Orrery to dennisgavrilenko.com/projects/eclipse

## Push-to-deploy (the normal path)

Every push to `main` on GitHub (https://github.com/dennisg009/eclipse) builds
and deploys automatically via `.github/workflows/deploy.yml`. It needs one repo
secret: `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with the
**Account · Cloudflare Pages · Edit** permission. The manual steps below remain
valid as a fallback and for first-time setup.

This follows the same front-door pattern as InfoGlobe: a Vite SPA built with a
`/projects/eclipse/` base, deployed to its own Cloudflare Pages project, with the
existing `dg-router` Worker routing `/projects/eclipse/*` to it.

There is **no backend** — all computation (Kepler propagation, astronomy-engine
eclipse search, rendering) runs in the browser. No Pages Functions, no D1, no
secrets.

## 1. Build

```bash
npm install
npm run build            # outputs dist/ with base /projects/eclipse/
```

Override the base for a different mount (e.g. a subdomain): `ECLIPSE_BASE=/ npm run build`.

## 2. Deploy the Pages project

```bash
# one-time
wrangler pages project create eclipse --production-branch=main

# each deploy
wrangler pages deploy dist --project-name=eclipse
```

This publishes to **`https://eclipse-75h.pages.dev/`** — Cloudflare appended a
suffix because the bare `eclipse` subdomain was unavailable. Use this exact host
in the router below (and for any future redeploys; the project name is still
`eclipse`).

## 3. Wire up the front-door Worker

Edit the router Worker at `/Users/a19254/Projects/InfoGlobe/cloudflare/router-worker.js`
and add one line to `PROJECTS`:

```js
const PROJECTS = {
  globe: 'https://infoglobe.pages.dev',
  eclipse: 'https://eclipse-75h.pages.dev'   // <-- add (note the -75h suffix)
}
```

Redeploy it (the route `dennisgavrilenko.com/projects/*` is already bound to it;
apex, `/mechanize/`, `/r/*` are untouched):

```bash
cd /Users/a19254/Projects/InfoGlobe
wrangler deploy cloudflare/router-worker.js --name dg-router --compatibility-date 2026-06-09
```

The `--compatibility-date` flag is required (there's no wrangler.toml for this
Worker). Redeploying the code preserves the existing `dennisgavrilenko.com/projects/*`
route trigger.

## 4. Verify

Open `https://dennisgavrilenko.com/projects/eclipse/`. Confirm the orrery loads,
"Find next eclipse" cuts to a ground-POV totality, and `/projects/globe/` +
`/mechanize/` still work.

## Local dev

```bash
npm run dev              # http://localhost:5174/projects/eclipse/
node scripts/smoke.mjs   # headless browser smoke test (needs Chrome)
```
