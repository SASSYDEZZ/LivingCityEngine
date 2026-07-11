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

**Sprint 1 — Foundation** (Phase 1 of the roadmap):

- ✅ TypeScript (strict) + Vite project setup
- ✅ Babylon.js integration with tree-shaken imports
- ✅ Layered folder structure (`core` / `rendering` / `world` / `simulation` / `gameplay` / `ui`)
- ✅ Engine lifecycle: `GameEngine`, `SceneManager`, typed `EventBus`
- ✅ First runnable scene (`SandboxScene`) with orbit/touch camera
- ✅ Mobile-first defaults: pixel-ratio cap, fullscreen touch canvas

No gameplay systems yet — by design. See [`ROADMAP.md`](ROADMAP.md) for what comes next.
