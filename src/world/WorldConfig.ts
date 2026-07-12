/**
 * World-generation and environment tuning values.
 *
 * Kept as data (see ARCHITECTURE.md "Data Design") so designers can
 * retune the world without touching system code, and so tests/demos
 * can override individual values.
 */
export interface WorldConfig {
  /** Seed for deterministic terrain generation. */
  readonly seed: number;
  /** Width/depth of the terrain patch in world units. */
  readonly terrainSize: number;
  /** Grid subdivisions per side. 128 ≈ 33k triangles — fine on mobile. */
  readonly terrainSubdivisions: number;
  /** Peak height of the island above sea level. */
  readonly maxElevation: number;
  /** Water surface height (world Y). Terrain edges sink below it. */
  readonly seaLevel: number;
  /** Size of the ocean plane. Larger than the terrain so it meets the horizon fog. */
  readonly oceanSize: number;
  /** Ocean mesh subdivisions per side (vertex waves are GPU-side; this sets density). */
  readonly oceanSubdivisions: number;
  /** Real-time seconds for one full day/night cycle. */
  readonly dayLengthSeconds: number;
  /** Starting time of day, 0..1 (0 = midnight, 0.5 = noon). */
  readonly initialTimeOfDay: number;
  /** Enable the sun shadow map (terrain self-shadowing). */
  readonly shadowsEnabled: boolean;
  /** Shadow map resolution. 1024 balances quality and mobile fill rate. */
  readonly shadowMapSize: number;
  /** Number of trees scattered on the island (0 disables). */
  readonly treeCount: number;
  /** Number of rocks scattered on the island (0 disables). */
  readonly rockCount: number;
  /** Number of bushes scattered on the island (0 disables). */
  readonly bushCount: number;
  /** Number of drifting cloud clusters (0 disables). */
  readonly cloudCount: number;
  /** Altitude of the cloud layer in world units. */
  readonly cloudHeight: number;
  /** Number of ambient birds circling the island (0 disables). */
  readonly birdCount: number;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 1337,
  terrainSize: 400,
  terrainSubdivisions: 128,
  maxElevation: 26,
  seaLevel: 0,
  oceanSize: 2400,
  oceanSubdivisions: 96,
  dayLengthSeconds: 180,
  initialTimeOfDay: 0.35,
  shadowsEnabled: true,
  shadowMapSize: 1024,
  treeCount: 320,
  rockCount: 70,
  bushCount: 170,
  cloudCount: 10,
  cloudHeight: 110,
  birdCount: 7,
};
