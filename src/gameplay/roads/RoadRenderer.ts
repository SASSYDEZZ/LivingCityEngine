import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
// Side-effect import: registers Mesh.prototype.createInstance.
import '@babylonjs/core/Meshes/instancedMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

import type { TerrainSystem } from '../../world/terrain/TerrainSystem';
import type { GameplayConfig } from '../GameplayConfig';
import type { BuildGrid, GridCell } from '../grid/BuildGrid';
import {
  buildRoadPieceTemplates,
  DIR_E,
  DIR_N,
  DIR_S,
  DIR_W,
  resolvePiece,
  type RoadPieceType,
} from './RoadPieces';

/**
 * Renders the road network as auto-connecting pieces.
 *
 * Presentation only: the source of truth for what is a road stays in
 * the BuildGrid occupancy (data model unchanged). This class keeps a
 * cell→instance map; whenever cells are added or removed it recomputes
 * the 4-bit neighbor mask for the affected cells AND their neighbors
 * and swaps instances to the right piece type/rotation — so straights,
 * corners, tees, and crossroads form automatically while you build.
 *
 * Terrain conformity: each piece is tilted to the local terrain
 * gradient and its slab is thick + sunk, so pieces meet cleanly on
 * gentle slopes instead of floating step-wise.
 */
export class RoadRenderer {
  private templates: Map<RoadPieceType, Mesh> | null = null;
  private readonly instances = new Map<number, InstancedMesh>();
  private readonly roadCells = new Set<number>();
  private terrain: TerrainSystem | null = null;
  private instanceCounter = 0;

  constructor(
    private readonly config: GameplayConfig,
    private readonly grid: BuildGrid<unknown>,
  ) {}

  build(scene: Scene, terrain: TerrainSystem): void {
    this.terrain = terrain;
    this.templates = buildRoadPieceTemplates(scene, this.config.cellSize);
  }

  /** Meshes future systems may need (e.g. shadow casters). Unused today. */
  get templateMeshes(): Mesh[] {
    return this.templates ? [...this.templates.values()] : [];
  }

  /**
   * Add road cells (a committed path) and refresh all affected pieces.
   * Returns the instances of the newly added cells, in path order,
   * for the caller to animate.
   */
  addCells(cells: GridCell[]): InstancedMesh[] {
    for (const cell of cells) {
      this.roadCells.add(this.index(cell));
    }
    const touched = new Set<number>();
    for (const cell of cells) {
      this.collectTouched(cell, touched);
    }
    for (const index of touched) {
      this.rebuildPiece(index);
    }
    return cells
      .map((cell) => this.instances.get(this.index(cell)))
      .filter((m): m is InstancedMesh => m !== undefined);
  }

  /**
   * Remove one road cell; neighbors reconnect automatically. Returns
   * the detached instance so the caller can animate it out and dispose.
   */
  removeCell(cell: GridCell): InstancedMesh | null {
    const index = this.index(cell);
    if (!this.roadCells.delete(index)) {
      return null;
    }
    const removed = this.instances.get(index) ?? null;
    this.instances.delete(index);
    const touched = new Set<number>();
    this.collectTouched(cell, touched);
    for (const t of touched) {
      this.rebuildPiece(t);
    }
    return removed;
  }

  dispose(): void {
    this.instances.clear();
    this.roadCells.clear();
    this.templates = null;
    this.terrain = null;
  }

  private index(cell: GridCell): number {
    return cell.row * this.grid.cellsPerSide + cell.col;
  }

  private cellOf(index: number): GridCell {
    return { col: index % this.grid.cellsPerSide, row: Math.floor(index / this.grid.cellsPerSide) };
  }

  /** The cell itself plus its road neighbors. */
  private collectTouched(cell: GridCell, out: Set<number>): void {
    const candidates = [
      cell,
      { col: cell.col, row: cell.row - 1 },
      { col: cell.col + 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 },
      { col: cell.col - 1, row: cell.row },
    ];
    for (const c of candidates) {
      const i = this.index(c);
      if (this.grid.inBounds(c.col, c.row) && this.roadCells.has(i)) {
        out.add(i);
      }
    }
  }

  private connectionMask(cell: GridCell): number {
    let mask = 0;
    if (this.isRoad(cell.col, cell.row - 1)) {
      mask |= DIR_N;
    }
    if (this.isRoad(cell.col + 1, cell.row)) {
      mask |= DIR_E;
    }
    if (this.isRoad(cell.col, cell.row + 1)) {
      mask |= DIR_S;
    }
    if (this.isRoad(cell.col - 1, cell.row)) {
      mask |= DIR_W;
    }
    return mask;
  }

  private isRoad(col: number, row: number): boolean {
    return this.grid.inBounds(col, row) && this.roadCells.has(row * this.grid.cellsPerSide + col);
  }

  private rebuildPiece(index: number): void {
    if (!this.templates || !this.terrain) {
      return;
    }
    const cell = this.cellOf(index);

    // Swap out whatever instance was there.
    this.instances.get(index)?.dispose();
    this.instances.delete(index);

    const { type, quarterTurns } = resolvePiece(this.connectionMask(cell));
    const template = this.templates.get(type);
    if (!template) {
      return;
    }
    const instance = template.createInstance(`road-${(this.instanceCounter += 1)}`);
    instance.isPickable = false;

    const { x, z } = this.grid.cellCenter(cell.col, cell.row);
    const y = this.terrain.sampleHeight(x, z);
    instance.position.set(x, y, z);

    // Yaw for the piece rotation, then tilt to the terrain gradient so
    // pieces on slopes stay flush. Babylon's +90° yaw maps -z to -x
    // (N→W), i.e. counter-clockwise on our mask — so clockwise
    // quarter-turns need a negative angle.
    const yaw = Quaternion.RotationAxis(Vector3.UpReadOnly, -quarterTurns * (Math.PI / 2));
    instance.rotationQuaternion = this.terrainTilt(x, z).multiply(yaw);
  }

  /** Quaternion aligning "up" to the local terrain normal. */
  private terrainTilt(x: number, z: number): Quaternion {
    const terrain = this.terrain;
    if (!terrain) {
      return Quaternion.Identity();
    }
    // Sample the gradient wider than one cell so neighboring pieces
    // tilt almost identically and their surfaces stay flush.
    const e = this.config.cellSize * 1.2;
    const gx = (terrain.sampleHeight(x + e, z) - terrain.sampleHeight(x - e, z)) / (2 * e);
    const gz = (terrain.sampleHeight(x, z + e) - terrain.sampleHeight(x, z - e)) / (2 * e);
    const normal = new Vector3(-gx, 1, -gz).normalize();
    const axis = Vector3.Cross(Vector3.UpReadOnly, normal);
    const angle = Math.acos(Math.min(1, Vector3.Dot(Vector3.UpReadOnly, normal)));
    if (axis.lengthSquared() < 1e-8 || angle < 1e-4) {
      return Quaternion.Identity();
    }
    return Quaternion.RotationAxis(axis.normalize(), angle);
  }
}
