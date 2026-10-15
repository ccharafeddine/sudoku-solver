/**
 * "Enter my own puzzle": the plain-words checks shown while a player types in
 * a puzzle from a book or newspaper. Pure, so it is tested without a page.
 */
import { conflicts, groupWords, type Geo, type Grid } from '../sudoku/board';
import type { Variant } from '../sudoku/board';
import type { Snapshot } from './history';

/** Fewest givens a puzzle of each shape can have and still have one answer. */
export const MIN_GIVENS: Record<Variant, number> = { classic: 17, diagonal: 12, killer: 0, mini6: 8, mini4: 4 };

/** Killer cages can't be drawn by hand yet, so only these shapes can be typed in. */
export const canEnter = (v: Variant) => v !== 'killer';

export interface EntryState { count: number; least: number; clashes: Set<number>; text: string; ready: boolean }

export function entryState(values: Grid, geo: Geo): EntryState {
  const count = values.filter((v) => v > 0).length;
  const least = MIN_GIVENS[geo.variant];
  const clashes = conflicts(values, geo);
  let text = `Type the numbers from your puzzle, then press Done. ${count} number${count === 1 ? '' : 's'} so far.`;
  if (clashes.size) text += ` The red squares clash: the same number twice in a ${groupWords(geo)}.`;
  else if (count < least) text += ` A puzzle this size needs at least ${least}.`;
  return { count, least, clashes, text, ready: !clashes.size && count >= least };
}

/** Words for Done when the typed puzzle can't be used as it is. */
export function doneProblem(s: EntryState, answer: 'unique' | 'none' | 'multiple', reason = ''): string | null {
  if (s.clashes.size) return 'Some squares clash (they are red). Fix them, then press Done.';
  if (s.count < s.least) return `That's only ${s.count} number${s.count === 1 ? '' : 's'}. A puzzle this size needs at least ${s.least} to have just one answer. Add the rest from your puzzle.`;
  if (answer === 'none') return `This puzzle can't be solved${reason ? `: ${reason.replace(/\.$/, '')}` : ''}. Check you copied it right.`;
  if (answer === 'multiple') return 'This puzzle has more than one answer. Check you copied every number, or add more.';
  return null;
}

/** True when the player has done something on the board that "Enter my own" would wipe. */
export const hasProgress = (s: Snapshot) => s.values.some((v, i) => v > 0 && !s.givens[i]) || s.notes.some((m) => m) || s.elims.some((m) => m);
