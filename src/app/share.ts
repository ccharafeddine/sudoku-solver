/**
 * Import and export: the 81-character string, a share link, and the hash
 * that carries a puzzle (and optionally the player's progress) in the URL.
 */
import { gridString, parseGrid, type Grid } from '../sudoku/board';

export interface Shared { givens: Grid; entered: Grid | null }

/** #p=<81 givens>[&e=<81 entered digits>] using '0' for blanks, so links survive every chat app. */
export function toHash(givens: Grid, entered?: Grid): string {
  let h = `#p=${gridString(givens, true)}`;
  if (entered && entered.some((v) => v)) h += `&e=${gridString(entered, true)}`;
  return h;
}

export function fromHash(hash: string): Shared | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const p = q.get('p');
  const givens = p ? parseGrid(p) : null;
  if (!givens) return null;
  const e = q.get('e');
  let entered = e ? parseGrid(e) : null;
  // Entered digits can never overwrite a given.
  if (entered) entered = entered.map((v, i) => (givens[i] ? 0 : v));
  return { givens, entered };
}

/** Anything a person might paste: a share link, an 81-char string, or a pretty grid. */
export function importText(text: string): Shared | null {
  const t = text.trim();
  const hashAt = t.indexOf('#p=');
  if (hashAt >= 0) return fromHash(t.slice(hashAt));
  const g = parseGrid(t);
  return g ? { givens: g, entered: null } : null;
}

export const shareUrl = (base: string, givens: Grid, entered?: Grid) => base.replace(/#.*$/, '') + toHash(givens, entered);
