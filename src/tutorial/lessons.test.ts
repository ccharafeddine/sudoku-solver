import { describe, it, expect } from 'vitest';
import { BOXES, allowed, bit, conflicts, isComplete, parseGrid } from '../sudoku/board';
import { findSolutions } from '../sudoku/solver';
import { lessonGeo, LESSONS, LESSON_SOLUTION, TOUR, checkCell, checkDigit, elimAnswer, exampleStep, freshProgress, loadProgress, progressSummary, techniqueChoices } from './lessons';

describe('lessons', () => {
  it('cut from a valid solved grid', () => {
    expect(isComplete(parseGrid(LESSON_SOLUTION)!)).toBe(true);
  });
  it('every digit question has exactly one right answer among its choices, and it is forced', () => {
    for (const l of LESSONS) {
      if (l.check.kind !== 'digit') continue;
      const { cell, answer, choices } = l.check;
      expect(l.grid![cell], l.id).toBe(0);
      expect(choices.filter((d) => checkDigit(l, d)), l.id).toEqual([answer]);
      const geo = lessonGeo(l);
      expect(l.grid).toHaveLength(geo.size);
      expect(conflicts(l.grid!, geo).size).toBe(0);
      expect(allowed(l.grid!, cell, geo) & bit(answer), l.id).toBeTruthy();
      // The wrong choices must actually be ruled out, so the lesson is fair.
      for (const d of choices) if (d !== answer) expect(allowed(l.grid!, cell, geo) & bit(d), `${l.id} ${d}`).toBe(0);
    }
    const ns = LESSONS.find((l) => l.id === 'naked-single')!;
    expect(allowed(ns.grid!, 40)).toBe(bit(5));
  });
  it('the hidden single has only one spot for 1 in the box', () => {
    const l = LESSONS.find((x) => x.id === 'hidden-single')!;
    const spots = BOXES[0].filter((i) => !l.grid![i] && allowed(l.grid!, i) & bit(1));
    expect(spots).toEqual([18]);
    expect(checkCell(l, 18)).toBe(true);
    expect(checkCell(l, 2)).toBe(false);
  });
  it('every technique lesson finds a real example with a fair question', () => {
    for (const l of LESSONS) {
      if (l.check.kind !== 'technique') continue;
      const ex = exampleStep(l.check.technique)!;
      expect(ex, l.id).toBeTruthy();
      expect(ex.step.technique).toBe(l.check.technique);
      const sol = findSolutions(ex.grid, 2);
      expect(sol).toHaveLength(1);
      for (const e of ex.step.eliminate) {
        expect(ex.cands[e.cell] & bit(e.digit), `${l.id} shows the mark it removes`).toBeTruthy();
        expect(sol[0][e.cell]).not.toBe(e.digit);
      }
      const ch = techniqueChoices(ex.step);
      expect(ch).toHaveLength(4);
      expect(new Set(ch).size).toBe(4);
      expect(ch).toContain(elimAnswer(ex.step));
    }
  });
  it('mentions every puzzle type in a lesson and the tour', () => {
    const shapes = LESSONS.find((l) => l.id === 'shapes')!;
    for (const w of ['4x4', '6x6', 'Diagonal', 'Killer']) expect(shapes.body).toContain(w);
    expect(TOUR.find((t) => t.id === 'puzzle')!.body).toMatch(/Diagonal, Killer/);
  });
  it('uses short, plain words', () => {
    for (const l of LESSONS) {
      for (const sentence of l.body.split(/[.!?] /)) expect(sentence.split(' ').length, l.id).toBeLessThan(36);
      expect(l.body).not.toMatch(/candidate|constraint|eliminat/i);
    }
    for (const t of TOUR) expect(t.body).not.toMatch(/candidate|constraint/i);
  });
});

describe('progress', () => {
  it('survives missing and corrupt storage', () => {
    const store = (v: string | null) => ({ getItem: () => v, setItem: () => {} });
    expect(loadProgress(store(null))).toEqual(freshProgress());
    expect(loadProgress(store('{bad'))).toEqual(freshProgress());
    expect(loadProgress(store('{"lesson":99,"lessonsDone":["rows","nope"],"tour":-3}'))).toMatchObject({ lesson: LESSONS.length - 1, lessonsDone: ['rows'], tour: 0 });
    expect(progressSummary(freshProgress())).toMatch(/0\/9 lessons/);
  });
});
