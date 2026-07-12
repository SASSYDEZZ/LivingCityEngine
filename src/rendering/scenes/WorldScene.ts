import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';

import type { IScene, SceneContext } from '../../core/IScene';
import { DayNightCycle } from '../../world/environment/DayNightCycle';
import { EnvironmentSystem } from '../../world/environment/EnvironmentSystem';
import { TerrainSystem } from '../../world/terrain/TerrainSystem';
import { OceanSystem } from '../../world/water/OceanSystem';
import { DEFAULT_WORLD_CONFIG, type WorldConfig } from '../../world/WorldConfig';
import { CityCamera } from '../camera/CityCamera';

/**
 * Phase 2 world prototype: a procedural island with an animated ocean,
 * day/night cycle, and city-builder camera. No gameplay systems yet —
 * this scene is the canvas that Phase 3 construction will build on.
 *
 * The scene only composes and ticks the world systems; all behavior
 * lives in the systems themselves (see ARCHITECTURE.md).
 */
export class WorldScene implements IScene {
  readonly key = 'world';

  private readonly config: WorldConfig;
  private readonly terrain: TerrainSystem;
  private readonly ocean: OceanSystem;
  private readonly environment: EnvironmentSystem;
  private readonly dayNight: DayNightCycle;
  private readonly camera = new CityCamera();

  constructor(configOverrides: Partial<WorldConfig> = {}) {
    this.config = { ...DEFAULT_WORLD_CONFIG, ...configOverrides };
    this.terrain = new TerrainSystem(this.config);
    this.ocean = new OceanSystem(this.config);
    this.environment = new EnvironmentSystem(this.config);
    this.dayNight = new DayNightCycle(this.config.dayLengthSeconds, this.config.initialTimeOfDay);
  }

  create(context: SceneContext): Scene {
    const { engine, canvas, config } = context;

    const scene = new Scene(engine);
    scene.clearColor = new Color4(config.clearColor.r, config.clearColor.g, config.clearColor.b, 1);
    // Nothing is clickable yet; skip per-move picking work on mobile.
    scene.skipPointerMovePicking = true;

    this.camera.build(scene, canvas);
    this.camera.setBounds(this.terrain.bounds);

    const terrainMesh = this.terrain.build(scene);
    this.ocean.build(scene);
    // Terrain casts onto itself: hills throw long shadows at dawn/dusk.
    this.environment.build(scene, [terrainMesh]);

    // Apply the initial time of day before the first frame renders.
    this.environment.update(this.dayNight.timeOfDay, this.dayNight.sunElevation);

    return scene;
  }

  update(deltaSeconds: number): void {
    this.dayNight.update(deltaSeconds);
    this.environment.update(this.dayNight.timeOfDay, this.dayNight.sunElevation);
    this.camera.update();
    this.ocean.update(
      deltaSeconds,
      this.camera.position,
      this.environment.sunDirection,
      this.environment.sunColor,
      this.environment.waterDeepColor,
      this.environment.waterShallowColor,
      this.environment.fogColor,
      this.environment.fogDensity,
    );
  }

  dispose(): void {
    this.ocean.dispose();
    this.environment.dispose();
    this.terrain.dispose();
    this.camera.dispose();
  }
}
