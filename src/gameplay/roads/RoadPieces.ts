import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Connection bitmask: which neighbors of a road cell are also roads.
 * N = -z (row-1), E = +x (col+1), S = +z (row+1), W = -x (col-1).
 */
export const DIR_N = 1;
export const DIR_E = 2;
export const DIR_S = 4;
export const DIR_W = 8;

export type RoadPieceType = 'isolated' | 'end' | 'straight' | 'corner' | 'tee' | 'cross';

/** Canonical connection mask each piece is modeled with. */
const CANONICAL_MASK: Record<RoadPieceType, number> = {
  isolated: 0,
  end: DIR_N,
  straight: DIR_N | DIR_S,
  corner: DIR_N | DIR_E,
  tee: DIR_N | DIR_E | DIR_S,
  cross: DIR_N | DIR_E | DIR_S | DIR_W,
};

/** Rotate a connection mask 90° clockwise (N→E→S→W→N). */
function rotateMaskCw(mask: number): number {
  return ((mask << 1) & 0xf) | (mask >> 3);
}

export interface ResolvedPiece {
  type: RoadPieceType;
  /** Quarter turns to apply to the canonical piece. */
  quarterTurns: number;
}

const RESOLVE_TABLE: ResolvedPiece[] = buildResolveTable();

function buildResolveTable(): ResolvedPiece[] {
  const table = new Array<ResolvedPiece>(16);
  for (const type of Object.keys(CANONICAL_MASK) as RoadPieceType[]) {
    let mask = CANONICAL_MASK[type];
    for (let k = 0; k < 4; k += 1) {
      if (table[mask] === undefined) {
        table[mask] = { type, quarterTurns: k };
      }
      mask = rotateMaskCw(mask);
    }
  }
  return table;
}

/** Piece type + rotation for a connection mask (0..15). */
export function resolvePiece(mask: number): ResolvedPiece {
  return RESOLVE_TABLE[mask & 0xf]!;
}

// Cozy stylized road palette.
const ASPHALT = { r: 0.24, g: 0.24, b: 0.26 };
const SIDEWALK = { r: 0.66, g: 0.63, b: 0.57 };
const DASH = { r: 0.9, g: 0.85, b: 0.66 };
// Exposed slab sides on slopes read as an earth embankment, not asphalt.
const EARTH = { r: 0.45, g: 0.38, b: 0.29 };

/**
 * Builds the six hidden road piece templates. Each is a merged,
 * vertex-colored mesh: a thick asphalt slab (sunk into the terrain so
 * slopes never show gaps), raised sidewalk strips along unconnected
 * edges, corner nubs where two open connections meet, and lane dashes
 * on straight pieces. Placed cells are hardware instances of these,
 * so the whole road network costs at most 6 draw calls.
 */
export function buildRoadPieceTemplates(scene: Scene, cellSize: number): Map<RoadPieceType, Mesh> {
  const templates = new Map<RoadPieceType, Mesh>();
  for (const type of Object.keys(CANONICAL_MASK) as RoadPieceType[]) {
    templates.set(type, buildPiece(scene, type, cellSize));
  }
  return templates;
}

function buildPiece(scene: Scene, type: RoadPieceType, cellSize: number): Mesh {
  const s = cellSize;
  const walkW = 0.66; // sidewalk width
  const edge = s / 2 - walkW / 2; // sidewalk strip center offset
  const parts: Mesh[] = [];

  // Asphalt: sunk slab — deep enough that neighboring tilted pieces
  // overlap through the terrain on slopes; earth-colored sides make
  // any exposed edge read as a roadbed embankment.
  const asphalt = CreateBox('asphalt', { width: s, depth: s, height: 1.1 }, scene);
  asphalt.position.y = 0.18 - 0.55; // top surface at +0.18
  paintTopAndSides(asphalt, ASPHALT, EARTH);
  parts.push(asphalt);

  const mask = CANONICAL_MASK[type];
  const openN = (mask & DIR_N) === 0;
  const openE = (mask & DIR_E) === 0;
  const openS = (mask & DIR_S) === 0;
  const openW = (mask & DIR_W) === 0;

  const addStrip = (width: number, depth: number, x: number, z: number): void => {
    const strip = CreateBox('walk', { width, depth, height: 1.2 }, scene);
    strip.position.set(x, 0.3 - 0.6, z); // top surface at +0.30
    paintTopAndSides(strip, SIDEWALK, SIDEWALK);
    parts.push(strip);
  };

  // Full-width strips on open N/S edges; E/W strips fill between them.
  if (openN) {
    addStrip(s, walkW, 0, -edge);
  }
  if (openS) {
    addStrip(s, walkW, 0, edge);
  }
  const ewDepth = s - (openN ? walkW : 0) - (openS ? walkW : 0);
  const ewShift = ((openN ? walkW : 0) - (openS ? walkW : 0)) / 2;
  if (openE) {
    addStrip(walkW, ewDepth, edge, ewShift);
  }
  if (openW) {
    addStrip(walkW, ewDepth, -edge, ewShift);
  }

  // Corner nubs where two CONNECTED edges meet (crosswalk corners).
  const nub = (x: number, z: number): void => addStrip(walkW, walkW, x, z);
  if (type === 'corner') {
    nub(edge, -edge); // between N and E connections
  } else if (type === 'tee') {
    nub(edge, -edge); // N–E corner
    nub(edge, edge); // E–S corner
  } else if (type === 'cross') {
    nub(edge, -edge);
    nub(edge, edge);
    nub(-edge, edge);
    nub(-edge, -edge);
  }

  // Center-line dashes along straight runs.
  if (type === 'straight') {
    for (const z of [-s * 0.3, 0, s * 0.3]) {
      const dash = CreateBox('dash', { width: 0.26, depth: s * 0.18, height: 0.03 }, scene);
      dash.position.set(0, 0.185, z);
      paint(dash, DASH);
      parts.push(dash);
    }
  } else if (type === 'end') {
    const dash = CreateBox('dash', { width: 0.26, depth: s * 0.18, height: 0.03 }, scene);
    dash.position.set(0, 0.185, -s * 0.3);
    paint(dash, DASH);
    parts.push(dash);
  }

  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) {
    throw new Error(`[RoadPieces] failed to merge piece "${type}"`);
  }
  merged.name = `road-${type}`;

  const material = new StandardMaterial(`road-${type}-mat`, scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  // Slight emissive floor, matching buildings: readable at dusk/night.
  material.emissiveColor = new Color3(0.07, 0.07, 0.075);
  merged.material = material;
  merged.receiveShadows = true;
  merged.isPickable = false;
  merged.isVisible = false; // template — cells are instances

  return merged;
}

function paint(mesh: Mesh, color: { r: number; g: number; b: number }): void {
  paintTopAndSides(mesh, color, color);
}

/** Vertex-color the up-facing surface one color and everything else another. */
function paintTopAndSides(
  mesh: Mesh,
  top: { r: number; g: number; b: number },
  side: { r: number; g: number; b: number },
): void {
  const count = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const up = normals ? normals[i * 3 + 1]! > 0.5 : true;
    const c = up ? top : side;
    colors[i * 4] = c.r;
    colors[i * 4 + 1] = c.g;
    colors[i * 4 + 2] = c.b;
    colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
}
