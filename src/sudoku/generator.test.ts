import { describe, it, expect } from 'vitest';
import { parseGrid } from './board';
import { rate } from './logic';
import { hasUniqueSolution } from './solver';
import { makeGeo, conflicts, isComplete } from './board';
import { disguise, generate, geoOf, makeCages, seeded } from './generator';
import { randomSolution } from './solver';
import { SEEDS } from './seeds';

describe('generator', () => {
  it('seeded randomness is reproducible', () => {
    const a = seeded(42), b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  for (const level of ['easy', 'medium', 'hard', 'expert', 'fiendish'] as const) {
    it(`makes a unique ${level} puzzle rated ${level}`, () => {
      const g = generate(level, seeded(level.length * 101), 3000);
      expect(hasUniqueSolution(g.puzzle.givens)).toBe(true);
      expect(rate(g.puzzle.givens).level).toBe(level);
      expect(g.level).toBe(level);
    });
  }
  for (const [variant, level] of [['diagonal', 'expert'], ['killer', 'medium'], ['mini6', 'medium'], ['mini4', 'easy']] as const) {
    it(`makes a unique ${variant} puzzle, honest about its level`, () => {
      const g = generate(level, seeded(7), 4000, variant);
      const geo = geoOf(g.puzzle);
      expect(g.puzzle.variant).toBe(variant);
      expect(g.puzzle.givens).toHaveLength(geo.size);
      expect(hasUniqueSolution(g.puzzle.givens, geo)).toBe(true);
      expect(rate(g.puzzle.givens, geo).level).toBe(g.level);
      if (!g.closest) expect(g.level).toBe(level);
    });
  }
  it('Killer cages touch, never repeat a digit, cover the grid once and show the right sums', () => {
    const sol = randomSolution(seeded(5));
    const cages = makeCages(sol, seeded(6));
    const seen = new Set<number>();
    for (const c of cages) {
      expect(c.cells.length).toBeLessThanOrEqual(4);
      expect(new Set(c.cells.map((i) => sol[i])).size).toBe(c.cells.length);
      expect(c.sum).toBe(c.cells.reduce((a, i) => a + sol[i], 0));
      for (const i of c.cells) { expect(seen.has(i)).toBe(false); seen.add(i); }
      // Connected: every cell touches another cell of the cage (for cages of 2+).
      if (c.cells.length > 1) for (const i of c.cells) expect(c.cells.some((j) => Math.abs(i - j) === 9 || (Math.abs(i - j) === 1 && Math.floor(i / 9) === Math.floor(j / 9)))).toBe(true);
    }
    expect(seen.size).toBe(81);
    const geo = makeGeo('killer', cages);
    expect(isComplete(sol, geo)).toBe(true);
    const bad = sol.slice(); [bad[cages[0].cells[0]], bad[80]] = [bad[80], bad[cages[0].cells[0]]];
    expect(conflicts(bad, geo).size).toBeGreaterThan(0);
  });
  it('disguised seeds keep one solution and their level', () => {
    for (const [level, list] of Object.entries(SEEDS)) for (const s of list.slice(0, 4)) {
      const d = disguise(parseGrid(s)!, seeded(s.length + level.length));
      expect(hasUniqueSolution(d)).toBe(true);
      expect(rate(d).level).toBe(level);
      expect(d.filter(Boolean).length).toBe(parseGrid(s)!.filter(Boolean).length);
    }
  });
  it('falls back to a disguised seed when the time budget runs out', () => {
    for (const level of ['expert', 'fiendish'] as const) {
      const g = generate(level, seeded(3), 0);
      expect(hasUniqueSolution(g.puzzle.givens)).toBe(true);
      expect(rate(g.puzzle.givens).level).toBe(level);
    }
  });
});
