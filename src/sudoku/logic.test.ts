import { describe, it, expect } from 'vitest';
import { bit, candidates, parseGrid, type Grid } from './board';
import { ALL, makeGeo, type Geo } from './board';
import { LEVELS, TECH, TECHNIQUES, applyStep, findFish, nextStep, rate, solveLogically, type TechniqueId } from './logic';
import { findSolutions } from './solver';
import { SEEDS } from './seeds';
import { dig, geoOf, seeded } from './generator';

const all = (Object.values(SEEDS).flat() as string[]).map((s) => parseGrid(s)!);

/** Every step must agree with the one true solution: placements match it, eliminations never remove it. */
export function checkSound(p: Grid, seen: Set<TechniqueId>, geo?: Geo) {
  const sol = findSolutions(p, 2, geo);
  expect(sol).toHaveLength(1);
  const g = p.slice(), c = candidates(g, geo);
  for (let s = nextStep(g, c, geo); s; s = nextStep(g, c, geo)) {
    seen.add(s.technique);
    if (s.place) expect(sol[0][s.place.cell], s.text).toBe(s.place.digit);
    for (const e of s.eliminate) expect(sol[0][e.cell], `${s.technique}: ${s.text}`).not.toBe(e.digit);
    expect(s.place || s.eliminate.length).toBeTruthy();
    expect(s.cells.length).toBeGreaterThan(0);
    expect(s.text.length).toBeGreaterThan(30);
    applyStep(g, c, s, geo);
    if (g.every((v) => v)) break;
  }
}

describe('logical solver', () => {
  it('lists its techniques from easiest to hardest', () => {
    const lv = TECHNIQUES.map((t) => LEVELS.indexOf(t.level));
    expect(lv).toEqual([...lv].sort((a, b) => a - b));
    expect(TECHNIQUES.map((t) => t.id)).toEqual(expect.arrayContaining(['naked-single', 'hidden-single', 'pointing', 'box-line', 'naked-pair', 'hidden-pair', 'naked-triple', 'hidden-triple', 'x-wing', 'xy-wing', 'swordfish']));
  });
  it('never makes a wrong step, and uses every technique somewhere', () => {
    const seen = new Set<TechniqueId>();
    for (const p of all) checkSound(p, seen);
    for (let s = 1; s <= 120; s++) checkSound(dig('fiendish', seeded(s * 7919)).givens, seen);
    for (let s = 1; s <= 6; s++) { const p = dig('fiendish', seeded(s), 'killer'); checkSound(p.givens, seen, geoOf(p)); }
    // Jellyfish never turned up in thousands of generated puzzles; its own test below builds one.
    expect([...seen].sort()).toEqual(TECHNIQUES.map((t) => t.id).filter((t) => t !== 'jellyfish').sort());
  });
  it('solves the bundled puzzles all the way, at their rated level', () => {
    for (const [level, list] of Object.entries(SEEDS)) for (const s of list) {
      const r = solveLogically(parseGrid(s)!);
      expect(r.solved, s).toBe(true);
      expect(rate(parseGrid(s)!).level, s).toBe(level);
    }
  });
  it('gives a naked single with its cell and plain-words reason', () => {
    // r1c3: row 1 has 5 3 7, column 3 has 8, box 1 has 6 9; only 1, 2, 4 fit... fill more to force it.
    const g = parseGrid('53.678912672195348198342567859761423426853791713924856961537284287419635345286179')!;
    const s = nextStep(g, candidates(g))!;
    expect(s).toMatchObject({ technique: 'naked-single', place: { cell: 2, digit: 4 } });
    expect(s.text).toContain('r1c3');
  });
  it('finds a hidden single in a box', () => {
    // An easy puzzle's first non-naked step is usually a hidden single.
    const p = parseGrid(SEEDS.easy[0])!;
    const r = solveLogically(p);
    const h = r.steps.find((x) => x.technique === 'hidden-single')!;
    expect(h).toBeTruthy();
    expect(h.units).toHaveLength(1);
    expect(h.text).toMatch(/only square/);
  });
  it('explains pointing, pairs and wings in words a beginner can follow', () => {
    const texts: Partial<Record<TechniqueId, string>> = {};
    for (const p of all) for (const s of solveLogically(p).steps) texts[s.technique] ??= s.text;
    expect(texts.pointing).toMatch(/can only go in/);
    expect(texts['x-wing']).toMatch(/rows|columns/);
    expect(texts['xy-wing']).toMatch(/Either way/);
    for (const t of Object.values(texts)) expect(t).not.toMatch(/undefined|NaN/);
  });
  it('rates by the hardest technique needed', () => {
    for (const s of SEEDS.expert) {
      const r = rate(parseGrid(s)!);
      expect(r.hardest && TECH[r.hardest].level).toBe('expert');
    }
    expect(rate(parseGrid(SEEDS.easy[0])!).hardest).toMatch(/single/);
  });
  it('finds a Jellyfish when four rows hold a digit in just four columns', () => {
    const g = new Array(81).fill(0), c = new Array(81).fill(ALL);
    // Digit 1 sits only in columns 0,2,5,7 in rows 0,3,4,8 (two or three spots each), and elsewhere in those columns too.
    const spots: Record<number, number[]> = { 0: [0, 2], 3: [2, 5, 7], 4: [0, 7], 8: [5, 7] };
    for (const r of [0, 3, 4, 8]) for (let col = 0; col < 9; col++) if (!spots[r].includes(col)) c[r * 9 + col] &= ~bit(1);
    const s = findFish(g, c, 4)!;
    expect(s.technique).toBe('jellyfish');
    expect(s.eliminate.every((e) => e.digit === 1 && [0, 2, 5, 7].includes(e.cell % 9) && ![0, 3, 4, 8].includes(Math.floor(e.cell / 9)))).toBe(true);
    expect(s.eliminate).toHaveLength(20);
    expect(findFish(g, c, 3)).toBeNull();
  });
  it('rates Fiendish puzzles by their advanced techniques', () => {
    for (const s of SEEDS.fiendish) {
      const r = rate(parseGrid(s)!);
      expect(r.level).toBe('fiendish');
      expect(['xyz-wing', 'w-wing', 'simple-colouring', 'unique-rectangle', 'jellyfish']).toContain(r.hardest);
    }
  });
  it('skips the unique rectangle where diagonals or cages could break it', () => {
    const seen = new Set<TechniqueId>();
    for (let s = 1; s <= 8; s++) { const p = dig('fiendish', seeded(s * 13), 'diagonal'); checkSound(p.givens, seen, makeGeo('diagonal')); }
    expect(seen.has('unique-rectangle')).toBe(false);
  });
  it('reports when its techniques run out', () => {
    const hardest = parseGrid('8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..')!;
    const r = solveLogically(hardest);
    expect(r.solved).toBe(false);
    expect(rate(hardest).level).toBe('beyond');
  });
  it('respects candidates already ruled out', () => {
    const g = parseGrid(SEEDS.easy[0])!, c = candidates(g);
    const s = nextStep(g, c)!;
    if (s.place) { c[s.place.cell] &= bit(s.place.digit); }
    const r = solveLogically(g, c);
    expect(r.solved).toBe(true);
  });
});
