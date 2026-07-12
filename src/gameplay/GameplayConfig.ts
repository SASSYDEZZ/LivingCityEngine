/**
 * Construction/gameplay tuning values, separate from world generation
 * so the gameplay layer stays decoupled from the world layer.
 */
export interface GameplayConfig {
  /** Build grid cell size in world units. */
  readonly cellSize: number;
  /** Cells must sit at least this far above sea level to be buildable. */
  readonly minHeightAboveSea: number;
  /** Fraction of max elevation above which cells are too high to build. */
  readonly maxHeightFraction: number;
  /** Minimum surface up-ness (1 = flat) for a buildable cell. */
  readonly minSlope: number;
  /** Maximum road path length in cells per drag. */
  readonly maxRoadLength: number;
  /** Seconds for the build pop-in animation. */
  readonly buildAnimSeconds: number;
}

export const DEFAULT_GAMEPLAY_CONFIG: GameplayConfig = {
  cellSize: 4,
  minHeightAboveSea: 1.0,
  maxHeightFraction: 0.8,
  minSlope: 0.86,
  maxRoadLength: 60,
  buildAnimSeconds: 0.45,
};
