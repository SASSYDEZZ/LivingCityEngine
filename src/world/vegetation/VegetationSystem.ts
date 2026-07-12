import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side-effect import: enables the thin-instance API on Mesh.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';

import { SeededRandom } from '../SeededRandom';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { ValueNoise2D } from '../terrain/ValueNoise2D';
import type { WorldConfig } from '../WorldConfig';

/**
 * Instanced island decoration: trees, rocks, and bushes.
 *
 * Every species is ONE mesh drawn once with thin instances, so the
 * whole system costs 4 draw calls regardless of how many plants are
 * scattered. Templates are stylized low-poly primitives colored with
 * vertex colors — no textures. Placement is seeded and deterministic:
 * trees cluster in noise-driven "forests" on gentle grassland, rocks
 * prefer slopes and highland, bushes fill meadow edges.
 */
export class VegetationSystem {
  constructor(private readonly config: WorldConfig) {}

  /** Builds all vegetation; returns meshes that should cast shadows. */
  build(scene: Scene, terrain: TerrainSystem): Mesh[] {
    const rng = new SeededRandom(this.config.seed ^ 0x5eed);
    const forestNoise = new ValueNoise2D(this.config.seed + 7);

    const roundTree = this.buildRoundTree(scene);
    const pineTree = this.buildPineTree(scene);
    const rock = this.buildRock(scene);
    const bush = this.buildBush(scene);

    const roundMatrices: number[] = [];
    const roundColors: number[] = [];
    const pineMatrices: number[] = [];
    const pineColors: number[] = [];

    this.scatter(this.config.treeCount, rng, terrain, (x, z, h, slope) => {
      if (!this.isGrassland(h, slope)) {
        return;
      }
      // Forest mask: trees cluster instead of spreading uniformly.
      const forest = forestNoise.fbm(x * 0.02, z * 0.02, 2);
      if (forest < -0.05) {
        return;
      }
      const pine = forest > 0.38 || rng.next() < 0.25; // pines in dense cores
      const scale = rng.range(0.8, 1.5);
      const matrix = composeAt(x, h, z, scale, rng.next() * Math.PI * 2);
      // Per-instance tint: subtle brightness/hue variation.
      const tint = rng.range(0.85, 1.12);
      const green = rng.range(0.92, 1.08);
      if (pine) {
        matrix.copyToArray(pineMatrices, pineMatrices.length);
        pineColors.push(tint, tint * green, tint, 1);
      } else {
        matrix.copyToArray(roundMatrices, roundMatrices.length);
        roundColors.push(tint, tint * green, tint, 1);
      }
    });

    const rockMatrices: number[] = [];
    const rockColors: number[] = [];
    this.scatter(this.config.rockCount, rng, terrain, (x, z, h, slope) => {
      const { seaLevel, maxElevation } = this.config;
      if (h < seaLevel + 0.6 || h > seaLevel + maxElevation * 0.95 || slope > 0.97) {
        return;
      }
      const scale = rng.range(0.5, 1.6);
      const matrix = Matrix.Compose(
        new Vector3(scale * rng.range(0.8, 1.5), scale * rng.range(0.5, 0.9), scale),
        Quaternion.FromEulerAngles(0, rng.next() * Math.PI * 2, 0),
        new Vector3(x, h + 0.1, z),
      );
      matrix.copyToArray(rockMatrices, rockMatrices.length);
      const tint = rng.range(0.8, 1.15);
      rockColors.push(tint, tint, tint, 1);
    });

    const bushMatrices: number[] = [];
    const bushColors: number[] = [];
    this.scatter(this.config.bushCount, rng, terrain, (x, z, h, slope) => {
      if (!this.isGrassland(h, slope)) {
        return;
      }
      const scale = rng.range(0.5, 1.1);
      const matrix = composeAt(x, h, z, scale, rng.next() * Math.PI * 2);
      matrix.copyToArray(bushMatrices, bushMatrices.length);
      const tint = rng.range(0.8, 1.2);
      bushColors.push(tint * 0.95, tint, tint * 0.9, 1);
    });

    applyInstances(roundTree, roundMatrices, roundColors);
    applyInstances(pineTree, pineMatrices, pineColors);
    applyInstances(rock, rockMatrices, rockColors);
    applyInstances(bush, bushMatrices, bushColors);

    // Only trees cast shadows — they're tall enough to matter.
    return [roundTree, pineTree];
  }

  dispose(): void {
    // Meshes/materials are owned by the Babylon scene; nothing to clear.
  }

  /** Rejection-sample positions on the island and invoke the placer. */
  private scatter(
    target: number,
    rng: SeededRandom,
    terrain: TerrainSystem,
    place: (x: number, z: number, height: number, slope: number) => void,
  ): void {
    const radius = terrain.bounds;
    // Cap attempts so impossible placement rules can't hang the build.
    const maxAttempts = target * 6;
    for (let i = 0; i < maxAttempts; i += 1) {
      const x = rng.range(-radius, radius);
      const z = rng.range(-radius, radius);
      if (Math.hypot(x, z) > radius) {
        continue;
      }
      place(x, z, terrain.sampleHeight(x, z), terrain.sampleSlope(x, z));
    }
  }

  /** Grass band: above the beach, below the rock/snow line, gentle slope. */
  private isGrassland(height: number, slope: number): boolean {
    const { seaLevel, maxElevation } = this.config;
    return height > seaLevel + 1.4 && height < seaLevel + maxElevation * 0.62 && slope > 0.88;
  }

  private buildRoundTree(scene: Scene): Mesh {
    const trunk = CreateCylinder(
      'tree-trunk',
      { height: 1.6, diameterTop: 0.32, diameterBottom: 0.45, tessellation: 5 },
      scene,
    );
    trunk.position.y = 0.8;
    paintMesh(trunk, 0.42, 0.3, 0.2);

    const canopy = CreateSphere('tree-canopy', { diameter: 2.6, segments: 3 }, scene);
    canopy.position.y = 2.4;
    canopy.scaling.y = 1.15;
    paintMesh(canopy, 0.24, 0.5, 0.22);

    return mergeTemplate('tree-round', scene, [trunk, canopy]);
  }

  private buildPineTree(scene: Scene): Mesh {
    const trunk = CreateCylinder(
      'pine-trunk',
      { height: 1.2, diameterTop: 0.28, diameterBottom: 0.4, tessellation: 5 },
      scene,
    );
    trunk.position.y = 0.6;
    paintMesh(trunk, 0.38, 0.26, 0.18);

    const canopy = CreateCylinder(
      'pine-canopy',
      { height: 3.4, diameterTop: 0.05, diameterBottom: 2.0, tessellation: 6 },
      scene,
    );
    canopy.position.y = 2.7;
    paintMesh(canopy, 0.16, 0.4, 0.24);

    return mergeTemplate('tree-pine', scene, [trunk, canopy]);
  }

  private buildRock(scene: Scene): Mesh {
    const rock = CreateIcoSphere('rock-template', { radius: 0.8, subdivisions: 1 }, scene);
    paintMesh(rock, 0.5, 0.48, 0.46);
    return finishTemplate(rock, scene);
  }

  private buildBush(scene: Scene): Mesh {
    const bush = CreateSphere('bush-template', { diameter: 1.1, segments: 2 }, scene);
    bush.scaling.y = 0.75;
    paintMesh(bush, 0.28, 0.47, 0.2);
    return finishTemplate(bush, scene);
  }
}

/** Upright placement matrix with uniform scale and Y rotation. */
function composeAt(x: number, y: number, z: number, scale: number, yaw: number): Matrix {
  return Matrix.Compose(
    new Vector3(scale, scale, scale),
    Quaternion.FromEulerAngles(0, yaw, 0),
    new Vector3(x, y, z),
  );
}

/** Flat vertex color for a whole template part. */
function paintMesh(mesh: Mesh, r: number, g: number, b: number): void {
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
}

/** Merge template parts into one vertex-colored mesh, shared material. */
function mergeTemplate(name: string, scene: Scene, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) {
    throw new Error(`[VegetationSystem] failed to merge template "${name}"`);
  }
  merged.name = name;
  return finishTemplate(merged, scene);
}

function finishTemplate(mesh: Mesh, scene: Scene): Mesh {
  const material = new StandardMaterial(`${mesh.name}-mat`, scene);
  material.diffuseColor = Color3.White(); // multiplied by vertex + instance colors
  material.specularColor = Color3.Black();
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

/** Attach thin-instance buffers; hide the template if nothing placed. */
function applyInstances(mesh: Mesh, matrices: number[], colors: number[]): void {
  if (matrices.length === 0) {
    mesh.setEnabled(false);
    return;
  }
  mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true);
  mesh.thinInstanceSetBuffer('color', new Float32Array(colors), 4, true);
  mesh.freezeWorldMatrix();
}
