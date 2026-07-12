# LivingCityEngine

A modular, mobile-first city simulation engine built with **TypeScript**,
**Babylon.js**, and **Vite**.

Project vision and standards live alongside the code:

- [`GAME_DESIGN.md`](GAME_DESIGN.md) — vision, core fantasy, gameplay loop
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system layers and communication rules
- [`ROADMAP.md`](ROADMAP.md) — development phases
- [`AGENTS.md`](AGENTS.md) / [`AI_STUDIO.md`](AI_STUDIO.md) — AI studio workflow and coding rules

## Live preview

Latest `main` build, deployed via GitHub Pages:
**<https://sassydezz.github.io/LivingCityEngine/>** — works on mobile browsers.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed URL. Full instructions, project structure, and
Sprint 1 design decisions: **[docs/SETUP.md](docs/SETUP.md)**.

## Status

**Phase 2 — World Prototype** (current):

- ✅ Procedural island terrain (seeded noise, vertex-color biomes: sand/grass/rock/snow)
- ✅ Animated ocean with GPU wave shader and shoreline transparency
- ✅ Day/night cycle: orbiting sun, moonlit nights, dawn/dusk palettes
- ✅ Gradient sky dome, distance fog, terrain shadows
- ✅ City-builder camera: orbit/pan/zoom with touch + pinch, map bounds
- ✅ Demo URL params: `?tod=` (time of day), `?daylen=`, `?seed=`

**Phase 1 — Foundation** (complete): TypeScript (strict) + Vite,
tree-shaken Babylon.js, layered architecture (`core` / `rendering` /
`world` / `simulation` / `gameplay` / `ui`), `GameEngine` /
`SceneManager` / typed `EventBus`, mobile-first defaults, GitHub Pages
auto-deploy.

No gameplay systems yet — by design. See [`ROADMAP.md`](ROADMAP.md) for what comes next.
