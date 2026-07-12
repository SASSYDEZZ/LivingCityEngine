import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';

import type { IScene, SceneContext } from '../../core/IScene';
import { CloudSystem } from '../../world/environment/CloudSystem';
import { DayNightCycle } from '../../world/environment/DayNightCycle';
import { EnvironmentSystem } from '../../world/environment/EnvironmentSystem';
import { TerrainSystem } from '../../world/terrain/TerrainSystem';
import { VegetationSystem } from '../../world/vegetation/VegetationSystem';
import { OceanSystem } from '../../world/water/OceanSystem';
import { BirdSystem } from '../../world/wildlife/BirdSystem';
import { DEFAULT_WORLD_CONFIG, type WorldConfig } from '../../world/WorldConfig';
import { CityCamera } from '../camera/CityCamera';

/**
 * The living world: a procedural island with vegetation, animated
 * ocean, drifting clouds, ambient birds, and a full day/night cycle.
 * No gameplay systems yet — this scene is the canvas that Phase 3
 * construction will build on.
 *
 * The scene only composes and ticks the world systems; all behavior
 * lives in the systems themselves (see ARCHITECTURE.md).
 */
export class WorldScene implements IScene {
  readonly key = 'world';

  private readonly config: WorldConfig;
  private readonly terrain: TerrainSystem;
  private readonly vegetation: VegetationSystem;
  private readonly ocean: OceanSystem;
  private readonly environment: EnvironmentSystem;
  private readonly clouds: CloudSystem;
  private readonly birds: BirdSystem;
  private readonly dayNight: DayNightCycle;
  private readonly camera = new CityCamera();

  constructor(configOverrides: Partial<WorldConfig> = {}) {
    this.config = { ...DEFAULT_WORLD_CONFIG, ...configOverrides };
    this.terrain = new TerrainSystem(this.config);
    this.vegetation = new VegetationSystem(this.config);
    this.ocean = new OceanSystem(this.config);
    this.environment = new EnvironmentSystem(this.config);
    this.clouds = new CloudSystem(this.config);
    this.birds = new BirdSystem(this.config);
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
    const vegetationCasters = this.vegetation.build(scene, this.terrain);
    this.ocean.build(scene, this.terrain);
    this.clouds.build(scene);
    this.birds.build(scene);
    // Terrain and trees cast shadows onto the terrain.
    this.environment.build(scene, [terrainMesh, ...vegetationCasters]);

    // Apply the initial time of day before the first frame renders.
    this.environment.update(this.dayNight.timeOfDay, this.dayNight.sunElevation);

    return scene;
  }

  update(deltaSeconds: number): void {
    this.dayNight.update(deltaSeconds);
    this.environment.update(this.dayNight.timeOfDay, this.dayNight.sunElevation, deltaSeconds);
    this.camera.update();
    this.clouds.update(deltaSeconds, this.environment.cloudColor);
    this.birds.update(deltaSeconds, this.environment.dayFactor);
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
    this.birds.dispose();
    this.clouds.dispose();
    this.ocean.dispose();
    this.environment.dispose();
    this.vegetation.dispose();
    this.terrain.dispose();
    this.camera.dispose();
  }
}
