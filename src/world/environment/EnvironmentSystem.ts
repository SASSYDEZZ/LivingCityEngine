import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
// Side-effect import: registers the scene component that renders shadow maps.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';

import type { WorldConfig } from '../WorldConfig';
import { SkySystem } from './SkySystem';

/** Palette for one lighting state; blended by sun elevation. */
interface AtmospherePalette {
  readonly zenith: Color3;
  readonly horizon: Color3;
  readonly sun: Color3;
  readonly fog: Color3;
}

// Cozy stylized palettes: saturated day, golden twilight, indigo night.
const DAY: AtmospherePalette = {
  zenith: new Color3(0.25, 0.52, 0.88),
  horizon: new Color3(0.74, 0.86, 0.95),
  sun: new Color3(1.0, 0.95, 0.8),
  fog: new Color3(0.75, 0.85, 0.93),
};

const TWILIGHT: AtmospherePalette = {
  zenith: new Color3(0.24, 0.2, 0.44),
  horizon: new Color3(0.99, 0.58, 0.33),
  sun: new Color3(1.0, 0.52, 0.2),
  fog: new Color3(0.62, 0.45, 0.46),
};

const NIGHT: AtmospherePalette = {
  zenith: new Color3(0.02, 0.035, 0.1),
  horizon: new Color3(0.08, 0.11, 0.19),
  sun: new Color3(0, 0, 0),
  fog: new Color3(0.06, 0.08, 0.13),
};

// Tropical, inviting water.
const WATER_DEEP_BASE = new Color3(0.04, 0.26, 0.38);
const WATER_SHALLOW_BASE = new Color3(0.16, 0.55, 0.58);

// Cloud tints per lighting state (emissive, unlit).
const CLOUD_DAY = new Color3(0.98, 0.99, 1.0);
const CLOUD_TWILIGHT = new Color3(1.0, 0.72, 0.58);
const CLOUD_NIGHT = new Color3(0.16, 0.19, 0.28);

/**
 * Sky, sunlight, ambient light, shadows, and fog — everything that
 * makes the world's atmosphere. Driven each frame by the time of day
 * from `DayNightCycle`: the sun orbits the island, and all colors
 * blend between night / twilight / day palettes by sun elevation.
 */
export class EnvironmentSystem {
  private sun: DirectionalLight | null = null;
  private ambient: HemisphericLight | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private readonly sky = new SkySystem();
  private scene: Scene | null = null;

  // Current-frame values, exposed to other systems (ocean, clouds, birds).
  readonly sunDirection = new Vector3(0, -1, 0);
  readonly moonDirection = new Vector3(0, -1, 0);
  readonly sunColor = new Color3(1, 1, 1);
  readonly fogColor = new Color3(0, 0, 0);
  readonly waterDeepColor = new Color3(0, 0, 0);
  readonly waterShallowColor = new Color3(0, 0, 0);
  readonly cloudColor = new Color3(1, 1, 1);
  /** 1 at deep night, 0 by day — drives stars/moon. */
  nightFactor = 0;
  /** 1 by day, 0 at deep night — drives birds. */
  dayFactor = 1;
  fogDensity = 0.0018;
  private elapsedSeconds = 0;

  constructor(private readonly config: WorldConfig) {}

  build(scene: Scene, shadowCasters: Mesh[]): void {
    this.scene = scene;

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    this.ambient.groundColor = new Color3(0.1, 0.11, 0.13);

    this.sun = new DirectionalLight('sun', this.sunDirection, scene);
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 600;

    if (this.config.shadowsEnabled) {
      const generator = new ShadowGenerator(this.config.shadowMapSize, this.sun);
      generator.usePercentageCloserFiltering = true; // soft edges, WebGL2
      // Generous biases: the only caster is the terrain itself, and
      // low-angle sun over smooth slopes is prone to acne speckles.
      generator.bias = 0.006;
      generator.normalBias = 0.06;
      for (const caster of shadowCasters) {
        generator.addShadowCaster(caster);
      }
      this.shadowGenerator = generator;
    }

    this.sky.build(scene);

    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = this.fogDensity;
  }

  /** Advance the atmosphere to the given time of day (0..1). */
  update(timeOfDay: number, sunElevation: number, deltaSeconds = 0): void {
    if (!this.sun || !this.ambient || !this.scene) {
      return;
    }
    this.elapsedSeconds += deltaSeconds;

    // Sun position on its orbit: elevation from the day cycle, azimuth
    // sweeping a full circle per day. Peak elevation is capped (~61°)
    // so even noon light stays directional and terrain relief reads.
    const elevationAngle = sunElevation * Math.PI * 0.34;
    const azimuth = timeOfDay * Math.PI * 2;
    const cosE = Math.cos(elevationAngle);
    this.sunDirection
      .set(-cosE * Math.cos(azimuth), -Math.sin(elevationAngle), -cosE * Math.sin(azimuth))
      .normalize();
    // Visual moon position: opposite azimuth from the sun but held low
    // over the horizon (~14°) so it's actually visible in the game's
    // downward-tilted framing. Moonlight direction is handled
    // separately below and stays high for pleasant illumination.
    const moonAzimuth = azimuth + Math.PI;
    const moonElevation = Math.PI * 0.078;
    const cosM = Math.cos(moonElevation);
    this.moonDirection
      .set(-cosM * Math.cos(moonAzimuth), -Math.sin(moonElevation), -cosM * Math.sin(moonAzimuth))
      .normalize();

    // Palette weights from sun elevation: night below the horizon,
    // twilight around it, day above.
    const dayW = smoothstep(0.06, 0.35, sunElevation);
    const nightW = smoothstep(0.1, 0.32, -sunElevation);
    const twilightW = Math.max(0, 1 - dayW - nightW);
    this.nightFactor = nightW;
    this.dayFactor = dayW;

    const zenith = blend3(NIGHT.zenith, TWILIGHT.zenith, DAY.zenith, nightW, twilightW, dayW);
    const horizon = blend3(NIGHT.horizon, TWILIGHT.horizon, DAY.horizon, nightW, twilightW, dayW);
    blend3Into(this.sunColor, NIGHT.sun, TWILIGHT.sun, DAY.sun, nightW, twilightW, dayW);
    blend3Into(this.fogColor, NIGHT.fog, TWILIGHT.fog, DAY.fog, nightW, twilightW, dayW);

    // Key light: the sun by day, a dim cool moon by night (opposite
    // side of the sky), so the world is never a black void.
    const sunIntensity = 1.35 * smoothstep(0.0, 0.28, sunElevation);
    const moonIntensity = 0.22 * nightW;
    if (moonIntensity > sunIntensity) {
      this.sunDirection.scaleInPlace(-1);
      this.sunColor.set(0.45, 0.55, 0.8);
      this.sun.intensity = moonIntensity;
    } else {
      this.sun.intensity = sunIntensity;
    }
    this.sun.direction = this.sunDirection;
    this.sun.position = this.sunDirection.scale(-300);
    this.sun.diffuse = this.sunColor;

    this.ambient.intensity = 0.2 + 0.32 * smoothstep(-0.12, 0.3, sunElevation);
    this.ambient.diffuse = horizon;

    // Water palette: base colors dimmed by available light.
    const brightness = 0.12 + 0.88 * smoothstep(-0.05, 0.3, sunElevation);
    this.waterDeepColor.set(
      WATER_DEEP_BASE.r * brightness,
      WATER_DEEP_BASE.g * brightness,
      WATER_DEEP_BASE.b * brightness,
    );
    this.waterShallowColor.set(
      WATER_SHALLOW_BASE.r * brightness,
      WATER_SHALLOW_BASE.g * brightness,
      WATER_SHALLOW_BASE.b * brightness,
    );

    blend3Into(this.cloudColor, CLOUD_NIGHT, CLOUD_TWILIGHT, CLOUD_DAY, nightW, twilightW, dayW);

    this.scene.fogColor = this.fogColor;
    this.sky.setAtmosphere(
      zenith,
      horizon,
      this.sunDirection,
      this.sunColor,
      this.fogColor,
      this.moonDirection,
      nightW,
      this.elapsedSeconds,
    );
  }

  /** Let gameplay objects (buildings) cast shadows. No-op if shadows are off. */
  addShadowCaster(mesh: Parameters<ShadowGenerator['addShadowCaster']>[0]): void {
    this.shadowGenerator?.addShadowCaster(mesh);
  }

  removeShadowCaster(mesh: Parameters<ShadowGenerator['removeShadowCaster']>[0]): void {
    this.shadowGenerator?.removeShadowCaster(mesh);
  }

  dispose(): void {
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    this.sky.dispose();
    this.sun = null;
    this.ambient = null;
    this.scene = null;
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blend3(a: Color3, b: Color3, c: Color3, wa: number, wb: number, wc: number): Color3 {
  const out = new Color3();
  blend3Into(out, a, b, c, wa, wb, wc);
  return out;
}

function blend3Into(
  out: Color3,
  a: Color3,
  b: Color3,
  c: Color3,
  wa: number,
  wb: number,
  wc: number,
): void {
  out.set(
    a.r * wa + b.r * wb + c.r * wc,
    a.g * wa + b.g * wb + c.g * wc,
    a.b * wa + b.b * wb + c.b * wc,
  );
}
