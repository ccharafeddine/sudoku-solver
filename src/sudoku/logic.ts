/**
 * The human-style solver. It works the way a person does: keep pencil marks
 * (candidates) and look for one pattern at a time, easiest first. Each step
 * names its technique, lists the cells involved and says in plain words why
 * it works, so the app can show it as a hint or play it back.
 */
import {
  BOXES, COLS, PEERS, ROWS, UNITS, bit, boxOf, candidates, cellName, colOf, digitsOf, onlyDigit, popcount, rowOf, unitName, type Grid,
} from './board';

export type TechniqueId =
  | 'naked-single' | 'hidden-single' | 'pointing' | 'box-line' | 'naked-pair' | 'hidden-pair'
  | 'naked-triple' | 'hidden-triple' | 'x-wing' | 'xy-wing' | 'swordfish';

export interface Technique { id: TechniqueId; name: string; level: Level; blurb: string }
export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];
export const LEVEL_LABELS: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** Easiest first: the order the solver tries them in. */
export const TECHNIQUES: Technique[] = [
  { id: 'naked-single', name: 'Naked single', level: 'easy', blurb: 'A square where only one digit fits.' },
  { id: 'hidden-single', name: 'Hidden single', level: 'easy', blurb: 'A digit that has only one place left in a row, column or box.' },
  { id: 'pointing', name: 'Pointing', level: 'medium', blurb: 'Inside a box, a digit can only go in one row or column, so it can\'t go anywhere else in that line.' },
  { id: 'box-line', name: 'Box-line', level: 'medium', blurb: 'In a row or column, a digit can only go inside one box, so the rest of that box can\'t have it.' },
  { id: 'naked-pair', name: 'Naked pair', level: 'medium', blurb: 'Two squares in a group can only hold the same two digits, so nobody else in the group can.' },
  { id: 'hidden-pair', name: 'Hidden pair', level: 'medium', blurb: 'Two digits can only go in the same two squares, so those squares can\'t hold anything else.' },
  { id: 'naked-triple', name: 'Naked triple', level: 'hard', blurb: 'Three squares share just three digits between them.' },
  { id: 'hidden-triple', name: 'Hidden triple', level: 'hard', blurb: 'Three digits can only go in the same three squares.' },
  { id: 'x-wing', name: 'X-Wing', level: 'hard', blurb: 'A digit fits in only two spots in each of two rows, and they line up in a rectangle.' },
  { id: 'xy-wing', name: 'XY-Wing', level: 'expert', blurb: 'Three two-digit squares that link up, so one digit must be in one of two places.' },
  { id: 'swordfish', name: 'Swordfish', level: 'expert', blurb: 'Like an X-Wing, but with three rows and three columns.' },
];
export const TECH: Record<TechniqueId, Technique> = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<TechniqueId, Technique>;

export interface Elim { cell: number; digit: number }
export interface Step {
  technique: TechniqueId;
  /** A digit to write in, for singles. */
  place?: { cell: number; digit: number };
  /** Pencil marks this step rules out. */
  eliminate: Elim[];
  /** The cells that make the pattern (highlighted as the reason). */
  cells: number[];
  /** The rows, columns or boxes the pattern lives in (0-26, see board.UNITS). */
  units: number[];
  /** The digits the pattern is about. */
  digits: number[];
  /** What it means, in plain words. */
  text: string;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cellsText = (cs: number[]) => list(cs.map(cellName));
const digitsText = (ds: number[]) => list(ds.map(String));

function combos<T>(xs: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < xs.length; i++) { acc.push(xs[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

/** Remove what a placed digit rules out: the digit from its peers, everything else from its own cell. */
export function applyStep(g: Grid, cands: number[], s: Step): void {
  if (s.place) {
    const { cell, digit } = s.place;
    g[cell] = digit;
    cands[cell] = 0;
    for (const p of PEERS[cell]) cands[p] &= ~bit(digit);
  }
  for (const e of s.eliminate) cands[e.cell] &= ~bit(e.digit);
}

// ---------- singles ----------
function nakedSingle(g: Grid, c: number[]): Step | null {
  for (let i = 0; i < 81; i++) {
    if (g[i] || popcount(c[i]) !== 1) continue;
    const d = onlyDigit(c[i]);
    return { technique: 'naked-single', place: { cell: i, digit: d }, eliminate: [], cells: [i], units: [], digits: [d],
      text: `Look at ${cellName(i)}. Every other digit is already used in its row, column or box, so the only digit that fits is ${d}.` };
  }
  return null;
}

function hiddenSingle(g: Grid, c: number[]): Step | null {
  // Boxes first: that is where people spot them most easily.
  for (const u of [...Array(9).keys()].map((k) => 18 + k).concat([...Array(18).keys()])) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter((i) => !g[i] && c[i] & bit(d));
      if (spots.length !== 1 || UNITS[u].some((i) => g[i] === d)) continue;
      const i = spots[0];
      return { technique: 'hidden-single', place: { cell: i, digit: d }, eliminate: [], cells: [i], units: [u], digits: [d],
        text: `${unitName(u)[0].toUpperCase()}${unitName(u).slice(1)} needs a ${d}, and ${cellName(i)} is the only square in it where ${d} can go. So ${cellName(i)} is ${d}.` };
    }
  }
  return null;
}

// ---------- intersections ----------
function pointing(g: Grid, c: number[]): Step | null {
  for (let b = 0; b < 9; b++) for (let d = 1; d <= 9; d++) {
    const spots = BOXES[b].filter((i) => !g[i] && c[i] & bit(d));
    if (spots.length < 2) continue;
    for (const line of [rowOf, colOf]) {
      const l = line(spots[0]);
      if (!spots.every((i) => line(i) === l)) continue;
      const unit = line === rowOf ? l : 9 + l;
      const eliminate = UNITS[unit].filter((i) => boxOf(i) !== b && !g[i] && c[i] & bit(d)).map((cell) => ({ cell, digit: d }));
      if (!eliminate.length) continue;
      return { technique: 'pointing', eliminate, cells: spots, units: [18 + b, unit], digits: [d],
        text: `In box ${b + 1}, the ${d} can only go in ${cellsText(spots)}, which are all in ${unitName(unit)}. The ${d} for box ${b + 1} has to be in that line, so no other square in ${unitName(unit)} can be ${d}.` };
    }
  }
  return null;
}

function boxLine(g: Grid, c: number[]): Step | null {
  for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
    const spots = UNITS[u].filter((i) => !g[i] && c[i] & bit(d));
    if (spots.length < 2) continue;
    const b = boxOf(spots[0]);
    if (!spots.every((i) => boxOf(i) === b)) continue;
    const eliminate = BOXES[b].filter((i) => !UNITS[u].includes(i) && !g[i] && c[i] & bit(d)).map((cell) => ({ cell, digit: d }));
    if (!eliminate.length) continue;
    return { technique: 'box-line', eliminate, cells: spots, units: [u, 18 + b], digits: [d],
      text: `In ${unitName(u)}, the ${d} can only go in ${cellsText(spots)}, which are all inside box ${b + 1}. So box ${b + 1}'s ${d} is in ${unitName(u)}, and the other squares of box ${b + 1} can't be ${d}.` };
  }
  return null;
}

// ---------- subsets ----------
function nakedSubset(g: Grid, c: number[], k: number): Step | null {
  for (let u = 0; u < 27; u++) {
    const open = UNITS[u].filter((i) => !g[i] && popcount(c[i]) >= 2 && popcount(c[i]) <= k);
    for (const set of combos(open, k)) {
      const union = set.reduce((m, i) => m | c[i], 0);
      if (popcount(union) !== k) continue;
      const ds = digitsOf(union);
      const eliminate: Elim[] = [];
      for (const i of UNITS[u]) if (!g[i] && !set.includes(i)) for (const d of ds) if (c[i] & bit(d)) eliminate.push({ cell: i, digit: d });
      if (!eliminate.length) continue;
      const word = k === 2 ? 'two' : 'three';
      return { technique: k === 2 ? 'naked-pair' : 'naked-triple', eliminate, cells: set, units: [u], digits: ds,
        text: `In ${unitName(u)}, the ${word} squares ${cellsText(set)} can only hold ${digitsText(ds)}. Those ${word} digits must go in those ${word} squares, so the other squares in ${unitName(u)} can't be ${digitsText(ds)}.` };
    }
  }
  return null;
}

function hiddenSubset(g: Grid, c: number[], k: number): Step | null {
  for (let u = 0; u < 27; u++) {
    const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !UNITS[u].some((i) => g[i] === d));
    const where = (d: number) => UNITS[u].filter((i) => !g[i] && c[i] & bit(d));
    const cand = missing.filter((d) => { const n = where(d).length; return n >= 2 && n <= k; });
    for (const ds of combos(cand, k)) {
      const cells = [...new Set(ds.flatMap(where))].sort((a, b) => a - b);
      if (cells.length !== k) continue;
      const keep = ds.reduce((m, d) => m | bit(d), 0);
      const eliminate: Elim[] = [];
      for (const i of cells) for (const d of digitsOf(c[i] & ~keep)) eliminate.push({ cell: i, digit: d });
      if (!eliminate.length) continue;
      const word = k === 2 ? 'two' : 'three';
      return { technique: k === 2 ? 'hidden-pair' : 'hidden-triple', eliminate, cells, units: [u], digits: ds,
        text: `In ${unitName(u)}, the digits ${digitsText(ds)} can only go in ${cellsText(cells)}. Those ${word} squares are taken by those ${word} digits, so any other pencil marks in them can go.` };
    }
  }
  return null;
}

// ---------- fish (X-Wing, Swordfish) ----------
function fish(g: Grid, c: number[], n: number): Step | null {
  for (let d = 1; d <= 9; d++) for (const byRow of [true, false]) {
    const base = byRow ? ROWS : COLS, cover = byRow ? COLS : ROWS;
    const pos = (line: number[]) => line.map((i, k) => (!g[i] && c[i] & bit(d) ? k : -1)).filter((k) => k >= 0);
    const lines = [...Array(9).keys()].filter((l) => { const p = pos(base[l]).length; return p >= 2 && p <= n && !base[l].some((i) => g[i] === d); });
    for (const set of combos(lines, n)) {
      const covers = [...new Set(set.flatMap((l) => pos(base[l])))].sort((a, b) => a - b);
      if (covers.length !== n) continue;
      const eliminate: Elim[] = [];
      for (const cv of covers) for (const i of cover[cv]) {
        const l = byRow ? rowOf(i) : colOf(i);
        if (!set.includes(l) && !g[i] && c[i] & bit(d)) eliminate.push({ cell: i, digit: d });
      }
      if (!eliminate.length) continue;
      const cells = set.flatMap((l) => pos(base[l]).map((k) => base[l][k]));
      const bName = byRow ? 'rows' : 'columns', cName = byRow ? 'columns' : 'rows';
      const units = [...set.map((l) => (byRow ? l : 9 + l)), ...covers.map((k) => (byRow ? 9 + k : k))];
      const ls = digitsText(set.map((l) => String(l + 1))), cs = digitsText(covers.map((k) => String(k + 1)));
      const name = n === 2 ? 'x-wing' : 'swordfish';
      return { technique: name, eliminate, cells, units, digits: [d],
        text: `In ${bName} ${ls}, the ${d} can only go in ${cName} ${cs}. Each of those ${bName} needs its own ${d}, so the ${d}s fill ${cName} ${cs} between them. That means no other square in ${cName} ${cs} can be ${d}.` };
    }
  }
  return null;
}

// ---------- XY-Wing ----------
const sees = (a: number, b: number) => a !== b && PEERS[a].includes(b);
function xyWing(g: Grid, c: number[]): Step | null {
  const pairs = [...Array(81).keys()].filter((i) => !g[i] && popcount(c[i]) === 2);
  for (const pivot of pairs) {
    const [x, y] = digitsOf(c[pivot]);
    const wings = pairs.filter((i) => sees(pivot, i));
    for (const a of wings) for (const b of wings) {
      if (a >= b) continue;
      const ma = c[a], mb = c[b];
      if (ma === c[pivot] || mb === c[pivot] || ma === mb) continue;
      // a holds x plus z, b holds y plus z (either way round).
      for (const [p, q] of [[x, y], [y, x]]) {
        if (!(ma & bit(p)) || ma & bit(q) || !(mb & bit(q)) || mb & bit(p)) continue;
        const za = ma & ~bit(p), zb = mb & ~bit(q);
        if (za !== zb) continue;
        const z = onlyDigit(za);
        const eliminate = [...Array(81).keys()].filter((i) => i !== pivot && !g[i] && c[i] & bit(z) && sees(i, a) && sees(i, b)).map((cell) => ({ cell, digit: z }));
        if (!eliminate.length) continue;
        return { technique: 'xy-wing', eliminate, cells: [pivot, a, b], units: [], digits: [x, y, z],
          text: `${cellName(pivot)} is either ${p} or ${q}. If it is ${p}, then ${cellName(a)} must be ${z}. If it is ${q}, then ${cellName(b)} must be ${z}. Either way one of them is ${z}, so any square that sees both ${cellName(a)} and ${cellName(b)} can't be ${z}.` };
      }
    }
  }
  return null;
}

/** The next step a person would find, easiest technique first, or null if none of these techniques helps. */
export function nextStep(g: Grid, c: number[]): Step | null {
  return nakedSingle(g, c) ?? hiddenSingle(g, c) ?? pointing(g, c) ?? boxLine(g, c)
    ?? nakedSubset(g, c, 2) ?? hiddenSubset(g, c, 2) ?? nakedSubset(g, c, 3) ?? hiddenSubset(g, c, 3)
    ?? fish(g, c, 2) ?? xyWing(g, c) ?? fish(g, c, 3);
}

export interface LogicResult { steps: Step[]; solved: boolean; grid: Grid; hardest: TechniqueId | null }

/** Solve as far as these techniques go, from the given digits (or from given candidates). */
export function solveLogically(start: Grid, startCands?: number[], maxSteps = 500): LogicResult {
  const g = start.slice();
  const c = startCands ? startCands.slice() : candidates(g);
  const steps: Step[] = [];
  let hardest: TechniqueId | null = null;
  const rank = (t: TechniqueId) => TECHNIQUES.findIndex((x) => x.id === t);
  while (steps.length < maxSteps) {
    if (g.every((v) => v)) break;
    const s = nextStep(g, c);
    if (!s) break;
    steps.push(s);
    applyStep(g, c, s);
    if (hardest === null || rank(s.technique) > rank(hardest)) hardest = s.technique;
  }
  return { steps, solved: g.every((v) => v), grid: g, hardest };
}

export type Rating = { level: Level | 'beyond'; hardest: TechniqueId | null; steps: number };
/** Difficulty from the hardest technique needed; 'beyond' when these techniques can't finish it. */
export function rate(g: Grid): Rating {
  const r = solveLogically(g);
  if (!r.solved) return { level: 'beyond', hardest: r.hardest, steps: r.steps.length };
  return { level: r.hardest ? TECH[r.hardest].level : 'easy', hardest: r.hardest, steps: r.steps.length };
}

