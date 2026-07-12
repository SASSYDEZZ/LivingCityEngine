/**
 * Data definitions for placeable buildings (see ARCHITECTURE.md
 * "Data Design" — game data separated from code). Adding a building
 * here is enough for it to appear in the HUD and be placeable; the
 * mesh is generated procedurally from these values.
 */
export interface BuildingDef {
  readonly id: string;
  readonly name: string;
  /** Emoji used as the HUD button icon (asset-free UI). */
  readonly icon: string;
  /** Footprint in grid cells before rotation. */
  readonly cellsW: number;
  readonly cellsD: number;
  /** Body (walls) proportions and colors. */
  readonly bodyHeight: number;
  readonly bodyColor: { r: number; g: number; b: number };
  readonly roofHeight: number;
  readonly roofColor: { r: number; g: number; b: number };
}

export const BUILDING_CATALOG: readonly BuildingDef[] = [
  {
    id: 'house',
    name: 'House',
    icon: '🏠',
    cellsW: 1,
    cellsD: 1,
    bodyHeight: 2.3,
    bodyColor: { r: 0.93, g: 0.87, b: 0.72 },
    roofHeight: 1.7,
    roofColor: { r: 0.78, g: 0.35, b: 0.26 },
  },
  {
    id: 'cabin',
    name: 'Cabin',
    icon: '🏡',
    cellsW: 1,
    cellsD: 2,
    bodyHeight: 2.1,
    bodyColor: { r: 0.62, g: 0.45, b: 0.3 },
    roofHeight: 1.5,
    roofColor: { r: 0.35, g: 0.27, b: 0.2 },
  },
];

export function getBuildingDef(id: string): BuildingDef {
  const def = BUILDING_CATALOG.find((b) => b.id === id);
  if (!def) {
    throw new Error(`[BuildingCatalog] unknown building "${id}"`);
  }
  return def;
}
