import { describe, it, expect } from 'vitest';
import { conflicts, emptyGrid, isComplete, parseGrid } from './board';
import { countSolutions, findSolutions, randomSolution, solve } from './solver';
import { seeded } from './generator';

const EASY = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
// A famously hard puzzle for people; trivial for search.
const HARDEST = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';

describe('instant solver', () => {
  it('solves a classic puzzle, keeping the givens', () => {
    const g = parseGrid(EASY)!;
    const r = solve(g);
    expect(r.kind).toBe('unique');
    if (r.kind !== 'unique') return;
    expect(isComplete(r.solution)).toBe(true);
    g.forEach((v, i) => v && expect(r.solution[i]).toBe(v));
  });
  it('solves a very hard puzzle quickly', () => {
    const t = performance.now();
    const r = solve(parseGrid(HARDEST)!);
    expect(r.kind).toBe('unique');
    expect(performance.now() - t).toBeLessThan(500);
  });
  it('detects more than one solution and returns two different ones', () => {
    const r = solve(emptyGrid());
    expect(r.kind).toBe('multiple');
    if (r.kind === 'multiple') { expect(isComplete(r.other)).toBe(true); expect(r.other).not.toEqual(r.solution); }
    const g = parseGrid(EASY)!; g[0] = 0; g[1] = 0; g[4] = 0; g[9] = 0; g[13] = 0;
    expect(countSolutions(g)).toBeGreaterThanOrEqual(1);
  });
  it('detects clashes, dead cells and deeper contradictions', () => {
    const clash = parseGrid(EASY)!; clash[2] = 5;
    expect(solve(clash)).toMatchObject({ kind: 'none' });
    expect((solve(clash) as { reason: string }).reason).toMatch(/twice/);
    // r1c3 can only be 1, 2 or 4 here; block all three through its column.
    const dead = parseGrid(EASY)!; dead[20] = 1; dead[29] = 2; dead[38] = 4;
    const r = solve(dead);
    expect(r.kind).toBe('none');
    // No clash and every cell has an option, but there is still no solution.
    const deep = parseGrid('..9.287..8.6..4..5..3.....46.........2.71345.........23.....5..9..4..8.7..125.3..')!;
    expect(conflicts(deep).size).toBe(0);
    expect(solve(deep).kind).toBe('none');
  });
  it('makes valid random full grids that differ by seed', () => {
    const a = randomSolution(seeded(1)), b = randomSolution(seeded(2));
    expect(isComplete(a)).toBe(true);
    expect(isComplete(b)).toBe(true);
    expect(a).not.toEqual(b);
    expect(findSolutions(a, 2)).toHaveLength(1);
  });
});
