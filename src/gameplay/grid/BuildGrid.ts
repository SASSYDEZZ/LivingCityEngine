import type { TerrainSystem } from '../../world/terrain/TerrainSystem';
import type { WorldConfig } from '../../world/WorldConfig';
import type { GameplayConfig } from '../GameplayConfig';

export interface GridCell {
  col: number;
  row: number;
}

/**
 * Terrain-aware square build grid centered on the island.
 *
 * Buildability per cell is precomputed once from the terrain height
 * field (height band + slope), so placement checks at runtime are a
 * couple of array lookups. Occupancy maps cells to whatever gameplay
 * object claimed them (typed generically — the grid doesn't know what
 * buildings are).
 */
export class BuildGrid<TItem = unknown> {
  readonly cellsPerSide: number;
  private readonly buildableFlags: Uint8Array;
  private readonly occupancy = new Map<number, TItem>();
  private readonly halfExtent: number;

  constructor(
    private readonly gameplay: GameplayConfig,
    private readonly world: WorldConfig,
    private readonly terrain: TerrainSystem,
  ) {
    this.halfExtent = terrain.bounds;
    this.cellsPerSide = Math.floor((this.halfExtent * 2) / gameplay.cellSize);
    this.buildableFlags = new Uint8Array(this.cellsPerSide * this.cellsPerSide);
    this.precomputeBuildability();
  }

  /** Grid cell containing a world XZ position, or null outside the grid. */
  worldToCell(x: number, z: number): GridCell | null {
    const col = Math.floor((x + this.halfExtent) / this.gameplay.cellSize);
    const row = Math.floor((z + this.halfExtent) / this.gameplay.cellSize);
    return this.inBounds(col, row) ? { col, row } : null;
  }

  /** World-space center of a cell. */
  cellCenter(col: number, row: number): { x: number; z: number } {
    return {
      x: (col + 0.5) * this.gameplay.cellSize - this.halfExtent,
      z: (row + 0.5) * this.gameplay.cellSize - this.halfExtent,
    };
  }

  /** Terrain height at the cell center. */
  cellHeight(col: number, row: number): number {
    const { x, z } = this.cellCenter(col, row);
    return this.terrain.sampleHeight(x, z);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cellsPerSide && row < this.cellsPerSide;
  }

  /** Terrain allows building here (ignores occupancy). */
  isTerrainBuildable(col: number, row: number): boolean {
    return this.inBounds(col, row) && this.buildableFlags[this.index(col, row)] === 1;
  }

  isOccupied(col: number, row: number): boolean {
    return this.occupancy.has(this.index(col, row));
  }

  /** Free of occupants AND terrain-buildable. */
  isPlaceable(col: number, row: number): boolean {
    return this.isTerrainBuildable(col, row) && !this.isOccupied(col, row);
  }

  itemAt(col: number, row: number): TItem | undefined {
    return this.occupancy.get(this.index(col, row));
  }

  occupy(cells: GridCell[], item: TItem): void {
    for (const cell of cells) {
      this.occupancy.set(this.index(cell.col, cell.row), item);
    }
  }

  free(cells: GridCell[]): void {
    for (const cell of cells) {
      this.occupancy.delete(this.index(cell.col, cell.row));
    }
  }

  private index(col: number, row: number): number {
    return row * this.cellsPerSide + col;
  }

  private precomputeBuildability(): void {
    const { minHeightAboveSea, maxHeightFraction, minSlope } = this.gameplay;
    const minH = this.world.seaLevel + minHeightAboveSea;
    const maxH = this.world.seaLevel + this.world.maxElevation * maxHeightFraction;
    for (let row = 0; row < this.cellsPerSide; row += 1) {
      for (let col = 0; col < this.cellsPerSide; col += 1) {
        const { x, z } = this.cellCenter(col, row);
        const h = this.terrain.sampleHeight(x, z);
        const slope = this.terrain.sampleSlope(x, z);
        const ok = h >= minH && h <= maxH && slope >= minSlope;
        this.buildableFlags[this.index(col, row)] = ok ? 1 : 0;
      }
    }
  }
}
