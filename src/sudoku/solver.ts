/**
 * The instant solver: depth-first search over bitmask candidates, always
 * branching on the cell with the fewest options. It works for every shape in
 * board.ts: each group keeps a mask of the digits it already has, and Killer
 * cages also check that their total can still be made. It counts solutions up
 * to a limit, which is how "no solution" and "more than one" are detected.
 */
import { CLASSIC, bit, conflicts, popcount, type Geo, type Grid } from './board';

export type SolveResult =
  | { kind: 'unique'; solution: Grid }
  | { kind: 'multiple'; solution: Grid; other: Grid }
  | { kind: 'none'; reason: string };

/** Can `k` different digits from `mask` add up to `sum`? (memoised; used for Killer cages) */
const sumMemo = new Map<number, boolean>();
export function canMakeSum(mask: number, k: number, sum: number): boolean {
  if (k === 0) return sum === 0;
  if (sum <= 0 || popcount(mask) < k) return false;
  const key = (mask * 16 + k) * 64 + sum;
  const hit = sumMemo.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  for (let d = 1; !ok && mask >> (d - 1); d++) if (mask & bit(d) && d <= sum) ok = canMakeSum(mask & ~((bit(d) << 1) - 1), k - 1, sum - d);
  sumMemo.set(key, ok);
  return ok;
}

interface Ctx { limit: number; found: Grid[]; nodes: number; maxNodes: number; rand?: () => number }

class Search {
  unitMask: number[];
  cageSum: number[];
  cageLeft: number[];
  constructor(readonly geo: Geo, readonly g: Grid) {
    this.unitMask = geo.units.map((u) => u.cells.reduce((m, i) => (g[i] ? m | bit(g[i]) : m), 0));
    this.cageSum = geo.cages.map((c) => c.cells.reduce((a, i) => a + g[i], 0));
    this.cageLeft = geo.cages.map((c) => c.cells.filter((i) => !g[i]).length);
  }
  options(i: number): number {
    const { geo } = this;
    let used = 0;
    for (const u of geo.unitsOf[i]) used |= this.unitMask[u];
    let m = geo.all & ~used;
    const c = geo.cageOf[i];
    if (c >= 0 && m) {
      const cage = geo.cages[c];
      const left = this.cageLeft[c], rest = cage.sum - this.cageSum[c];
      const free = geo.all & ~this.unitMask[geo.unitsOf[i].find((u) => geo.units[u].kind === 'cage')!];
      for (let d = 1; d <= geo.n; d++) if (m & bit(d) && !canMakeSum(free & ~bit(d), left - 1, rest - d)) m &= ~bit(d);
    }
    return m;
  }
  set(i: number, d: number, on: boolean) {
    const { geo } = this, k = bit(d);
    this.g[i] = on ? d : 0;
    for (const u of geo.unitsOf[i]) this.unitMask[u] = on ? this.unitMask[u] | k : this.unitMask[u] & ~k;
    const c = geo.cageOf[i];
    if (c >= 0) { this.cageSum[c] += on ? d : -d; this.cageLeft[c] += on ? -1 : 1; }
  }
  run(ctx: Ctx): void {
    if (ctx.found.length >= ctx.limit || ctx.nodes > ctx.maxNodes) return;
    ctx.nodes++;
    const { g, geo } = this;
    let best = -1, bestMask = 0, bestCount = 99;
    for (let i = 0; i < geo.size; i++) {
      if (g[i]) continue;
      const m = this.options(i);
      const n = popcount(m);
      if (n === 0) return;
      if (n < bestCount) { best = i; bestMask = m; bestCount = n; if (n === 1) break; }
    }
    if (best < 0) { ctx.found.push(g.slice()); return; }
    const digits: number[] = [];
    for (let d = 1; d <= geo.n; d++) if (bestMask & bit(d)) digits.push(d);
    if (ctx.rand) for (let k = digits.length - 1; k > 0; k--) { const j = Math.floor(ctx.rand() * (k + 1)); [digits[k], digits[j]] = [digits[j], digits[k]]; }
    for (const d of digits) {
      this.set(best, d, true);
      this.run(ctx);
      this.set(best, d, false);
      if (ctx.found.length >= ctx.limit || ctx.nodes > ctx.maxNodes) return;
    }
  }
}

export interface SearchOutcome { solutions: Grid[]; /** False when the node budget ran out before the search finished. */ finished: boolean }

export function searchSolutions(g: Grid, geo: Geo = CLASSIC, limit = 2, maxNodes = 2_000_000, rand?: () => number): SearchOutcome {
  if (conflicts(g, geo).size) return { solutions: [], finished: true };
  const ctx: Ctx = { limit, found: [], nodes: 0, maxNodes, rand };
  new Search(geo, g.slice()).run(ctx);
  return { solutions: ctx.found, finished: ctx.nodes <= maxNodes || ctx.found.length >= limit };
}

/** Up to `limit` solutions (default 2, enough to prove uniqueness). */
export const findSolutions = (g: Grid, limit = 2, geo: Geo = CLASSIC) => searchSolutions(g, geo, limit).solutions;
export const countSolutions = (g: Grid, limit = 2, geo: Geo = CLASSIC) => findSolutions(g, limit, geo).length;
/** True only when the search proves exactly one solution within its budget. */
export function hasUniqueSolution(g: Grid, geo: Geo = CLASSIC, maxNodes = 2_000_000): boolean {
  const r = searchSolutions(g, geo, 2, maxNodes);
  return r.finished && r.solutions.length === 1;
}

/** Solve and classify: unique, more than one, or none (with a plain-words reason). */
export function solve(g: Grid, geo: Geo = CLASSIC): SolveResult {
  if (conflicts(g, geo).size) return { kind: 'none', reason: `Some digits break a rule: the same digit is twice in a ${geo.variant === 'killer' ? 'group, or a cage adds up wrong' : 'row, column or box'}.` };
  const s = new Search(geo, g.slice());
  for (let i = 0; i < geo.size; i++) {
    if (g[i]) continue;
    if (!s.options(i)) return { kind: 'none', reason: `Row ${Math.floor(i / geo.n) + 1}, column ${(i % geo.n) + 1} has no digit left that fits.` };
  }
  const r = searchSolutions(g, geo, 2, 20_000_000);
  if (!r.solutions.length) return { kind: 'none', reason: r.finished ? 'This puzzle has no solution: every way of filling it in breaks a rule somewhere.' : 'The solver gave up: this puzzle is too open to check.' };
  if (r.solutions.length === 1) return r.finished ? { kind: 'unique', solution: r.solutions[0] } : { kind: 'none', reason: 'The solver gave up: this puzzle is too open to check.' };
  return { kind: 'multiple', solution: r.solutions[0], other: r.solutions[1] };
}

/** A random complete grid: search from an empty board, trying digits in a random order at every step. */
export function randomSolution(rand: () => number = Math.random, geo: Geo = CLASSIC): Grid {
  // Cages come after the grid is made, so fill with the plain shape.
  const plain = geo.variant === 'killer' ? CLASSIC : geo;
  for (;;) {
    const r = searchSolutions(new Array(plain.size).fill(0), plain, 1, 20_000, rand);
    if (r.solutions.length) return r.solutions[0];
  }
}
