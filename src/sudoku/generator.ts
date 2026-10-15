/**
 * Puzzle generator: start from a random full grid, then take digits away in
 * mirror-image pairs, keeping a removal only while the puzzle still has one
 * solution and is no harder than the level asked for. The result is rated by
 * the logical solver, so "Hard" means a Hard technique is really needed.
 *
 * Killer puzzles first get cages: random groups of 2 to 4 touching squares
 * with no repeated digit, each showing its total. Then digits are taken away
 * the same way (often all of them).
 *
 * Some levels are rare by digging alone. For classic puzzles the generator
 * then falls back to a bundled seed of that level, disguised by a random
 * symmetry (relabelled digits, shuffled rows, columns, bands and a possible
 * flip), which never changes the techniques a puzzle needs. Other shapes
 * return the closest level found and say so.
 */
import { makeGeo, type Cage, type Geo, type Grid, type Variant } from './board';
import { LEVELS, rate, type Level } from './logic';
import { hasUniqueSolution, randomSolution } from './solver';
import { SEEDS } from './seeds';

export type Rand = () => number;

/** A small seeded PRNG (mulberry32), so tests and share links can be reproducible. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Puzzle { variant: Variant; givens: Grid; cages: Cage[] }
export const geoOf = (p: Puzzle): Geo => makeGeo(p.variant, p.cages);

const shuffle = <T>(xs: T[], rand: Rand) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const rank = (l: Level | 'beyond') => (l === 'beyond' ? 99 : LEVELS.indexOf(l));

/** Random cages over a solved 9x9: touching squares, 2 to 4 each (an odd single now and then), no repeated digit. */
export function makeCages(sol: Grid, rand: Rand): Cage[] {
  const n = 9, owner = new Array(81).fill(-1), cages: Cage[] = [];
  for (const start of shuffle([...Array(81).keys()], rand)) {
    if (owner[start] >= 0) continue;
    const want = 2 + Math.floor(rand() * 3);
    const cells = [start];
    owner[start] = cages.length;
    while (cells.length < want) {
      const options: number[] = [];
      for (const i of cells) for (const j of [i - n, i + n, i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1]) {
        if (j < 0 || j >= 81 || owner[j] >= 0 || options.includes(j)) continue;
        if (cells.some((k) => sol[k] === sol[j])) continue;
        options.push(j);
      }
      if (!options.length) break;
      const j = options[Math.floor(rand() * options.length)];
      owner[j] = cages.length;
      cells.push(j);
    }
    cages.push({ cells: cells.sort((a, b) => a - b), sum: cells.reduce((a, i) => a + sol[i], 0) });
  }
  return cages;
}

/** Budget for each uniqueness check: open Killer grids can take a while, and a timeout counts as "not proven unique". */
const NODES: Record<Variant, number> = { classic: 2_000_000, diagonal: 2_000_000, killer: 60_000, mini6: 200_000, mini4: 50_000 };

/** One attempt: dig holes as far as the level allows. */
export function dig(level: Level, rand: Rand, variant: Variant = 'classic'): Puzzle {
  let geo = makeGeo(variant);
  const g = randomSolution(rand, geo);
  let cages: Cage[] = [];
  if (variant === 'killer') { cages = makeCages(g, rand); geo = makeGeo('killer', cages); }
  const half = Math.ceil(geo.size / 2);
  for (const i of shuffle([...Array(half).keys()], rand)) {
    const j = geo.size - 1 - i;
    const keep = [g[i], g[j]];
    g[i] = 0; g[j] = 0;
    if (!hasUniqueSolution(g, geo, NODES[variant]) || rank(rate(g, geo).level) > rank(level)) { g[i] = keep[0]; g[j] = keep[1]; }
  }
  return { variant, givens: g, cages };
}

/** Relabel digits and shuffle rows within bands, bands, columns within stacks, stacks, and maybe transpose (classic 9x9). */
export function disguise(g: Grid, rand: Rand): Grid {
  const map = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)];
  const order = () => shuffle([0, 1, 2], rand).flatMap((b) => shuffle([0, 1, 2], rand).map((r) => b * 3 + r));
  const rows = order(), cols = order(), flip = rand() < 0.5;
  const out = new Array(81).fill(0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const v = g[rows[r] * 9 + cols[c]];
    out[flip ? c * 9 + r : r * 9 + c] = map[v];
  }
  return out;
}

export interface Generated { puzzle: Puzzle; level: Level; fromSeed: boolean; /** True when the exact level wasn't found and the closest easier one is returned. */ closest: boolean }

/** A puzzle with exactly one solution, rated `level` (or the closest easier level for shapes with no seed bank). */
export function generate(level: Level, rand: Rand = Math.random, budgetMs = 1500, variant: Variant = 'classic'): Generated {
  const until = Date.now() + budgetMs;
  let best: { p: Puzzle; level: Level } | null = null;
  do {
    const p = dig(level, rand, variant);
    const r = rate(p.givens, geoOf(p)).level;
    if (r === level) return { puzzle: p, level, fromSeed: false, closest: false };
    if (r !== 'beyond' && (!best || rank(r) > rank(best.level))) best = { p, level: r };
  } while (Date.now() < until);
  if (variant === 'classic') {
    const seeds = SEEDS[level];
    const seed = seeds[Math.floor(rand() * seeds.length)];
    return { puzzle: { variant, givens: disguise(seed.split('').map((ch) => (ch === '.' ? 0 : +ch)), rand), cages: [] }, level, fromSeed: true, closest: false };
  }
  return { puzzle: best!.p, level: best!.level, fromSeed: false, closest: true };
}
