/** A play timer that only counts while it runs, so pausing (or a hidden tab) never adds time. */
export class Timer {
  private acc = 0;
  private since: number | null = null;
  constructor(private now: () => number = () => performance.now()) {}
  get running() { return this.since !== null; }
  start() { if (this.since === null) this.since = this.now(); }
  pause() { if (this.since !== null) { this.acc += this.now() - this.since; this.since = null; } }
  reset(ms = 0) { this.acc = ms; this.since = null; }
  get ms() { return this.acc + (this.since === null ? 0 : this.now() - this.since); }
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Delay between playback steps for a speed slider from 0 (slow) to 100 (fast). */
export const stepDelay = (speed: number) => Math.round(2200 * Math.pow(0.04, Math.max(0, Math.min(100, speed)) / 100));
