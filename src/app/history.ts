/**
 * Undo/redo as a two-way timeline. Every action stores a full snapshot of the
 * board (81 digits, 81 note masks, 81 ruled-out masks: tiny), so jumping to
 * any point, forwards or backwards, is just picking a snapshot.
 */
export interface Snapshot {
  values: number[];
  givens: boolean[];
  /** Hand-written pencil marks, as 9-bit masks. */
  notes: number[];
  /** Candidates ruled out on top of the automatic pencil marks. */
  elims: number[];
}
export interface Entry { label: string; snap: Snapshot }

export const cloneSnap = (s: Snapshot): Snapshot => ({ values: s.values.slice(), givens: s.givens.slice(), notes: s.notes.slice(), elims: s.elims.slice() });
export const blankSnap = (): Snapshot => ({ values: new Array(81).fill(0), givens: new Array(81).fill(false), notes: new Array(81).fill(0), elims: new Array(81).fill(0) });
export const sameSnap = (a: Snapshot, b: Snapshot) =>
  a.values.every((v, i) => v === b.values[i] && a.givens[i] === b.givens[i] && a.notes[i] === b.notes[i] && a.elims[i] === b.elims[i]);

export class History {
  private entries: Entry[];
  private i = 0;
  constructor(start: Snapshot, label = 'Start') { this.entries = [{ label, snap: cloneSnap(start) }]; }

  get index() { return this.i; }
  get length() { return this.entries.length; }
  get current(): Snapshot { return cloneSnap(this.entries[this.i].snap); }
  get list(): readonly Entry[] { return this.entries; }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i < this.entries.length - 1; }

  /** Record a new state after the current one; anything that was redoable is dropped. A no-op change records nothing. */
  push(snap: Snapshot, label: string): boolean {
    if (sameSnap(snap, this.entries[this.i].snap)) return false;
    this.entries.length = this.i + 1;
    this.entries.push({ label, snap: cloneSnap(snap) });
    this.i++;
    return true;
  }
  undo(): Snapshot | null { if (!this.canUndo) return null; this.i--; return this.current; }
  redo(): Snapshot | null { if (!this.canRedo) return null; this.i++; return this.current; }
  /** Jump to any point on the timeline, either direction. */
  jump(k: number): Snapshot { this.i = Math.max(0, Math.min(this.entries.length - 1, k)); return this.current; }
  /** Start over from a new puzzle. */
  reset(start: Snapshot, label: string) { this.entries = [{ label, snap: cloneSnap(start) }]; this.i = 0; }
}
