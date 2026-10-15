import { describe, it, expect } from 'vitest';
import { VARIANTS, allowed, bit, conflicts, makeGeo, parseGrid, prettyGrid, unitName, groupWords } from './board';
import { canMakeSum, randomSolution, solve } from './solver';
import { seeded } from './generator';

describe('puzzle shapes', () => {
  it('builds the right groups for every shape', () => {
    const counts = { classic: 27, diagonal: 29, killer: 27, mini6: 18, mini4: 12 };
    for (const v of VARIANTS) {
      const geo = makeGeo(v);
      expect(geo.units.length, v).toBe(counts[v]);
      for (const u of geo.units) expect(new Set(u.cells).size).toBe(geo.n);
      expect(geo.peers[0].length, v).toBe(v === 'diagonal' ? 26 : v === 'mini6' ? 12 : v === 'mini4' ? 7 : 20);
    }
    const m6 = makeGeo('mini6');
    expect(m6.units[12].cells).toEqual([0, 1, 2, 6, 7, 8]); // box 1 is 2 rows by 3 columns
    expect(unitName(27, makeGeo('diagonal'))).toBe('the diagonal from top-left');
    expect(groupWords(makeGeo('killer'))).toBe('row, column, box or cage');
  });
  it('diagonals count as groups', () => {
    const geo = makeGeo('diagonal'), g = new Array(81).fill(0);
    g[0] = 5; g[80] = 5;
    expect([...conflicts(g, geo)].sort((a, b) => a - b)).toEqual([0, 80]);
    expect(conflicts(g).size).toBe(0);
    expect(allowed(g, 40, geo) & bit(5)).toBe(0);
  });
  it('reads and prints small grids', () => {
    const g = parseGrid('1.3. .4.. 2... ...4'.replace(/ /g, ''), 16)!;
    expect(g).toEqual([1, 0, 3, 0, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 4]);
    expect(parseGrid('9'.repeat(16), 16)).toEqual(new Array(16).fill(0)); // 9 is not a 4x4 digit
    expect(prettyGrid(g, makeGeo('mini4')).split('\n')).toEqual(['1 . | 3 .', '. 4 | . .', '----+----', '2 . | . .', '. . | . 4']);
  });
  it('solves and checks each shape', () => {
    for (const v of ['mini4', 'mini6', 'diagonal'] as const) {
      const geo = makeGeo(v), sol = randomSolution(seeded(9), geo);
      expect(conflicts(sol, geo).size, v).toBe(0);
      const p = sol.slice(); for (let i = 0; i < geo.size; i += 3) p[i] = 0;
      expect(solve(p, geo)).toEqual({ kind: 'unique', solution: sol });
    }
    expect(solve(new Array(16).fill(0), makeGeo('mini4')).kind).toBe('multiple');
  });
  it('knows which cage totals can be made', () => {
    expect(canMakeSum(0x1ff, 2, 3)).toBe(true); // 1+2
    expect(canMakeSum(0x1ff, 2, 2)).toBe(false); // no repeats
    expect(canMakeSum(0x1ff, 3, 24)).toBe(true); // 7+8+9
    expect(canMakeSum(0x1ff, 3, 25)).toBe(false);
    expect(canMakeSum(0x1ff & ~bit(9), 2, 17)).toBe(false); // needs 8+9
  });
  it('a Killer with only cages has one answer, found from the sums', () => {
    const sol = randomSolution(seeded(4));
    // Every cell its own "cage": the sums give the answer away.
    const cages = sol.map((d, i) => ({ cells: [i], sum: d }));
    const r = solve(new Array(81).fill(0), makeGeo('killer', cages));
    expect(r).toEqual({ kind: 'unique', solution: sol });
  });
});
