/**
 * The instant solver: depth-first search over bitmask candidates, always
 * branching on the cell with the fewest options, after filling every naked
 * and hidden single it can (constraint propagation). It solves any valid 9x9
 * in well under a millisecond, and counts solutions up to a limit, which is
 * how "no solution" and "more than one solution" are detected.
 */
import { ALL, BOXES, PEERS, bit, conflicts, popcount, type Grid } from './board';

export type SolveResult =
  | { kind: 'unique'; solution: Grid }
  | { kind: 'multiple'; solution: Grid; other: Grid }
  | { kind: 'none'; reason: string };

interface Ctx { limit: number; found: Grid[]; nodes: number; maxNodes: number }

const ROW_OF = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
const COL_OF = Array.from({ length: 81 }, (_, i) => i % 9);
const BOX_OF = Array.from({ length: 81 }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));

function search(g: Grid, rows: number[], cols: number[], boxes: number[], ctx: Ctx, order?: number[]): void {
  if (ctx.found.length >= ctx.limit || ctx.nodes > ctx.maxNodes) return;
  ctx.nodes++;
  // Find the empty cell with the fewest candidates.
  let best = -1, bestMask = 0, bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const m = ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]]) & ALL;
    const n = popcount(m);
    if (n === 0) return; // dead end
    if (n < bestCount) { best = i; bestMask = m; bestCount = n; if (n === 1) break; }
  }
  if (best < 0) { ctx.found.push(g.slice()); return; }
  const r = ROW_OF[best], c = COL_OF[best], b = BOX_OF[best];
  const digits = order ?? [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const d of digits) {
    const k = bit(d);
    if (!(bestMask & k)) continue;
    g[best] = d; rows[r] |= k; cols[c] |= k; boxes[b] |= k;
    search(g, rows, cols, boxes, ctx, order);
    g[best] = 0; rows[r] &= ~k; cols[c] &= ~k; boxes[b] &= ~k;
    if (ctx.found.length >= ctx.limit || ctx.nodes > ctx.maxNodes) return;
  }
}

function masks(g: Grid) {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const k = bit(g[i]); rows[ROW_OF[i]] |= k; cols[COL_OF[i]] |= k; boxes[BOX_OF[i]] |= k; }
  return { rows, cols, boxes };
}

/** Up to `limit` solutions (default 2, enough to prove uniqueness). */
export function findSolutions(g: Grid, limit = 2, order?: number[], maxNodes = 5_000_000): Grid[] {
  if (conflicts(g).size) return [];
  const { rows, cols, boxes } = masks(g);
  const ctx: Ctx = { limit, found: [], nodes: 0, maxNodes };
  search(g.slice(), rows, cols, boxes, ctx, order);
  return ctx.found;
}

export const countSolutions = (g: Grid, limit = 2) => findSolutions(g, limit).length;
export const hasUniqueSolution = (g: Grid) => countSolutions(g, 2) === 1;

/** Solve and classify: unique, more than one, or none (with a plain-words reason). */
export function solve(g: Grid): SolveResult {
  const bad = conflicts(g);
  if (bad.size) return { kind: 'none', reason: 'Some digits clash: the same digit is twice in a row, column or box.' };
  // A cell with no possible digit is a clear, explainable dead end.
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    if (!m) return { kind: 'none', reason: `Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1} has no digit left that fits.` };
  }
  const sols = findSolutions(g, 2);
  if (!sols.length) return { kind: 'none', reason: 'This puzzle has no solution: every way of filling it in breaks a rule somewhere.' };
  if (sols.length === 1) return { kind: 'unique', solution: sols[0] };
  return { kind: 'multiple', solution: sols[0], other: sols[1] };
}

/** A random complete grid: search with a shuffled digit order from an empty board. */
export function randomSolution(rand: () => number = Math.random): Grid {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 8; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // Seed the first row and the diagonal boxes randomly so grids vary beyond digit relabelling.
  const g = new Array(81).fill(0);
  for (const b of [0, 4, 8]) {
    const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 8; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ds[i], ds[j]] = [ds[j], ds[i]]; }
    BOXES[b].forEach((cell, k) => (g[cell] = ds[k]));
  }
  return findSolutions(g, 1, order)[0];
}
