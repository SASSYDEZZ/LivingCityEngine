# LivingCityEngine — Task Board

Living document tracking sprint work. Update this file whenever tasks
start, finish, or get discovered. Phases refer to `ROADMAP.md`.

Last updated: 2026-07-12

---

## Current sprint

**Sprint 2 — World Prototype (Phase 2)** — core goals complete.

Goal: a beautiful empty world that can be explored on a phone. ✅

Next up: Sprint 3 — Construction System (Phase 3).

---

## Completed tasks

### Sprint 2 — World Prototype (Phase 2)

- [x] Procedural terrain: seeded value-noise fBm island with radial falloff (`world/terrain/`)
- [x] Vertex-color biomes: seabed, sand shoreline band, tinted grass, slope rock, snow caps
- [x] Animated ocean: GPU sine-wave vertex shader, fresnel + sun glints, fog convergence (`world/water/`)
- [x] Seafloor plane for a consistent underwater background (no rim silhouettes)
- [x] Day/night cycle: normalized game clock, orbiting sun, cool moonlight at night (`world/environment/`)
- [x] Gradient sky dome shader with sun disc and horizon fog band
- [x] Directional sunlight + PCF shadow map (terrain self-shadowing), palette-blended fog
- [x] City-builder camera rig: map panning, pinch zoom, zoom-scaled pan speed, island bounds
- [x] Demo URL params (`?tod=`, `?daylen=`, `?seed=`) for testing times of day and seeds
- [x] Visual verification at day/dusk/night in desktop + mobile viewports (no console errors)

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

### Sprint 2 polish (optional, as needed)

- [ ] Touch control tuning on real devices (pan/pinch feel)
- [ ] Weather foundation (Phase 2 stretch; effects are Phase 6)
- [ ] Game speed controls for the day/night clock

### Sprint 3 — Construction System (Phase 3)

- [ ] Grid system over the terrain
- [ ] Building placement + validity rules
- [ ] Roads
- [ ] Bulldozer
- [ ] Construction animations

### Later phases (see ROADMAP.md)

- Phase 4 — City simulation: citizens, homes, jobs, needs, economy
- Phase 1 leftover: PWA packaging (manifest + service worker)

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
