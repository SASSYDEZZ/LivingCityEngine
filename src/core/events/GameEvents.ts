/**
 * Central registry of engine/game event names and their payload types.
 *
 * Every cross-system event must be declared here so that producers and
 * consumers share one contract. Add new entries as systems appear
 * (e.g. 'building:placed', 'citizen:created' in later phases).
 */
export interface GameEvents extends Record<string, unknown> {
  /** Fired once the render loop is running. */
  'engine:started': { timestampMs: number };
  /** Fired after the render loop stops. */
  'engine:stopped': { timestampMs: number };
  /** Fired whenever the render surface is resized. */
  'engine:resized': { width: number; height: number };
  /** Fired after the active scene changes. */
  'scene:changed': { sceneKey: string };
  /** Fired when the construction tool mode changes. */
  'construction:modeChanged': { mode: string; buildingId: string | null };
  /** Fired whenever the placement preview moves or changes validity. */
  'construction:previewChanged': { active: boolean; valid: boolean };
  /** Fired after a building is placed on the grid. */
  'building:placed': { buildingId: string; col: number; row: number; rotation: number };
  /** Fired after a building is bulldozed. */
  'building:removed': { buildingId: string; col: number; row: number };
  /** Fired after a road path is committed (length in cells). */
  'road:placed': { length: number };
  /** Fired after a road cell is bulldozed. */
  'road:removed': { col: number; row: number };
  /**
   * Sound hook: a future AudioSystem subscribes and plays the cue.
   * Emitted at gameplay moments (placement, demolish, invalid action).
   */
  'audio:cue': { cue: 'place' | 'demolish' | 'road' | 'invalid' };
}
