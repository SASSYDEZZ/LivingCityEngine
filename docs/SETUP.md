# LivingCityEngine — Setup Guide

This guide covers getting the project running locally, on a phone for
real-device testing, and building for production.

## Live preview (GitHub Pages)

The latest `main` build is deployed automatically to:

**<https://sassydezz.github.io/LivingCityEngine/>**

Open it in any browser — including a phone — to try the current build
without installing anything.

- Deployment runs via GitHub Actions (`.github/workflows/deploy.yml`)
  on every push to `main`; progress is visible in the repo's
  **Actions** tab, and a deploy typically takes 1–2 minutes.
- A manual re-deploy can be triggered from the Actions tab
  (**Deploy to GitHub Pages → Run workflow**).
- The workflow builds with `VITE_BASE_PATH=/LivingCityEngine/` so asset
  URLs resolve under the github.io sub-path (see `base` in
  `vite.config.ts`). Local `npm run dev` / `npm run preview` are
  unaffected and keep serving from `/`.
- Note: GitHub Pages requires the repository to be public (or a paid
  GitHub plan for private repos).

## Prerequisites

- **Node.js 20+** (developed against Node 22)
- **npm 10+** (bundled with Node)
- A browser with WebGL2 support (all modern desktop and mobile browsers)

## Install

```bash
npm install
```

## Run the dev server

```bash
npm run dev
```

Vite prints a local URL (default `http://localhost:5173`). Open it in a
browser — you should see the world prototype: a procedural island with
an animated ocean, a full day/night cycle, and a city-builder camera.

### Controls

| Input | Action |
| --- | --- |
| Left-drag / one-finger drag | Orbit the camera |
| Mouse wheel / two-finger pinch | Zoom |
| Right-drag / two-finger drag | Pan across the map |

### Building (HUD toolbar at the bottom)

| Action | How |
| --- | --- |
| Place a building | Pick 🏠/🏡, tap the ground to position the ghost, ⟳ to rotate, ✓ to confirm |
| Draw a road | Pick 🛣️, then drag across the ground (snaps to an L-shaped grid path) |
| Demolish | Pick 🚜, tap a building or road cell |
| Exit a tool | ✕ (camera control returns) |

Green highlights mean placeable; red means blocked (water, steep
slopes, high peaks, or occupied cells). While a tool is active the
camera ignores drags so touch input goes to the tool.

### URL parameters (dev/demo)

| Param | Meaning | Example |
| --- | --- | --- |
| `tod` | Starting time of day, 0..1 (0 = midnight, 0.5 = noon) | `?tod=0.75` (sunset) |
| `daylen` | Seconds per full day/night cycle (default 180) | `?daylen=30` |
| `seed` | Terrain generation seed | `?seed=42` |

### Testing on a phone

The dev server listens on all network interfaces (`server.host: true`).
With your phone on the same network, open `http://<your-machine-ip>:5173`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot module reload |
| `npm run build` | Typecheck (strict) then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript compiler with no emit |

A build is only considered good if `npm run build` passes — it runs the
strict typecheck first.

## Project structure

```
index.html              Entry page: fullscreen canvas + viewport/PWA meta
public/                 Static assets served as-is
src/
  main.ts               Bootstrap: wires GameEngine to the DOM
  style.css             Fullscreen canvas + mobile gesture handling
  core/                 Engine lifecycle, scene management, events, config
    GameEngine.ts       Owns the Babylon Engine, render loop, resize
    SceneManager.ts     Registers scenes; one active scene at a time
    IScene.ts           Contract every scene implements
    config/             EngineConfig (pixel-ratio cap, clear color, …)
    events/             Typed EventBus + GameEvents registry
  rendering/            Visuals: scenes, cameras, lighting, materials
    camera/CityCamera.ts     Touch-friendly city-builder camera rig
    scenes/WorldScene.ts     Composes and ticks the world systems
  gameplay/             Player interaction (Phase 3)
    GameplayConfig.ts        Grid/placement tuning data
    grid/BuildGrid.ts        Terrain-aware grid: cells, buildability, occupancy
    buildings/               BuildingCatalog (data) + BuildingFactory (meshes)
    construction/            ConstructionSystem (tools) + GroundPicker
  ui/                   Player interface
    hud/BuildHud.ts          DOM construction toolbar (touch-first)
  world/                The game world
    WorldConfig.ts           All world-generation/environment tuning data
    SeededRandom.ts          Deterministic PRNG for world decoration
    terrain/                 ValueNoise2D + TerrainSystem (procedural island,
                             height/slope sampling, shore mask)
    water/                   OceanSystem (GPU waves, ripples, shoreline foam)
    vegetation/              VegetationSystem (thin-instanced trees/rocks/bushes)
    wildlife/                BirdSystem (ambient gliding birds)
    environment/             DayNightCycle, SkySystem (stars/moon),
                             CloudSystem, EnvironmentSystem
  simulation/           (reserved — Phase 4: citizens, economy, traffic)
  gameplay/             (reserved — Phase 3: buildings, roads, zoning)
  ui/                   (reserved — menus, HUD, touch controls)
docs/                   Project documentation
```

The layer boundaries mirror `ARCHITECTURE.md`. Systems communicate
through the typed `EventBus` (`src/core/events/`) rather than direct
references; every cross-system event is declared in `GameEvents.ts`.

## Mobile performance notes (Sprint 1 decisions)

- **Pixel-ratio cap** — `EngineConfig.maxPixelRatio` (default `2`)
  bounds the render resolution on high-DPR phones via
  `setHardwareScalingLevel`; DPR 3 rendering costs ~2.25× the pixels of
  DPR 2 with little visual gain.
- **Tree-shaken Babylon imports** — all engine code imports from deep
  `@babylonjs/core/...` paths, keeping the vendor chunk at ~324 KB
  gzipped instead of the multi-megabyte full bundle.
- **Vendor chunk splitting** — Babylon.js ships in its own chunk so
  browsers cache it across app updates (`vite.config.ts`).
- **Scene disposal** — `SceneManager` fully disposes the previous scene
  on switch so GPU/CPU memory is reclaimed.
- **Touch-first canvas** — `touch-action: none`, no page scrolling or
  rubber-banding; Babylon receives all gestures.

## Mobile performance notes (world prototype)

- **Static terrain, frozen after build** — one displaced ground mesh
  (~33k triangles at 128 subdivisions), vertex-colored (no textures),
  world matrix and material frozen; zero per-frame CPU cost.
- **GPU-only water animation** — waves are sine displacement in the
  vertex shader; the CPU never touches vertices. No reflection or
  refraction render targets.
- **Shader sky dome** — a two-color gradient shader on one sphere; no
  cube maps or sky textures to download.
- **Single shadow map** — one 1024px map for the sun with terrain
  self-shadowing only; PCF-filtered (WebGL2). Toggleable via
  `WorldConfig.shadowsEnabled`.
- **No per-move picking** — `scene.skipPointerMovePicking` is on until
  gameplay needs hover/tap picking.
- **Thin instances everywhere** — hundreds of trees/rocks/bushes cost 4
  draw calls; all clouds 1; all birds 1. Only trees join the shadow map.
- **Generated shore mask** — foam reads a 129×129 texture built from
  the terrain height grid at startup; nothing is downloaded.
- **Distance-faded water detail** — waves, ripples, and glints fade with
  distance so far water is flat and alias-free.
- All tuning (counts, sizes, day length, shadows) lives in
  `src/world/WorldConfig.ts`; set any count to 0 to disable a system.

## What the world prototype deliberately does NOT include

No gameplay systems: no buildings, citizens, economy, or UI — those
arrive in the phases defined in `ROADMAP.md`. Weather effects and
seasons are Phase 6. PWA packaging (manifest + service worker) is also
deferred; the HTML meta tags are already mobile-app friendly so it can
be layered on without restructuring.
