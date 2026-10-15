/** Messages between the page and the solver worker. Each request carries an id; the reply echoes it. */
import type { Grid } from './board';
import type { Level, Rating, Step } from './logic';
import type { SolveResult } from './solver';

export type Request =
  | { id: number; kind: 'solve'; grid: Grid }
  | { id: number; kind: 'rate'; grid: Grid }
  | { id: number; kind: 'steps'; grid: Grid; cands: number[] }
  | { id: number; kind: 'generate'; level: Level; seed?: number };

export type Response =
  | { id: number; kind: 'solve'; result: SolveResult }
  | { id: number; kind: 'rate'; rating: Rating }
  | { id: number; kind: 'steps'; steps: Step[]; solved: boolean }
  | { id: number; kind: 'generate'; puzzle: Grid; level: Level }
  | { id: number; kind: 'error'; message: string };
