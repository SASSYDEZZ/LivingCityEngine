import { GameEngine } from './core/GameEngine';
import { WorldScene } from './rendering/scenes/WorldScene';
import type { WorldConfig } from './world/WorldConfig';

/**
 * Application entry point: wire the engine to the DOM and boot the
 * initial scene. All real behavior lives in the engine layers.
 */
async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('render-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('LivingCityEngine: #render-canvas element not found');
  }

  const engine = new GameEngine(canvas);
  engine.registerScene(new WorldScene(worldOverridesFromQuery()));
  await engine.start('world');

  // Expose a dispose hook for HMR so dev reloads don't leak WebGL contexts.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => engine.dispose());
  }
}

/**
 * Dev/demo overrides via URL, e.g. `?tod=0.8&daylen=30&seed=42`
 * (tod: 0..1 time of day, daylen: seconds per full day, seed: terrain).
 */
function worldOverridesFromQuery(): Partial<WorldConfig> {
  const params = new URLSearchParams(window.location.search);
  const overrides: { -readonly [K in keyof WorldConfig]?: WorldConfig[K] } = {};

  const tod = Number(params.get('tod'));
  if (params.has('tod') && Number.isFinite(tod)) {
    overrides.initialTimeOfDay = tod;
  }
  const dayLength = Number(params.get('daylen'));
  if (params.has('daylen') && Number.isFinite(dayLength) && dayLength > 0) {
    overrides.dayLengthSeconds = dayLength;
  }
  const seed = Number(params.get('seed'));
  if (params.has('seed') && Number.isFinite(seed)) {
    overrides.seed = seed;
  }
  return overrides;
}

bootstrap().catch((error) => {
  console.error('LivingCityEngine failed to start:', error);
});
