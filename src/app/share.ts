/**
 * Import and export: the plain digit string, a share link, and the hash
 * that carries a puzzle (its shape, Killer cages, and optionally the player's
 * progress) in the URL.
 */
import { VARIANTS, gridString, parseGrid, type Cage, type Grid, type Variant } from '../sudoku/board';

export interface Shared { variant: Variant; givens: Grid; entered: Grid | null; cages: Cage[] }

const SIZE: Record<Variant, number> = { classic: 81, diagonal: 81, killer: 81, mini6: 36, mini4: 16 };

/** Cages as two base-36 characters per cell (the cage number) plus a comma list of sums. */
export function encodeCages(cages: Cage[], size = 81): { k: string; s: string } {
  const id = new Array(size).fill(0);
  cages.forEach((c, n) => c.cells.forEach((i) => (id[i] = n)));
  return { k: id.map((n) => n.toString(36).padStart(2, '0')).join(''), s: cages.map((c) => c.sum).join(',') };
}
export function decodeCages(k: string, s: string, size = 81): Cage[] | null {
  if (!/^[0-9a-z]+$/.test(k) || k.length !== size * 2) return null;
  const sums = s.split(',').map(Number);
  const cages: Cage[] = sums.map((sum) => ({ cells: [], sum }));
  for (let i = 0; i < size; i++) {
    const n = parseInt(k.slice(i * 2, i * 2 + 2), 36);
    if (!cages[n]) return null;
    cages[n].cells.push(i);
  }
  return cages.every((c) => c.cells.length && Number.isInteger(c.sum) && c.sum > 0) ? cages : null;
}

/** #p=<givens>[&e=<entered>][&v=<shape>][&k=..&s=..] using '0' for blanks, so links survive every chat app. */
export function toHash(givens: Grid, entered?: Grid, variant: Variant = 'classic', cages: Cage[] = []): string {
  let h = `#p=${gridString(givens, true)}`;
  if (entered && entered.some((v) => v)) h += `&e=${gridString(entered, true)}`;
  if (variant !== 'classic') h += `&v=${variant}`;
  if (variant === 'killer') { const c = encodeCages(cages); h += `&k=${c.k}&s=${c.s}`; }
  return h;
}

export function fromHash(hash: string): Shared | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const v = q.get('v') ?? 'classic';
  if (!VARIANTS.includes(v as Variant)) return null;
  const variant = v as Variant, size = SIZE[variant];
  const p = q.get('p');
  const givens = p ? parseGrid(p, size) : null;
  if (!givens) return null;
  const e = q.get('e');
  let entered = e ? parseGrid(e, size) : null;
  // Entered digits can never overwrite a given.
  if (entered) entered = entered.map((x, i) => (givens[i] ? 0 : x));
  let cages: Cage[] = [];
  if (variant === 'killer') {
    const c = decodeCages(q.get('k') ?? '', q.get('s') ?? '');
    if (!c) return null;
    cages = c;
  }
  return { variant, givens, entered, cages };
}

/**
 * Anything a person might paste: a share link, or a digit string / pretty grid
 * (81 cells for 9x9, 36 for 6x6, 16 for 4x4). A 9x9 string takes the shape the
 * player has picked when that is Diagonal; Killer needs a link (it has cages).
 */
export function importText(text: string, current: Variant = 'classic'): Shared | null {
  const t = text.trim();
  const hashAt = t.indexOf('#p=');
  if (hashAt >= 0) return fromHash(t.slice(hashAt));
  for (const [variant, size] of [['classic', 81], ['mini6', 36], ['mini4', 16]] as const) {
    const g = parseGrid(t, size);
    if (g) return { variant: variant === 'classic' && current === 'diagonal' ? 'diagonal' : variant, givens: g, entered: null, cages: [] };
  }
  return null;
}

export const shareUrl = (base: string, givens: Grid, entered?: Grid, variant: Variant = 'classic', cages: Cage[] = []) => base.replace(/#.*$/, '') + toHash(givens, entered, variant, cages);
