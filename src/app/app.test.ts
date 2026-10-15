import { describe, it, expect } from 'vitest';
import { History, blankSnap } from './history';
import { fromHash, importText, shareUrl, toHash } from './share';
import { Timer, formatTime, stepDelay } from './timer';
import { parseGrid } from '../sudoku/board';
import { updatesEnabled, compareVersions, REPO } from './update';

const P = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

describe('history timeline', () => {
  it('undoes, redoes and jumps both ways', () => {
    const s = blankSnap();
    const h = new History(s);
    for (let k = 1; k <= 3; k++) { s.values[k] = k; h.push(s, `r1c${k + 1} = ${k}`); }
    expect(h.length).toBe(4);
    expect(h.undo()!.values[3]).toBe(0);
    expect(h.redo()!.values[3]).toBe(3);
    expect(h.jump(1).values.slice(0, 4)).toEqual([0, 1, 0, 0]);
    expect(h.jump(3).values.slice(0, 4)).toEqual([0, 1, 2, 3]);
    h.jump(1); s.values = h.current.values; s.values[9] = 9; h.push(s, 'branch');
    expect(h.length).toBe(3);
    expect(h.canRedo).toBe(false);
  });
  it('ignores changes that change nothing, and snapshots are copies', () => {
    const s = blankSnap(), h = new History(s);
    expect(h.push(s, 'same')).toBe(false);
    const c = h.current; c.values[0] = 5;
    expect(h.current.values[0]).toBe(0);
  });
});

describe('import and export', () => {
  it('round-trips givens and progress through a share link', () => {
    const g = parseGrid(P)!, e = new Array(81).fill(0); e[2] = 4;
    const h = toHash(g, e);
    expect(h).toMatch(/^#p=[0-9]{81}&e=[0-9]{81}$/);
    expect(fromHash(h)).toEqual({ givens: g, entered: e });
    expect(toHash(g)).not.toContain('&e=');
    expect(shareUrl('https://x.test/app/#old', g)).toBe('https://x.test/app/' + toHash(g));
  });
  it('never lets entered digits overwrite givens, and rejects bad input', () => {
    const g = parseGrid(P)!, e = new Array(81).fill(1);
    expect(fromHash(toHash(g, e))!.entered![0]).toBe(0);
    expect(fromHash('#p=123')).toBeNull();
    expect(importText('hello')).toBeNull();
  });
  it('imports links, strings and pretty grids', () => {
    expect(importText(P)!.givens).toEqual(parseGrid(P));
    expect(importText('see https://a.b/#p=' + P.replace(/\./g, '0'))!.givens).toEqual(parseGrid(P));
  });
});

describe('timer and pacing', () => {
  it('counts only while running', () => {
    let t = 0; const tm = new Timer(() => t);
    tm.start(); t = 1000; tm.pause(); t = 5000;
    expect(tm.ms).toBe(1000);
    tm.start(); t = 6500;
    expect(tm.ms).toBe(2500);
    tm.reset(); expect(tm.ms).toBe(0);
  });
  it('formats times and speeds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(3_725_000)).toBe('1:02:05');
    expect(stepDelay(0)).toBe(2200);
    expect(stepDelay(100)).toBeLessThan(100);
    expect(stepDelay(50)).toBeLessThan(stepDelay(20));
  });
});

describe('updates', () => {
  it('only the desktop app checks, against this repo', () => {
    expect(updatesEnabled({})).toBe(false);
    expect(updatesEnabled({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(REPO).toBe('ccharafeddine/sudoku-solver');
    expect(compareVersions('v1.10.0', '1.9.9')).toBeGreaterThan(0);
  });
});
