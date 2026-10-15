import { describe, it, expect } from 'vitest';
import { parseGrid } from './board';
import { rate } from './logic';
import { hasUniqueSolution } from './solver';
import { disguise, generate, seeded } from './generator';
import { SEEDS } from './seeds';

describe('generator', () => {
  it('seeded randomness is reproducible', () => {
    const a = seeded(42), b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  for (const level of ['easy', 'medium', 'hard', 'expert'] as const) {
    it(`makes a unique ${level} puzzle rated ${level}`, () => {
      const g = generate(level, seeded(level.length * 101), 3000);
      expect(hasUniqueSolution(g.puzzle)).toBe(true);
      expect(rate(g.puzzle).level).toBe(level);
      expect(g.level).toBe(level);
    });
  }
  it('disguised seeds keep one solution and their level', () => {
    for (const [level, list] of Object.entries(SEEDS)) for (const s of list.slice(0, 4)) {
      const d = disguise(parseGrid(s)!, seeded(s.length + level.length));
      expect(hasUniqueSolution(d)).toBe(true);
      expect(rate(d).level).toBe(level);
      expect(d.filter(Boolean).length).toBe(parseGrid(s)!.filter(Boolean).length);
    }
  });
  it('falls back to a disguised seed when the time budget runs out', () => {
    const g = generate('expert', seeded(3), 0);
    expect(hasUniqueSolution(g.puzzle)).toBe(true);
    expect(rate(g.puzzle).level).toBe('expert');
  });
});
