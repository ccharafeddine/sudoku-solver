import { describe, it, expect } from 'vitest';
import { bit, candidates, parseGrid, type Grid } from './board';
import { LEVELS, TECH, TECHNIQUES, applyStep, nextStep, rate, solveLogically, type TechniqueId } from './logic';
import { findSolutions } from './solver';
import { SEEDS } from './seeds';
import { dig, seeded } from './generator';

const all = (Object.values(SEEDS).flat() as string[]).map((s) => parseGrid(s)!);

/** Every step must agree with the one true solution: placements match it, eliminations never remove it. */
function checkSound(p: Grid, seen: Set<TechniqueId>) {
  const sol = findSolutions(p, 2);
  expect(sol).toHaveLength(1);
  const g = p.slice(), c = candidates(g);
  for (let s = nextStep(g, c); s; s = nextStep(g, c)) {
    seen.add(s.technique);
    if (s.place) expect(sol[0][s.place.cell], s.text).toBe(s.place.digit);
    for (const e of s.eliminate) expect(sol[0][e.cell], `${s.technique}: ${s.text}`).not.toBe(e.digit);
    expect(s.place || s.eliminate.length).toBeTruthy();
    expect(s.cells.length).toBeGreaterThan(0);
    expect(s.text.length).toBeGreaterThan(30);
    applyStep(g, c, s);
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
    for (let s = 1; s <= 120; s++) checkSound(dig('expert', seeded(s * 7919)), seen);
    expect([...seen].sort()).toEqual(TECHNIQUES.map((t) => t.id).sort());
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
