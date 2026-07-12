import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side-effect import: enables the thin-instance API on Mesh.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';

import { SeededRandom } from '../SeededRandom';
import type { WorldConfig } from '../WorldConfig';

interface CloudState {
  x: number;
  z: number;
  y: number;
  speed: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  yaw: number;
}

/**
 * Drifting stylized clouds.
 *
 * One merged "puff cluster" mesh drawn with thin instances — a single
 * draw call for the whole layer. Clouds drift slowly east and wrap
 * around; per-frame cost is rewriting N tiny matrices (N ≈ 10).
 * Unlit (emissive) so they stay soft; the tint follows the time of
 * day so they glow warm at sunset and dim at night.
 */
export class CloudSystem {
  private mesh: Mesh | null = null;
  private material: StandardMaterial | null = null;
  private clouds: CloudState[] = [];
  private matrices: Float32Array | null = null;
  private readonly wrapExtent: number;

  constructor(private readonly config: WorldConfig) {
    this.wrapExtent = config.oceanSize * 0.35;
  }

  build(scene: Scene): void {
    if (this.config.cloudCount <= 0) {
      return;
    }
    const rng = new SeededRandom(this.config.seed ^ 0xc10d);

    // Puff cluster: three overlapping squashed spheres.
    const puffs = [
      { d: 6, x: 0, y: 0 },
      { d: 4.4, x: 3.4, y: -0.4 },
      { d: 4.0, x: -3.2, y: -0.5 },
    ].map((p, i) => {
      const puff = CreateSphere(`cloud-puff-${i}`, { diameter: p.d, segments: 3 }, scene);
      puff.position.set(p.x, p.y, 0);
      puff.scaling.y = 0.55;
      return puff;
    });
    const merged = Mesh.MergeMeshes(puffs, true, true);
    if (!merged) {
      throw new Error('[CloudSystem] failed to merge cloud template');
    }
    merged.name = 'clouds';

    const material = new StandardMaterial('cloud-mat', scene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.alpha = 0.88;
    merged.material = material;
    merged.isPickable = false;
    // Fog would pop as clouds wrap at the far edge; they fade by tint instead.
    merged.applyFog = false;

    this.clouds = [];
    for (let i = 0; i < this.config.cloudCount; i += 1) {
      this.clouds.push({
        x: rng.range(-this.wrapExtent, this.wrapExtent),
        z: rng.range(-this.wrapExtent, this.wrapExtent),
        y: this.config.cloudHeight + rng.range(-18, 26),
        speed: rng.range(2.5, 5.5),
        scaleX: rng.range(1.2, 3.2),
        scaleY: rng.range(0.7, 1.2),
        scaleZ: rng.range(1.0, 2.2),
        yaw: rng.next() * Math.PI * 2,
      });
    }

    this.matrices = new Float32Array(this.clouds.length * 16);
    merged.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh = merged;
    this.material = material;
    this.writeMatrices();
  }

  /** Per-frame: drift, wrap, and tint with the time of day. */
  update(deltaSeconds: number, tint: Color3): void {
    if (!this.mesh || !this.material) {
      return;
    }
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * deltaSeconds;
      if (cloud.x > this.wrapExtent) {
        cloud.x = -this.wrapExtent;
      }
    }
    this.writeMatrices();
    this.material.emissiveColor = tint;
  }

  dispose(): void {
    this.mesh = null;
    this.material = null;
    this.clouds = [];
    this.matrices = null;
  }

  private writeMatrices(): void {
    if (!this.mesh || !this.matrices) {
      return;
    }
    for (let i = 0; i < this.clouds.length; i += 1) {
      const c = this.clouds[i]!;
      Matrix.Compose(
        new Vector3(c.scaleX, c.scaleY, c.scaleZ),
        Quaternion.FromEulerAngles(0, c.yaw, 0),
        new Vector3(c.x, c.y, c.z),
      ).copyToArray(this.matrices, i * 16);
    }
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
