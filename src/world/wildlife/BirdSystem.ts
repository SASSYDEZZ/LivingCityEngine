import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
// Side-effect import: enables the thin-instance API on Mesh.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';

import { SeededRandom } from '../SeededRandom';
import type { WorldConfig } from '../WorldConfig';

interface BirdState {
  centerX: number;
  centerZ: number;
  radius: number;
  height: number;
  angle: number;
  angularSpeed: number;
  flapPhase: number;
  scale: number;
}

/**
 * Ambient birds gliding in circles over the island.
 *
 * One chevron silhouette mesh, thin-instanced — a single draw call.
 * Per-frame work is N tiny matrix writes (N ≈ 7). Birds fade out at
 * night via mesh visibility.
 */
export class BirdSystem {
  private mesh: Mesh | null = null;
  private birds: BirdState[] = [];
  private matrices: Float32Array | null = null;
  private elapsedSeconds = 0;

  constructor(private readonly config: WorldConfig) {}

  build(scene: Scene): void {
    if (this.config.birdCount <= 0) {
      return;
    }
    const rng = new SeededRandom(this.config.seed ^ 0xb17d);

    const mesh = new Mesh('birds', scene);
    const vertexData = new VertexData();
    // Chevron silhouette: nose + two swept wings (two triangles).
    vertexData.positions = [
      0, 0, 0.55, // nose
      -1.15, 0.3, -0.55, // left wing tip
      -0.12, 0, -0.25, // left wing root
      0.12, 0, -0.25, // right wing root
      1.15, 0.3, -0.55, // right wing tip
    ];
    vertexData.indices = [0, 1, 2, 0, 3, 4];
    vertexData.applyToMesh(mesh);

    const material = new StandardMaterial('bird-mat', scene);
    material.disableLighting = true;
    material.emissiveColor = new Color3(0.16, 0.17, 0.2); // dark silhouette
    material.backFaceCulling = false; // visible from below and above
    mesh.material = material;
    mesh.isPickable = false;

    this.birds = [];
    const islandRadius = this.config.terrainSize * 0.4;
    for (let i = 0; i < this.config.birdCount; i += 1) {
      this.birds.push({
        centerX: rng.range(-islandRadius * 0.5, islandRadius * 0.5),
        centerZ: rng.range(-islandRadius * 0.5, islandRadius * 0.5),
        radius: rng.range(25, islandRadius),
        height: this.config.seaLevel + this.config.maxElevation + rng.range(14, 40),
        angle: rng.next() * Math.PI * 2,
        angularSpeed: rng.range(0.12, 0.3) * (rng.next() < 0.5 ? -1 : 1),
        flapPhase: rng.next() * Math.PI * 2,
        scale: rng.range(0.8, 1.3),
      });
    }

    this.matrices = new Float32Array(this.birds.length * 16);
    mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh = mesh;
  }

  /** Per-frame: advance circular flight paths; fade out at night. */
  update(deltaSeconds: number, dayFactor: number): void {
    const mesh = this.mesh;
    const matrices = this.matrices;
    if (!mesh || !matrices) {
      return;
    }

    mesh.visibility = dayFactor;
    if (dayFactor <= 0.02) {
      mesh.setEnabled(false);
      return;
    }
    mesh.setEnabled(true);

    this.elapsedSeconds += deltaSeconds;
    for (let i = 0; i < this.birds.length; i += 1) {
      const b = this.birds[i]!;
      b.angle += b.angularSpeed * deltaSeconds;

      const x = b.centerX + Math.cos(b.angle) * b.radius;
      const z = b.centerZ + Math.sin(b.angle) * b.radius;
      const y = b.height + Math.sin(this.elapsedSeconds * 0.6 + b.flapPhase) * 2.5;

      // Face along the flight direction (tangent of the circle).
      const heading = b.angle + (b.angularSpeed > 0 ? Math.PI : 0);
      // Wing flap: gentle vertical squash of the chevron.
      const flap = 1 + 0.55 * Math.sin(this.elapsedSeconds * 7 + b.flapPhase);

      Matrix.Compose(
        new Vector3(b.scale, b.scale * flap, b.scale),
        Quaternion.FromEulerAngles(0, -heading + Math.PI / 2, 0),
        new Vector3(x, y, z),
      ).copyToArray(matrices, i * 16);
    }
    mesh.thinInstanceBufferUpdated('matrix');
  }

  dispose(): void {
    this.mesh = null;
    this.birds = [];
    this.matrices = null;
  }
}
