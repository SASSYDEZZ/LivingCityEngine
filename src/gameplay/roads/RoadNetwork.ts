/**
 * Logical road graph — the pathfinding foundation for citizens and
 * vehicles (Phase 4/5).
 *
 * Deliberately dependency-free (no Babylon, no grid class): it works
 * on integer cell coordinates only, so it is trivially testable and
 * cheap. `ConstructionSystem` feeds it as roads are placed/removed;
 * simulation systems will query it.
 */
export interface RoadCell {
  col: number;
  row: number;
}

export class RoadNetwork {
  private readonly cells = new Set<number>();
  private readonly cellsPerSide: number;

  // No TS parameter properties here: this file stays erasable-syntax
  // only so it can run directly under `node --experimental-strip-types`
  // for dependency-free logic tests.
  constructor(cellsPerSide: number) {
    this.cellsPerSide = cellsPerSide;
  }

  get size(): number {
    return this.cells.size;
  }

  addCell(col: number, row: number): void {
    this.cells.add(this.index(col, row));
  }

  removeCell(col: number, row: number): void {
    this.cells.delete(this.index(col, row));
  }

  hasRoad(col: number, row: number): boolean {
    return this.cells.has(this.index(col, row));
  }

  /** Orthogonally connected road neighbors of a cell. */
  neighbors(col: number, row: number): RoadCell[] {
    const result: RoadCell[] = [];
    for (const [dc, dr] of NEIGHBOR_OFFSETS) {
      const c = col + dc;
      const r = row + dr;
      if (this.inBounds(c, r) && this.hasRoad(c, r)) {
        result.push({ col: c, row: r });
      }
    }
    return result;
  }

  /** True if two road cells are connected through the network. */
  isConnected(a: RoadCell, b: RoadCell): boolean {
    return this.findPath(a, b) !== null;
  }

  /**
   * Shortest road path between two road cells (BFS — edges are
   * uniform). Returns the cell sequence including both endpoints, or
   * null if either endpoint is not a road or no route exists.
   */
  findPath(from: RoadCell, to: RoadCell): RoadCell[] | null {
    const start = this.index(from.col, from.row);
    const goal = this.index(to.col, to.row);
    if (!this.cells.has(start) || !this.cells.has(goal)) {
      return null;
    }
    if (start === goal) {
      return [from];
    }

    const cameFrom = new Map<number, number>();
    cameFrom.set(start, -1);
    let frontier = [start];

    while (frontier.length > 0) {
      const next: number[] = [];
      for (const current of frontier) {
        const col = current % this.cellsPerSide;
        const row = Math.floor(current / this.cellsPerSide);
        for (const [dc, dr] of NEIGHBOR_OFFSETS) {
          const c = col + dc;
          const r = row + dr;
          if (!this.inBounds(c, r)) {
            continue;
          }
          const i = this.index(c, r);
          if (!this.cells.has(i) || cameFrom.has(i)) {
            continue;
          }
          cameFrom.set(i, current);
          if (i === goal) {
            return this.reconstruct(cameFrom, goal);
          }
          next.push(i);
        }
      }
      frontier = next;
    }
    return null;
  }

  private reconstruct(cameFrom: Map<number, number>, goal: number): RoadCell[] {
    const path: RoadCell[] = [];
    let current = goal;
    while (current !== -1) {
      path.push({ col: current % this.cellsPerSide, row: Math.floor(current / this.cellsPerSide) });
      current = cameFrom.get(current)!;
    }
    return path.reverse();
  }

  private index(col: number, row: number): number {
    return row * this.cellsPerSide + col;
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cellsPerSide && row < this.cellsPerSide;
  }
}

const NEIGHBOR_OFFSETS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
