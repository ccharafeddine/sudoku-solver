import { describe, it, expect } from 'vitest';
import { BOXES, PEERS, UNITS, allowed, bit, boxOf, candidates, cellName, conflicts, digitsOf, gridString, isComplete, parseGrid, popcount, prettyGrid, unitName } from './board';

const P = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

describe('board', () => {
  it('has 27 units of 9 and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    for (const u of UNITS) expect(new Set(u).size).toBe(9);
    for (const p of PEERS) expect(p).toHaveLength(20);
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
    expect(boxOf(80)).toBe(8);
    expect(cellName(10)).toBe('r2c2');
    expect(unitName(0)).toBe('row 1'); expect(unitName(9)).toBe('column 1'); expect(unitName(26)).toBe('box 9');
  });
  it('parses compact, zero and pretty-printed grids, and rejects wrong lengths', () => {
    const g = parseGrid(P)!;
    expect(gridString(g)).toBe(P);
    expect(parseGrid(P.replace(/\./g, '0'))).toEqual(g);
    expect(parseGrid(prettyGrid(g))).toEqual(g);
    expect(gridString(g, true)).toBe(P.replace(/\./g, '0'));
    expect(parseGrid('123')).toBeNull();
    expect(parseGrid(P + '1')).toBeNull();
  });
  it('finds conflicts in rows, columns and boxes', () => {
    const g = parseGrid(P)!;
    expect(conflicts(g).size).toBe(0);
    g[2] = 5; // row 1 already has a 5
    expect([...conflicts(g)].sort()).toEqual([0, 2]);
  });
  it('computes candidates from the filled digits', () => {
    const g = parseGrid(P)!;
    expect(digitsOf(allowed(g, 2))).toEqual([1, 2, 4]);
    expect(allowed(g, 0)).toBe(0);
    const c = candidates(g);
    expect(popcount(c[40])).toBeGreaterThan(0);
    expect(c[40] & bit(8)).toBe(0);
    expect(isComplete(g)).toBe(false);
  });
});
