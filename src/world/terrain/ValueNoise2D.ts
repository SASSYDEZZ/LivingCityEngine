/**
 * Seeded 2D value noise with fractal Brownian motion.
 *
 * Self-contained (no texture lookups, no dependencies) so terrain
 * generation is deterministic across devices for a given seed —
 * a requirement for future save/load and multiplayer.
 */
export class ValueNoise2D {
  constructor(private readonly seed: number) {}

  /** Deterministic lattice hash → [0, 1). */
  private hash(ix: number, iy: number): number {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(this.seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    // Convert to unsigned before normalizing.
    return (h >>> 0) / 4294967296;
  }

  /** Smoothly interpolated noise sample → [-1, 1]. */
  sample(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Quintic fade for C2-continuous interpolation (no grid artifacts).
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const a = this.hash(ix, iy);
    const b = this.hash(ix + 1, iy);
    const c = this.hash(ix, iy + 1);
    const d = this.hash(ix + 1, iy + 1);

    const value = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    return value * 2 - 1;
  }

  /** Fractal sum of octaves → approximately [-1, 1]. */
  fbm(x: number, y: number, octaves: number, lacunarity = 2.0, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += this.sample(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / norm;
  }
}
