import { describe, it, expect } from 'vitest';
import { entryState, doneProblem, hasProgress, canEnter, MIN_GIVENS } from './entry';
import { makeGeo, CLASSIC } from '../sudoku/board';
import { blankSnap } from './history';

describe('enter my own puzzle', () => {
  it('counts numbers and asks for enough of them', () => {
    const g = new Array(81).fill(0); g[0] = 5; g[40] = 3;
    const s = entryState(g, CLASSIC);
    expect(s.count).toBe(2);
    expect(s.ready).toBe(false);
    expect(s.text).toMatch(/2 numbers so far.*at least 17/);
    expect(doneProblem(s, 'unique')).toMatch(/only 2 numbers/);
  });
  it('marks clashes live and names the groups for the shape', () => {
    const g = new Array(81).fill(0); g[0] = 5; g[80] = 5;
    const d = entryState(g, makeGeo('diagonal'));
    expect([...d.clashes].sort()).toEqual([0, 80]);
    expect(d.text).toMatch(/red squares clash.*diagonal/);
    expect(entryState(g, CLASSIC).clashes.size).toBe(0);
  });
  it('explains no answer and more than one answer on Done', () => {
    const g = new Array(16).fill(0); for (let i = 0; i < 4; i++) g[i] = i + 1;
    const s = entryState(g, makeGeo('mini4'));
    expect(s.ready).toBe(true);
    expect(doneProblem(s, 'multiple')).toMatch(/more than one answer/);
    expect(doneProblem(s, 'none', 'A square has no digit left.')).toMatch(/can't be solved: A square has no digit left\./);
    expect(doneProblem(s, 'unique')).toBeNull();
  });
  it('knows which shapes can be typed in, and when there is progress to lose', () => {
    expect(canEnter('killer')).toBe(false);
    expect(['classic', 'diagonal', 'mini6', 'mini4'].every((v) => canEnter(v as never))).toBe(true);
    expect(MIN_GIVENS.mini4).toBe(4);
    const s = blankSnap(16);
    expect(hasProgress(s)).toBe(false);
    s.values[0] = 1; s.givens[0] = true;
    expect(hasProgress(s)).toBe(false);
    s.values[1] = 2;
    expect(hasProgress(s)).toBe(true);
  });
});
