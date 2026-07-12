import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
// Side-effect import: registers Mesh.prototype.createInstance.
import '@babylonjs/core/Meshes/instancedMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import type { Scene } from '@babylonjs/core/scene';

import type { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';
import type { CityCamera } from '../../rendering/camera/CityCamera';
import type { EnvironmentSystem } from '../../world/environment/EnvironmentSystem';
import type { TerrainSystem } from '../../world/terrain/TerrainSystem';
import type { VegetationSystem } from '../../world/vegetation/VegetationSystem';
import { BUILDING_CATALOG, getBuildingDef, type BuildingDef } from '../buildings/BuildingCatalog';
import { buildBuildingTemplate } from '../buildings/BuildingFactory';
import type { GameplayConfig } from '../GameplayConfig';
import type { BuildGrid, GridCell } from '../grid/BuildGrid';
import type { RoadNetwork } from '../roads/RoadNetwork';
import type { RoadRenderer } from '../roads/RoadRenderer';
import { GroundPicker } from './GroundPicker';

export type ConstructionMode = 'view' | 'build' | 'road' | 'bulldoze';

/** What occupies grid cells — the grid is generic over this. */
export interface PlacedItem {
  kind: 'building' | 'road';
  defId: string | null;
  /** Visual node; null for roads (the RoadRenderer owns road pieces). */
  node: InstancedMesh | null;
  cells: GridCell[];
}

interface ScaleAnimation {
  node: InstancedMesh;
  /** Negative elapsed = start delay (used to stagger road pop-ins). */
  elapsed: number;
  duration: number;
  from: number;
  to: number;
  disposeOnDone: boolean;
}

const VALID_COLOR = new Color3(0.35, 0.9, 0.45);
const INVALID_COLOR = new Color3(0.95, 0.3, 0.25);
const HIGHLIGHT_POOL_SIZE = 64;

/**
 * The construction tools: building placement with a ghost preview and
 * validity highlighting, rotation, road drawing with grid snapping,
 * and a bulldozer — all driven by taps/drags that work identically
 * with touch and mouse.
 *
 * Placements are hardware instances of per-type template meshes, so
 * draw calls scale with building TYPES, not building count. All
 * placement rules come from the BuildGrid; all catalog data from
 * BuildingCatalog. Outcomes are announced on the EventBus
 * ('building:placed', 'road:placed', …) for future systems (economy,
 * citizens) to consume.
 */
export class ConstructionSystem {
  private scene: Scene | null = null;
  private camera: CityCamera | null = null;
  private picker: GroundPicker | null = null;
  private pointerObserver: Observer<PointerInfo> | null = null;

  private readonly templates = new Map<string, Mesh>();

  private mode: ConstructionMode = 'view';
  private selectedBuildingId: string | null = null;
  private rotation = 0; // 0..3 quarter turns

  private ghost: Mesh | null = null;
  private ghostMaterial: StandardMaterial | null = null;
  private ghostCell: GridCell | null = null;
  private ghostValid = false;

  private highlightTiles: Mesh[] = [];
  private validTileMaterial: StandardMaterial | null = null;
  private invalidTileMaterial: StandardMaterial | null = null;

  private roadAnchor: GridCell | null = null;
  private roadPath: GridCell[] = [];
  private roadPathValid = false;

  private readonly animations: ScaleAnimation[] = [];
  private instanceCounter = 0;

  constructor(
    private readonly config: GameplayConfig,
    private readonly grid: BuildGrid<PlacedItem>,
    private readonly events: EventBus<GameEvents>,
    private readonly roadRenderer: RoadRenderer,
    private readonly roadNetwork: RoadNetwork,
  ) {}

  build(scene: Scene, terrain: TerrainSystem, camera: CityCamera): void {
    this.scene = scene;
    this.camera = camera;
    this.picker = new GroundPicker(scene, terrain);

    for (const def of BUILDING_CATALOG) {
      this.templates.set(def.id, buildBuildingTemplate(scene, def, this.config.cellSize));
    }
    this.roadRenderer.build(scene, terrain);
    this.buildHighlightPool(scene);
    this.buildRoadPreview(scene);

    this.pointerObserver = scene.onPointerObservable.add((info) => this.onPointer(info));
  }

  /** World systems the construction tools cooperate with (optional). */
  private vegetation: VegetationSystem | null = null;
  private environment: EnvironmentSystem | null = null;
  connectWorld(vegetation: VegetationSystem, environment: EnvironmentSystem): void {
    this.vegetation = vegetation;
    this.environment = environment;
  }

  get currentMode(): ConstructionMode {
    return this.mode;
  }

  get currentBuildingId(): string | null {
    return this.selectedBuildingId;
  }

  setMode(mode: ConstructionMode, buildingId: string | null = null): void {
    this.clearPreviews();
    this.mode = mode;
    this.selectedBuildingId = mode === 'build' ? buildingId : null;
    this.rotation = 0;
    // Camera drag would fight with construction taps/drags.
    this.camera?.setPointerControlEnabled(mode === 'view');
    this.events.emit('construction:modeChanged', { mode, buildingId: this.selectedBuildingId });
    this.emitPreviewState();
  }

  rotateGhost(): void {
    if (this.mode !== 'build') {
      return;
    }
    this.rotation = (this.rotation + 1) % 4;
    if (this.ghostCell) {
      this.moveGhost(this.ghostCell);
    }
  }

  /** Place the ghost building if the current position is valid. */
  confirmPlacement(): void {
    if (this.mode !== 'build' || !this.ghostCell || !this.ghostValid || !this.selectedBuildingId) {
      return;
    }
    this.placeBuilding(getBuildingDef(this.selectedBuildingId), this.ghostCell, this.rotation);
    // Stay in build mode so several buildings can be placed in a row;
    // re-validate the ghost since its cells are now occupied.
    this.moveGhost(this.ghostCell);
  }

  cancel(): void {
    this.setMode('view');
  }

  /** Per-frame: advance build/demolish animations. */
  update(deltaSeconds: number): void {
    for (let i = this.animations.length - 1; i >= 0; i -= 1) {
      const anim = this.animations[i]!;
      anim.elapsed += deltaSeconds;
      if (anim.elapsed < 0) {
        continue; // still in its stagger delay
      }
      const t = Math.min(anim.elapsed / anim.duration, 1);
      const eased = anim.to > anim.from ? easeOutBack(t) : t * t;
      const scale = anim.from + (anim.to - anim.from) * eased;
      anim.node.scaling.set(scale, scale, scale);
      if (t >= 1) {
        this.animations.splice(i, 1);
        if (anim.disposeOnDone) {
          anim.node.dispose();
        }
      }
    }
  }

  dispose(): void {
    if (this.scene && this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
    }
    this.pointerObserver = null;
    this.templates.clear();
    this.highlightTiles = [];
    this.animations.length = 0;
    this.scene = null;
    this.camera = null;
    this.picker = null;
  }

  // ------------------------------------------------------------------
  // Pointer handling

  private onPointer(info: PointerInfo): void {
    if (this.mode === 'view') {
      return;
    }
    const event = info.event as PointerEvent;
    switch (info.type) {
      case PointerEventTypes.POINTERMOVE:
        if (this.mode === 'build') {
          const cell = this.cellAt(event.offsetX, event.offsetY);
          if (cell) {
            this.moveGhost(cell);
          }
        } else if (this.mode === 'road' && this.roadAnchor) {
          const cell = this.cellAt(event.offsetX, event.offsetY);
          if (cell) {
            this.previewRoad(this.roadAnchor, cell);
          }
        }
        break;
      case PointerEventTypes.POINTERDOWN:
        if (this.mode === 'road') {
          const cell = this.cellAt(event.offsetX, event.offsetY);
          if (cell) {
            this.roadAnchor = cell;
            this.previewRoad(cell, cell);
          }
        }
        break;
      case PointerEventTypes.POINTERUP:
        if (this.mode === 'road' && this.roadAnchor) {
          this.commitRoad();
          this.roadAnchor = null;
        }
        break;
      case PointerEventTypes.POINTERTAP:
        if (this.mode === 'build') {
          const cell = this.cellAt(event.offsetX, event.offsetY);
          if (cell) {
            this.moveGhost(cell);
          }
        } else if (this.mode === 'bulldoze') {
          const cell = this.cellAt(event.offsetX, event.offsetY);
          if (cell) {
            this.bulldoze(cell);
          }
        }
        break;
      default:
        break;
    }
  }

  private cellAt(screenX: number, screenY: number): GridCell | null {
    const arcCamera = this.camera?.arcCamera;
    if (!this.picker || !arcCamera) {
      return null;
    }
    const point = this.picker.pick(screenX, screenY, arcCamera);
    return point ? this.grid.worldToCell(point.x, point.z) : null;
  }

  // ------------------------------------------------------------------
  // Building ghost

  private footprintCells(origin: GridCell, def: BuildingDef, rotation: number): GridCell[] {
    const w = rotation % 2 === 0 ? def.cellsW : def.cellsD;
    const d = rotation % 2 === 0 ? def.cellsD : def.cellsW;
    const cells: GridCell[] = [];
    for (let dc = 0; dc < w; dc += 1) {
      for (let dr = 0; dr < d; dr += 1) {
        cells.push({ col: origin.col + dc, row: origin.row + dr });
      }
    }
    return cells;
  }

  private footprintCenter(cells: GridCell[]): { x: number; z: number; y: number } {
    let x = 0;
    let z = 0;
    let y = -Infinity;
    for (const cell of cells) {
      const center = this.grid.cellCenter(cell.col, cell.row);
      x += center.x;
      z += center.z;
      y = Math.max(y, this.grid.cellHeight(cell.col, cell.row));
    }
    return { x: x / cells.length, z: z / cells.length, y };
  }

  private moveGhost(origin: GridCell): void {
    if (!this.scene || !this.selectedBuildingId) {
      return;
    }
    const def = getBuildingDef(this.selectedBuildingId);

    if (!this.ghost || this.ghost.name !== `ghost-${def.id}`) {
      this.rebuildGhost(def);
    }
    const ghost = this.ghost;
    if (!ghost) {
      return;
    }

    const cells = this.footprintCells(origin, def, this.rotation);
    const valid = cells.every((c) => this.grid.isPlaceable(c.col, c.row));
    const { x, z, y } = this.footprintCenter(cells);

    ghost.setEnabled(true);
    ghost.position.set(x, y, z);
    ghost.rotation.y = (this.rotation * Math.PI) / 2;
    this.ghostMaterial?.diffuseColor.copyFrom(valid ? VALID_COLOR : INVALID_COLOR);
    this.ghostMaterial?.emissiveColor.copyFrom(valid ? VALID_COLOR : INVALID_COLOR);

    this.showHighlights(cells.map((c) => ({ cell: c, valid: this.grid.isPlaceable(c.col, c.row) })));

    this.ghostCell = origin;
    this.ghostValid = valid;
    this.emitPreviewState();
  }

  private rebuildGhost(def: BuildingDef): void {
    this.ghost?.dispose();
    const template = this.templates.get(def.id);
    if (!template || !this.scene) {
      return;
    }
    const ghost = template.clone(`ghost-${def.id}`);
    ghost.isVisible = true;
    ghost.isPickable = false;
    ghost.useVertexColors = false; // flat tint reads clearly as a preview

    const material = new StandardMaterial('ghost-mat', this.scene);
    material.alpha = 0.55;
    material.specularColor = Color3.Black();
    material.emissiveColor.copyFrom(VALID_COLOR);
    ghost.material = material;

    this.ghost = ghost;
    this.ghostMaterial = material;
  }

  // ------------------------------------------------------------------
  // Placement / removal

  private placeBuilding(def: BuildingDef, origin: GridCell, rotation: number): void {
    const template = this.templates.get(def.id);
    if (!template) {
      return;
    }
    const cells = this.footprintCells(origin, def, rotation);
    const { x, z, y } = this.footprintCenter(cells);

    const instance = template.createInstance(`b${(this.instanceCounter += 1)}-${def.id}`);
    instance.position.set(x, y, z);
    instance.rotation.y = (rotation * Math.PI) / 2;
    instance.isPickable = false;

    const item: PlacedItem = { kind: 'building', defId: def.id, node: instance, cells };
    this.grid.occupy(cells, item);

    // Clear vegetation under the new building and let it cast shadows.
    this.vegetation?.clearArea(x, z, Math.max(def.cellsW, def.cellsD) * this.config.cellSize * 0.8);
    this.environment?.addShadowCaster(instance);

    this.animateIn(instance);
    this.events.emit('building:placed', {
      buildingId: def.id,
      col: origin.col,
      row: origin.row,
      rotation,
    });
    this.events.emit('audio:cue', { cue: 'place' });
  }

  private bulldoze(cell: GridCell): void {
    const item = this.grid.itemAt(cell.col, cell.row);
    if (!item) {
      return;
    }
    this.grid.free(item.cells);
    const origin = item.cells[0]!;

    if (item.kind === 'road') {
      this.roadNetwork.removeCell(origin.col, origin.row);
      const removed = this.roadRenderer.removeCell(origin);
      if (removed) {
        this.animateOut(removed);
      }
      this.events.emit('road:removed', { col: origin.col, row: origin.row });
    } else if (item.node) {
      this.environment?.removeShadowCaster(item.node);
      this.animateOut(item.node);
      if (item.defId) {
        this.events.emit('building:removed', {
          buildingId: item.defId,
          col: origin.col,
          row: origin.row,
        });
      }
    }
    this.events.emit('audio:cue', { cue: 'demolish' });
  }

  private animateIn(node: InstancedMesh, delaySeconds = 0): void {
    node.scaling.set(0.05, 0.05, 0.05);
    this.animations.push({
      node,
      elapsed: -delaySeconds,
      duration: this.config.buildAnimSeconds,
      from: 0.05,
      to: 1,
      disposeOnDone: false,
    });
  }

  private animateOut(node: InstancedMesh): void {
    this.animations.push({
      node,
      elapsed: 0,
      duration: 0.25,
      from: 1,
      to: 0.01,
      disposeOnDone: true,
    });
  }

  // ------------------------------------------------------------------
  // Roads

  /** L-shaped path between two cells (columns first, then rows). */
  private roadCellsBetween(a: GridCell, b: GridCell): GridCell[] {
    const cells: GridCell[] = [];
    const stepC = Math.sign(b.col - a.col);
    for (let c = a.col; c !== b.col; c += stepC) {
      cells.push({ col: c, row: a.row });
    }
    const stepR = Math.sign(b.row - a.row);
    for (let r = a.row; r !== b.row; r += stepR) {
      cells.push({ col: b.col, row: r });
    }
    cells.push({ col: b.col, row: b.row });
    return cells.slice(0, this.config.maxRoadLength);
  }

  /** Roads may pass through existing road cells (crossings/extensions). */
  private roadCellOk(cell: GridCell): boolean {
    if (this.grid.isPlaceable(cell.col, cell.row)) {
      return true;
    }
    const occupant = this.grid.itemAt(cell.col, cell.row);
    return occupant?.kind === 'road';
  }

  private previewRoad(from: GridCell, to: GridCell): void {
    this.roadPath = this.roadCellsBetween(from, to);
    this.roadPathValid = this.roadPath.every((c) => this.roadCellOk(c));

    // Smooth ribbon along the two legs of the L, capped with dots —
    // reads as one continuous road-to-be instead of a trail of tiles.
    this.showRoadRibbon(from, this.roadPath[this.roadPath.length - 1] ?? from, this.roadPathValid);
    // Blocking cells still get explicit red tiles so the player sees
    // exactly where the problem is.
    this.showHighlights(
      this.roadPath.filter((cell) => !this.roadCellOk(cell)).map((cell) => ({ cell, valid: false })),
    );
    this.emitPreviewState(this.roadPathValid);
  }

  private commitRoad(): void {
    const path = this.roadPath;
    this.hideRoadRibbon();
    this.hideHighlights();
    this.roadPath = [];
    if (!this.roadPathValid || path.length === 0) {
      if (path.length > 0) {
        this.events.emit('audio:cue', { cue: 'invalid' });
      }
      return;
    }

    // Cells already carrying road pass through untouched; only claim
    // the genuinely new ones.
    const newCells = path.filter((cell) => this.grid.isPlaceable(cell.col, cell.row));
    if (newCells.length === 0) {
      return;
    }

    // Data first: claim cells and update the logical road graph.
    for (const cell of newCells) {
      const item: PlacedItem = { kind: 'road', defId: null, node: null, cells: [cell] };
      this.grid.occupy([cell], item);
      this.roadNetwork.addCell(cell.col, cell.row);
      const { x, z } = this.grid.cellCenter(cell.col, cell.row);
      this.vegetation?.clearArea(x, z, this.config.cellSize * 0.7);
    }

    // Then visuals: the renderer resolves connected pieces for the
    // whole path (and its neighbors) at once; pop them in with a
    // little ripple along the path.
    const instances = this.roadRenderer.addCells(newCells);
    instances.forEach((instance, i) => this.animateIn(instance, i * 0.045));

    this.events.emit('road:placed', { length: newCells.length });
    this.events.emit('audio:cue', { cue: 'road' });
  }

  // ------------------------------------------------------------------
  // Road drag ribbon preview

  private ribbonLegs: Mesh[] = [];
  private ribbonCaps: Mesh[] = [];

  private buildRoadPreview(scene: Scene): void {
    for (let i = 0; i < 2; i += 1) {
      const leg = CreateBox(`ribbon-leg-${i}`, { width: 1, depth: 1, height: 0.14 }, scene);
      leg.isPickable = false;
      leg.setEnabled(false);
      this.ribbonLegs.push(leg);

      const cap = CreateCylinder(
        `ribbon-cap-${i}`,
        { diameter: this.config.cellSize * 0.62, height: 0.16, tessellation: 20 },
        scene,
      );
      cap.isPickable = false;
      cap.setEnabled(false);
      this.ribbonCaps.push(cap);
    }
  }

  /** One continuous band along both legs of the L, with endpoint dots. */
  private showRoadRibbon(from: GridCell, to: GridCell, valid: boolean): void {
    const material = valid ? this.validTileMaterial : this.invalidTileMaterial;
    const width = this.config.cellSize * 0.56;

    const a = this.grid.cellCenter(from.col, from.row);
    const corner = this.grid.cellCenter(to.col, from.row);
    const b = this.grid.cellCenter(to.col, to.row);

    // Horizontal leg (along X at from.row), then vertical leg (along Z).
    this.layRibbonLeg(this.ribbonLegs[0]!, a.x, corner.x, a.z, a.z, width, material);
    this.layRibbonLeg(this.ribbonLegs[1]!, b.x, b.x, corner.z, b.z, width, material);

    const capA = this.ribbonCaps[0]!;
    capA.position.set(a.x, this.grid.cellHeight(from.col, from.row) + 0.4, a.z);
    capA.material = material;
    capA.setEnabled(true);
    const capB = this.ribbonCaps[1]!;
    capB.position.set(b.x, this.grid.cellHeight(to.col, to.row) + 0.4, b.z);
    capB.material = material;
    capB.setEnabled(true);
  }

  private layRibbonLeg(
    leg: Mesh,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    width: number,
    material: Mesh['material'],
  ): void {
    const lengthX = Math.abs(x1 - x0) + width;
    const lengthZ = Math.abs(z1 - z0) + width;
    const midX = (x0 + x1) / 2;
    const midZ = (z0 + z1) / 2;
    // Float the band just above the terrain along its span.
    const y =
      Math.max(
        this.grid.cellHeight(...this.cellIndexAt(x0, z0)),
        this.grid.cellHeight(...this.cellIndexAt(x1, z1)),
        this.grid.cellHeight(...this.cellIndexAt(midX, midZ)),
      ) + 0.35;
    leg.scaling.set(lengthX, 1, lengthZ);
    leg.position.set(midX, y, midZ);
    leg.material = material;
    leg.setEnabled(true);
  }

  private cellIndexAt(x: number, z: number): [number, number] {
    const cell = this.grid.worldToCell(x, z);
    return cell ? [cell.col, cell.row] : [0, 0];
  }

  private hideRoadRibbon(): void {
    for (const mesh of [...this.ribbonLegs, ...this.ribbonCaps]) {
      mesh.setEnabled(false);
    }
  }

  // ------------------------------------------------------------------
  // Cell highlight tiles

  private buildHighlightPool(scene: Scene): void {
    this.validTileMaterial = new StandardMaterial('tile-valid', scene);
    this.validTileMaterial.emissiveColor.copyFrom(VALID_COLOR);
    this.validTileMaterial.disableLighting = true;
    this.validTileMaterial.alpha = 0.4;

    this.invalidTileMaterial = new StandardMaterial('tile-invalid', scene);
    this.invalidTileMaterial.emissiveColor.copyFrom(INVALID_COLOR);
    this.invalidTileMaterial.disableLighting = true;
    this.invalidTileMaterial.alpha = 0.4;

    const size = this.config.cellSize * 0.96;
    for (let i = 0; i < HIGHLIGHT_POOL_SIZE; i += 1) {
      const tile = CreateBox(`tile-${i}`, { width: size, depth: size, height: 0.08 }, scene);
      tile.isPickable = false;
      tile.setEnabled(false);
      tile.material = this.validTileMaterial;
      this.highlightTiles.push(tile);
    }
  }

  private showHighlights(entries: { cell: GridCell; valid: boolean }[]): void {
    this.hideHighlights();
    const count = Math.min(entries.length, this.highlightTiles.length);
    for (let i = 0; i < count; i += 1) {
      const { cell, valid } = entries[i]!;
      const tile = this.highlightTiles[i]!;
      const { x, z } = this.grid.cellCenter(cell.col, cell.row);
      tile.position.set(x, this.grid.cellHeight(cell.col, cell.row) + 0.15, z);
      tile.material = valid ? this.validTileMaterial : this.invalidTileMaterial;
      tile.setEnabled(true);
    }
  }

  private hideHighlights(): void {
    for (const tile of this.highlightTiles) {
      tile.setEnabled(false);
    }
  }

  private clearPreviews(): void {
    this.ghost?.dispose();
    this.ghost = null;
    this.ghostMaterial = null;
    this.ghostCell = null;
    this.ghostValid = false;
    this.roadAnchor = null;
    this.roadPath = [];
    this.hideHighlights();
    this.hideRoadRibbon();
  }

  private emitPreviewState(validOverride?: boolean): void {
    const active = this.mode === 'build' ? this.ghostCell !== null : this.mode === 'road';
    const valid = validOverride ?? this.ghostValid;
    this.events.emit('construction:previewChanged', { active, valid });
  }
}

/** Ease-out with a small overshoot — the classic "pop" of a new building. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
