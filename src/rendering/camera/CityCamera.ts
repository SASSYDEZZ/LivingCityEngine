import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

/**
 * City-builder camera rig.
 *
 * Wraps an ArcRotateCamera tuned for map navigation on both desktop
 * and touch devices:
 *  - one-finger drag / left-drag: orbit
 *  - two-finger drag / right-drag: pan across the map plane
 *  - pinch / wheel: zoom
 *
 * The rig keeps the focus point inside the island and scales panning
 * speed with zoom so the map "moves with your finger" at any distance.
 */
export class CityCamera {
  private camera: ArcRotateCamera | null = null;
  private boundsRadius = Infinity;

  build(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
    const camera = new ArcRotateCamera(
      'city-camera',
      -Math.PI / 2.6, // alpha: diagonal view
      Math.PI / 3.4, // beta: elevated map angle
      250, // start zoomed out so the whole island reads at a glance
      new Vector3(0, 2, 0),
      scene,
    );

    // Zoom range: close enough to inspect terrain, far enough to see
    // the whole island. Never below the horizon plane.
    camera.lowerRadiusLimit = 18;
    camera.upperRadiusLimit = 340;
    camera.lowerBetaLimit = 0.15;
    camera.upperBetaLimit = Math.PI / 2.15;

    // Smooth, weighty motion.
    camera.inertia = 0.9;
    camera.panningInertia = 0.9;

    // Zoom speed proportional to distance (feels uniform at any zoom).
    camera.wheelDeltaPercentage = 0.012;
    camera.useNaturalPinchZoom = true;

    // Pan along the ground plane, not the view plane — map-style.
    camera.mapPanning = true;

    camera.attachControl(canvas, true);
    this.camera = camera;
    return camera;
  }

  /** Restrict the focus point to a circle around the island. */
  setBounds(radius: number): void {
    this.boundsRadius = radius;
  }

  get position(): Vector3 {
    return this.camera?.position ?? Vector3.Zero();
  }

  /** Per-frame: clamp target and scale pan speed with zoom level. */
  update(): void {
    const camera = this.camera;
    if (!camera) {
      return;
    }

    // Pan sensitivity is "pixels per world unit": lower it when zoomed
    // out so a swipe covers more ground.
    camera.panningSensibility = Math.min(120, Math.max(6, 1600 / camera.radius));

    const target = camera.target;
    const horizontal = Math.hypot(target.x, target.z);
    if (horizontal > this.boundsRadius) {
      const scale = this.boundsRadius / horizontal;
      camera.setTarget(new Vector3(target.x * scale, target.y, target.z * scale));
    }
  }

  dispose(): void {
    this.camera = null;
  }
}
