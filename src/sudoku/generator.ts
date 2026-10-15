/**
 * Puzzle generator: start from a random full grid, then take digits away in
 * mirror-image pairs, keeping a removal only while the puzzle still has one
 * solution and is no harder than the level asked for. The result is rated by
 * the logical solver, so "Hard" means a Hard technique is really needed.
 *
 * Expert puzzles are rare by digging alone, so after a time budget the
 * generator falls back to a bundled expert seed, disguised by a random
 * symmetry (relabelled digits, shuffled rows, columns, bands and a possible
 * flip). Those symmetries never change which techniques a puzzle needs.
 */
import { type Grid } from './board';
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

const shuffle = <T>(xs: T[], rand: Rand) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const rank = (l: Level | 'beyond') => (l === 'beyond' ? 99 : LEVELS.indexOf(l));

/** One attempt: dig holes as far as the level allows. */
export function dig(level: Level, rand: Rand): Grid {
  const g = randomSolution(rand);
  const cells = shuffle([...Array(41).keys()], rand); // 0..40 with their mirror 80-i (40 is the centre)
  for (const i of cells) {
    const j = 80 - i;
    const keep = [g[i], g[j]];
    g[i] = 0; g[j] = 0;
    if (!hasUniqueSolution(g) || rank(rate(g).level) > rank(level)) { g[i] = keep[0]; g[j] = keep[1]; }
  }
  return g;
}

/** Relabel digits and shuffle rows within bands, bands, columns within stacks, stacks, and maybe transpose. */
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

export interface Generated { puzzle: Grid; level: Level; fromSeed: boolean }

/** A puzzle with exactly one solution, rated exactly `level`. */
export function generate(level: Level, rand: Rand = Math.random, budgetMs = 1500): Generated {
  const until = Date.now() + budgetMs;
  do {
    const g = dig(level, rand);
    if (rate(g).level === level) return { puzzle: g, level, fromSeed: false };
  } while (Date.now() < until);
  const seeds = SEEDS[level];
  const seed = seeds[Math.floor(rand() * seeds.length)];
  return { puzzle: disguise(seed.split('').map((ch) => (ch === '.' ? 0 : +ch)), rand), level, fromSeed: true };
}
