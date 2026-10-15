/// <reference lib="webworker" />
/**
 * Solver worker: every search runs here, so the page never stalls, even while
 * the generator digs for an Expert puzzle.
 */
import { generate, seeded } from './generator';
import { rate, solveLogically } from './logic';
import { solve } from './solver';
import type { Request, Response } from './protocol';

self.onmessage = (e: MessageEvent<Request>) => {
  const m = e.data;
  let r: Response;
  try {
    switch (m.kind) {
      case 'solve': r = { id: m.id, kind: 'solve', result: solve(m.grid) }; break;
      case 'rate': r = { id: m.id, kind: 'rate', rating: rate(m.grid) }; break;
      case 'steps': { const s = solveLogically(m.grid, m.cands); r = { id: m.id, kind: 'steps', steps: s.steps, solved: s.solved }; break; }
      case 'generate': { const g = generate(m.level, m.seed === undefined ? Math.random : seeded(m.seed)); r = { id: m.id, kind: 'generate', puzzle: g.puzzle, level: g.level }; break; }
    }
  } catch (err) {
    r = { id: m.id, kind: 'error', message: (err as Error).message };
  }
  (self as unknown as Worker).postMessage(r);
};
