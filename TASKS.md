# LivingCityEngine — Task Board

Living document tracking sprint work. Update this file whenever tasks
start, finish, or get discovered. Phases refer to `ROADMAP.md`.

Last updated: 2026-07-12

---

## Current sprint

**Sprint 4 — Phase A–C: Road Network v2 (v0.4.0)** — complete.

Goal: transform placeholder road slabs into a polished, continuous,
citizen-ready road network. ✅

Next up: Sprint 4 continues — City Simulation (Phase 4): citizens,
homes, jobs, needs, economy (building on the RoadNetwork graph).

---

## Completed tasks

### Sprint 4 Phase A–C — Road Network v2 (v0.4.0)

- [x] Six auto-connecting piece types via neighbor bitmask (isolated/end/straight/corner/tee/cross) (`gameplay/roads/RoadPieces.ts`)
- [x] `RoadRenderer`: cell→instance map, refreshes placed cells + neighbors on every change (`gameplay/roads/RoadRenderer.ts`)
- [x] Sidewalks on open edges, crosswalk corner nubs at junctions, dashed lane markings
- [x] Terrain conformity: smoothed-gradient tilt per piece, deep slabs with earth embankment sides
- [x] Roads pass through existing roads — crossings and extensions just work
- [x] Ribbon drag preview (continuous band + endpoint dots) with red tiles on blockers
- [x] Staggered pop-in animation along committed paths
- [x] `audio:cue` event hooks (place/demolish/road/invalid) for the future AudioSystem
- [x] `RoadNetwork` graph: neighbors, connectivity, BFS shortest path — dependency-free, 9 logic tests pass
- [x] Workflow standards recorded: `docs/WORKFLOW.md` + AGENTS.md quality gates

---

## Completed tasks (earlier sprints)

### Sprint 3 — Construction System (v0.3.0)

- [x] Terrain-aware `BuildGrid`: precomputed buildability (height band + slope), occupancy map
- [x] Ghost building preview following taps/hover, snapped to the grid
- [x] Valid/invalid highlighting: tinted ghost + per-cell footprint tiles
- [x] Building rotation (⟳), footprint-aware for rectangular buildings
- [x] Road drawing with L-shaped snapping and live path preview
- [x] Bulldozer with shrink-out animation for buildings and road cells
- [x] Pop-in (ease-out-back) build animation
- [x] Vegetation auto-clears under new buildings/roads (`clearArea`)
- [x] Data-driven `BuildingCatalog` (house, cabin) + procedural `BuildingFactory` meshes
- [x] Touch-first DOM HUD: tool select, rotate/confirm/cancel, active states, safe-area
- [x] Heightfield `GroundPicker` (no mesh picking) for cheap tap→ground on mobile
- [x] EventBus in real use: building:placed/removed, road:placed/removed, construction:*
- [x] End-to-end flow verified headless (place, rotate, road drag, bulldoze) with no console errors

### Sprint 2 — Living World (v0.2.0)

- [x] Instanced vegetation: clustered forests (round + pine), rocks, bushes — 4 draw calls (`world/vegetation/`)
- [x] Terrain height/slope sampling API for placement (`TerrainSystem.sampleHeight/sampleSlope`)
- [x] Shoreline foam driven by a generated shore-mask texture; animated, dims at night
- [x] Water polish: per-pixel ripples, distance-faded waves/glints (anti-moiré)
- [x] Drifting clouds (thin-instanced, tinted by time of day) (`CloudSystem`)
- [x] Night sky: procedural starfield + low visible moon (`SkySystem`)
- [x] Ambient birds gliding over the island by day (`world/wildlife/BirdSystem`)
- [x] Warm cozy palette pass: terrain, sky, fog, tropical water
- [x] Milestone screenshots in `docs/progress/`; version bumped to 0.2.0

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

### Construction polish (as needed)

- [ ] Terrain flattening under buildings/roads on slopes (steepest cells can show slivers at seams)
- [ ] Save/load of placed buildings and roads
- [ ] Two-finger camera pan while a tool is active
- [ ] Curved corner road geometry (arc instead of square bend)
- [ ] Bridges (road cells over water with deck height + pylons)

### World polish (long-term visual goals)

- [ ] Touch control tuning on real devices (pan/pinch feel)
- [ ] Terrain variety: ridges, valleys, natural clearings
- [ ] Richer biome transitions and color blending
- [ ] Coastline detail (rocks, reeds, driftwood, flowers)
- [ ] More organic forests (dense clusters, clearings, varied spacing)
- [ ] Ambient motion: wind, tree sway, grass movement
- [ ] Weather foundation (effects are Phase 6)
- [ ] Game speed controls for the day/night clock
- [ ] Camera-terrain collision (camera can clip into hills at min zoom)

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
