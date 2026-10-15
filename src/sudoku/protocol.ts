/** Messages between the page and the solver worker. Each request carries an id; the reply echoes it. */
import type { Cage, Grid, Variant } from './board';
import type { Puzzle } from './generator';

interface Shape { variant: Variant; cages: Cage[] }
import type { Level, Rating, Step } from './logic';
import type { SolveResult } from './solver';

export type Request =
  | ({ id: number; kind: 'solve'; grid: Grid } & Shape)
  | ({ id: number; kind: 'rate'; grid: Grid } & Shape)
  | ({ id: number; kind: 'steps'; grid: Grid; cands: number[] } & Shape)
  | { id: number; kind: 'generate'; level: Level; variant: Variant; seed?: number };

export type Response =
  | { id: number; kind: 'solve'; result: SolveResult }
  | { id: number; kind: 'rate'; rating: Rating }
  | { id: number; kind: 'steps'; steps: Step[]; solved: boolean }
  | { id: number; kind: 'generate'; puzzle: Puzzle; level: Level; closest: boolean }
  | { id: number; kind: 'error'; message: string };
