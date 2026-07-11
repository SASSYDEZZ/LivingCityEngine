# LivingCityEngine — Task Board

Living document tracking sprint work. Update this file whenever tasks
start, finish, or get discovered. Phases refer to `ROADMAP.md`.

Last updated: 2026-07-11

---

## Current sprint

**Sprint 2 — World Prototype (Phase 2)** — not yet started, next up.

Goal: a beautiful empty world that can be explored on a phone.

Sprint 1 (Foundation, Phase 1) is complete — see below.

---

## Completed tasks

### Sprint 1 — Foundation (Phase 1)

- [x] TypeScript (strict) + Vite project setup with dev/build/preview/typecheck scripts
- [x] Babylon.js integration via tree-shaken deep imports (~324 KB gzipped vendor chunk)
- [x] Layered folder structure: `core` / `rendering` / `world` / `simulation` / `gameplay` / `ui`
- [x] Core layer: `GameEngine` lifecycle, `SceneManager`, typed `EventBus` + `GameEvents` registry, `EngineConfig`
- [x] First runnable scene (`SandboxScene`): orbit/touch camera, lighting, ground, placeholder blocks
- [x] Mobile-first defaults: pixel-ratio cap (DPR ≤ 2), fullscreen `touch-action: none` canvas
- [x] Setup documentation (`docs/SETUP.md`) and repository `README.md`
- [x] GitHub Pages deployment workflow (`.github/workflows/deploy.yml`), auto-deploys `main`
- [x] Live preview verified: <https://sassydezz.github.io/LivingCityEngine/>

---

## In progress tasks

*(none — between sprints)*

---

## Upcoming tasks

### Sprint 2 — World Prototype (Phase 2)

- [ ] Procedural terrain generation
- [ ] Ocean/water system
- [ ] Day/night cycle
- [ ] Time system (game clock, speed controls)
- [ ] Weather foundation
- [ ] Camera movement polish (bounds, inertia, mobile tuning)
- [ ] Touch control refinement on real devices

### Later phases (see ROADMAP.md)

- Phase 3 — Construction: grid system, building placement, roads, bulldozer
- Phase 4 — City simulation: citizens, homes, jobs, needs, economy
- Phase 1 leftover: PWA packaging (manifest + service worker) — deferred from Sprint 1

---

## Bugs / issues

*(no known bugs)*

- **Note (CI, cosmetic):** GitHub Actions warns that `actions/checkout@v4`,
  `setup-node@v4`, and `configure-pages@v5` target Node 20, which runners
  are deprecating. Harmless today; bump to the next major versions of
  these actions when available.
- **Note (infra):** first-time GitHub Pages enablement had to be done
  manually in repo Settings → Pages → Source: "GitHub Actions" (the
  workflow token cannot create the Pages site on user repos). Already
  done — only relevant if the repo is ever recreated.
