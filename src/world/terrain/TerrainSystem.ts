import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

import type { WorldConfig } from '../WorldConfig';
import { ValueNoise2D } from './ValueNoise2D';

/**
 * Procedural island terrain.
 *
 * A single ground mesh displaced by fractal value noise with a radial
 * falloff, so the island rises from the surrounding ocean and its
 * edges always sink below sea level. Surface color comes from
 * per-vertex colors (sand → grass → rock → snow by height and slope),
 * which costs nothing at runtime — no textures, no extra draw calls.
 *
 * One static mesh, frozen after build: minimal per-frame cost on mobile.
 */
export class TerrainSystem {
  private mesh: Mesh | null = null;

  constructor(private readonly config: WorldConfig) {}

  /** Half-extent of the usable island area, for camera clamping. */
  get bounds(): number {
    return this.config.terrainSize * 0.45;
  }

  get terrainMesh(): Mesh | null {
    return this.mesh;
  }

  build(scene: Scene): Mesh {
    const { terrainSize, terrainSubdivisions, seed } = this.config;

    const mesh = CreateGround(
      'terrain',
      { width: terrainSize, height: terrainSize, subdivisions: terrainSubdivisions, updatable: true },
      scene,
    );

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) {
      throw new Error('[TerrainSystem] ground mesh is missing vertex data');
    }

    const noise = new ValueNoise2D(seed);
    this.displace(positions, noise);

    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);

    const colors = this.paint(positions, normals, new ValueNoise2D(seed + 1));

    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);

    const material = new StandardMaterial('terrain-mat', scene);
    material.diffuseColor = Color3.White(); // multiplied by vertex colors
    material.specularColor = Color3.Black();
    mesh.material = material;

    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    material.freeze();

    this.mesh = mesh;
    return mesh;
  }

  dispose(): void {
    // Mesh/material are owned by the Babylon scene; just drop references.
    this.mesh = null;
  }

  /** Displace grid vertices: fBm noise shaped by a radial island falloff. */
  private displace(positions: Float32Array | number[], noise: ValueNoise2D): void {
    const { terrainSize, maxElevation, seaLevel } = this.config;
    const half = terrainSize * 0.5;
    const frequency = 7 / terrainSize; // ~7 noise cells across the island: distinct hills
    const edgeDepth = 10; // how far the rim sinks below sea level

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const z = positions[i + 2]!;

      const n01 = (noise.fbm(x * frequency, z * frequency, 5) + 1) * 0.5;
      // Exponent >1 flattens lowlands and sharpens peaks.
      const relief = Math.pow(n01, 1.35) * maxElevation + 1.4;

      const d = Math.hypot(x, z) / half;
      const falloff = 1 - smoothstep(0.5, 1.0, d);

      positions[i + 1] = seaLevel + relief * falloff - edgeDepth * (1 - falloff);
    }
  }

  /** Per-vertex colors by height band, slope, and a touch of noise. */
  private paint(
    positions: Float32Array | number[],
    normals: Float32Array,
    tintNoise: ValueNoise2D,
  ): Float32Array {
    const { seaLevel, maxElevation } = this.config;
    const vertexCount = positions.length / 3;
    const colors = new Float32Array(vertexCount * 4);

    const seabed = { r: 0.30, g: 0.34, b: 0.28 };
    const sand = { r: 0.76, g: 0.70, b: 0.50 };
    const grass = { r: 0.26, g: 0.50, b: 0.25 };
    const meadow = { r: 0.47, g: 0.55, b: 0.26 };
    const rock = { r: 0.46, g: 0.45, b: 0.43 };
    const snow = { r: 0.92, g: 0.93, b: 0.95 };

    for (let v = 0; v < vertexCount; v += 1) {
      const x = positions[v * 3]!;
      const h = positions[v * 3 + 1]!;
      const z = positions[v * 3 + 2]!;
      const ny = normals[v * 3 + 1]!;

      // Grass with large-scale tint variation so plains aren't uniform.
      const tint = (tintNoise.fbm(x * 0.045, z * 0.045, 2) + 1) * 0.5;
      let r = lerp(grass.r, meadow.r, tint);
      let g = lerp(grass.g, meadow.g, tint);
      let b = lerp(grass.b, meadow.b, tint);

      // Steep slopes read as rock regardless of height.
      const rockiness = 1 - smoothstep(0.8, 0.9, ny);
      r = lerp(r, rock.r, rockiness);
      g = lerp(g, rock.g, rockiness);
      b = lerp(b, rock.b, rockiness);

      // Snow caps on the highest peaks.
      const snowiness = smoothstep(seaLevel + maxElevation * 0.72, seaLevel + maxElevation * 0.9, h);
      r = lerp(r, snow.r, snowiness);
      g = lerp(g, snow.g, snowiness);
      b = lerp(b, snow.b, snowiness);

      // Sand band around the waterline gives the shoreline transition.
      const sandiness = 1 - smoothstep(seaLevel + 0.4, seaLevel + 1.6, h);
      r = lerp(r, sand.r, sandiness);
      g = lerp(g, sand.g, sandiness);
      b = lerp(b, sand.b, sandiness);

      // Fade to dark seabed underwater (visible through the water).
      const submerged = 1 - smoothstep(seaLevel - 3.5, seaLevel - 0.2, h);
      r = lerp(r, seabed.r, submerged);
      g = lerp(g, seabed.g, submerged);
      b = lerp(b, seabed.b, submerged);

      colors[v * 4] = r;
      colors[v * 4 + 1] = g;
      colors[v * 4 + 2] = b;
      colors[v * 4 + 3] = 1;
    }

    return colors;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
