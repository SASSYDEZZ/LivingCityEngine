import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
// Side-effect import: adds Scene.prototype.createPickingRay.
import '@babylonjs/core/Culling/ray';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

import type { TerrainSystem } from '../../world/terrain/TerrainSystem';

/**
 * Converts screen taps into ground positions by marching the pick ray
 * against the terrain height field — no triangle picking against the
 * 33k-triangle terrain mesh, so it stays cheap on mobile even during
 * pointer-move previews.
 */
export class GroundPicker {
  constructor(
    private readonly scene: Scene,
    private readonly terrain: TerrainSystem,
  ) {}

  /** Ground point under the given screen position, or null (sky/ocean-out-of-range). */
  pick(screenX: number, screenY: number, camera: ArcRotateCamera): Vector3 | null {
    const ray = this.scene.createPickingRay(screenX, screenY, Matrix.Identity(), camera);

    // Coarse march to bracket the surface crossing…
    const step = 8;
    const maxDistance = 1500;
    let prevT = 0;
    let prevAbove = this.aboveTerrain(ray.origin, ray.direction, 0);
    if (!prevAbove) {
      return null; // camera underground — shouldn't happen
    }
    for (let t = step; t <= maxDistance; t += step) {
      const above = this.aboveTerrain(ray.origin, ray.direction, t);
      if (!above) {
        // …then bisect to refine.
        let lo = prevT;
        let hi = t;
        for (let i = 0; i < 16; i += 1) {
          const mid = (lo + hi) / 2;
          if (this.aboveTerrain(ray.origin, ray.direction, mid)) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        const hit = (lo + hi) / 2;
        return new Vector3(
          ray.origin.x + ray.direction.x * hit,
          ray.origin.y + ray.direction.y * hit,
          ray.origin.z + ray.direction.z * hit,
        );
      }
      prevT = t;
      prevAbove = above;
    }
    return null;
  }

  private aboveTerrain(origin: Vector3, direction: Vector3, t: number): boolean {
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    const z = origin.z + direction.z * t;
    return y > this.terrain.sampleHeight(x, z);
  }
}
