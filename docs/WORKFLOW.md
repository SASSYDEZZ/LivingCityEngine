# LivingCityEngine — Team Workflow & Quality Standards

Established by the Game Director after Sprint 3. These are binding
development standards for all contributors, human and AI.

---

## Team Roles

| Role | Who | Responsibilities |
| --- | --- | --- |
| **Game Director** | Human founder | Final creative decisions, milestone approval, feature priorities, release decisions |
| **Creative Director / Technical Reviewer / Product Planner** | ChatGPT | Vision consistency, design direction, technical review, sprint planning |
| **Lead Engine Programmer** | Claude (Claude Code) | Implementation, optimization, documentation, GitHub workflow, deployment |

---

## Sprint Cycle

1. The Game Director approves sprint objectives before work begins.
2. The Lead Engine Programmer implements, verifies, documents, and
   deploys the sprint.
3. **Every sprint ends with a milestone review** (deployment status,
   build verification, architecture review, performance, technical
   debt, completion state) before the next sprint begins.
4. The Game Director approves the milestone; only then does the next
   sprint start.

Sprint bookkeeping lives in `TASKS.md`; a milestone screenshot goes in
`docs/progress/` (e.g. `v0.3.0-construction.png`) and the version in
`package.json` is bumped per milestone.

---

## Feature Quality Gates

A feature is only **complete** when it:

1. **Works correctly** — exercised end-to-end, not just compiled.
2. **Feels polished and intuitive** — no placeholder friction in the
   player-facing path.
3. **Maintains excellent mobile performance** — draw calls, bundle
   size, and per-frame cost are accounted for.
4. **Fits the game's visual style** — cozy, vibrant, stylized;
   consistent with the existing world.
5. **Preserves clean architecture** — correct layer, data-driven,
   events for cross-system communication (see `ARCHITECTURE.md`).
6. **Is documented** — `docs/SETUP.md` / `TASKS.md` / code comments
   updated in the same change.
7. **Is deployed to the live preview** — the GitHub Pages deployment
   succeeded and reflects the change.

A feature failing any gate is *in progress*, not done.

---

## Engineering Conventions (summary)

- Development happens on `main`; every push auto-deploys to
  GitHub Pages (`.github/workflows/deploy.yml`).
- `npm run build` (strict typecheck + production build) must pass
  before every commit.
- Visual/interactive changes are verified headless in Chromium
  (screenshots at relevant times of day / viewports) before pushing.
- No downloaded runtime assets: geometry, colors, and textures are
  generated procedurally; UI icons are emoji.
- All tuning values live in config files (`WorldConfig`,
  `GameplayConfig`), never hardcoded in systems.
