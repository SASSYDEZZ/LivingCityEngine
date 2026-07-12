/**
 * Game-time clock driving the day/night cycle.
 *
 * Time of day is normalized: 0 = midnight, 0.25 = sunrise,
 * 0.5 = noon, 0.75 = sunset. Systems read `timeOfDay` (or the derived
 * `sunElevation`) each frame; nothing else owns time.
 */
export class DayNightCycle {
  private time: number;

  constructor(
    private readonly dayLengthSeconds: number,
    initialTimeOfDay: number,
  ) {
    this.time = ((initialTimeOfDay % 1) + 1) % 1;
  }

  update(deltaSeconds: number): void {
    this.time = (this.time + deltaSeconds / this.dayLengthSeconds) % 1;
  }

  /** Normalized time of day in [0, 1). */
  get timeOfDay(): number {
    return this.time;
  }

  /**
   * Sun height factor in [-1, 1]: -1 at midnight, 0 at sunrise/sunset,
   * +1 at noon. Environment color blending keys off this value.
   */
  get sunElevation(): number {
    return -Math.cos(this.time * Math.PI * 2);
  }
}
