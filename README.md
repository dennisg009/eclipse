# Orrery — Solar System & Total Solar Eclipse Predictor

A from-first-principles orrery that propagates the planets by solving Kepler's
equation from J2000 orbital elements, finds real **total solar eclipses** by
scanning new moons, and cuts to a ground-level point of view to watch totality —
corona and all — at the place and time it actually happens.

Live: https://dennisgavrilenko.com/projects/eclipse

## What it does

- **Orrery** — top-down solar system. Planet positions come from Newton–Raphson
  solutions of Kepler's equation (`src/physics/kepler.js`), shown live in the
  computation log. The Moon uses mean elements plus the main perturbations
  (evection, variation, annual equation).
- **Eclipse search** — `⏭ Find next eclipse` races the clock forward and locks
  onto the next total solar eclipse.
- **Ground POV** — stand at the path of totality and watch the partial phases,
  the sky darken, and the corona blaze at totality.
- **Earth path** (bonus) — a 3D globe with the path of totality drawn on it and
  the umbra sweeping across at the real times.

## Accuracy

Eclipse dates/times, totality paths, and the ground geometry are computed with
[`astronomy-engine`](https://github.com/cosinekitty/astronomy) (VSOP87 +
NOVAS-grade models) — verified against published events (e.g. 2026-08-12 over
Iceland/Spain, 2027-08-02 over Egypt). The Kepler engine drives the orrery
visuals and the on-screen math; it agrees with astronomy-engine to a fraction of
a degree.

## Develop

```bash
npm install
npm run dev          # http://localhost:5174/projects/eclipse/
npm run build
```

See [DEPLOY.md](DEPLOY.md) for deployment.

## Stack

Vite · Three.js (3D views) · 2D canvas (orrery) · astronomy-engine · no backend.
