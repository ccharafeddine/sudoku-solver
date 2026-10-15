/**
 * The human-style solver. It works the way a person does: keep pencil marks
 * (candidates) and look for one pattern at a time, easiest first. Each step
 * names its technique, lists the cells involved and says in plain words why
 * it works, so the app can show it as a hint or play it back. It works on
 * every shape in board.ts (Killer adds a cage-sum step).
 */
import { CLASSIC, bit, candidates, cellName, digitsOf, groupWords, onlyDigit, popcount, unitName, type Geo, type Grid } from './board';

export type TechniqueId =
  | 'naked-single' | 'hidden-single' | 'cage-sum' | 'pointing' | 'box-line' | 'naked-pair' | 'hidden-pair'
  | 'naked-triple' | 'hidden-triple' | 'x-wing' | 'xy-wing' | 'swordfish'
  | 'xyz-wing' | 'w-wing' | 'simple-colouring' | 'unique-rectangle' | 'jellyfish';

export type Level = 'easy' | 'medium' | 'hard' | 'expert' | 'fiendish';
export interface Technique { id: TechniqueId; name: string; level: Level; blurb: string }
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert', 'fiendish'];
export const LEVEL_LABELS: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', fiendish: 'Fiendish' };

/** Easiest first: the order the solver tries them in. */
export const TECHNIQUES: Technique[] = [
  { id: 'naked-single', name: 'Naked single', level: 'easy', blurb: 'A square where only one digit fits.' },
  { id: 'hidden-single', name: 'Hidden single', level: 'easy', blurb: 'A digit that has only one place left in a group.' },
  { id: 'cage-sum', name: 'Cage sum', level: 'medium', blurb: 'Only some sets of digits add up to a cage\'s total.' },
  { id: 'pointing', name: 'Pointing', level: 'medium', blurb: 'Inside a box, a digit can only go in one line, so it can\'t go anywhere else in that line.' },
  { id: 'box-line', name: 'Box-line', level: 'medium', blurb: 'In a line, a digit can only go inside one box, so the rest of that box can\'t have it.' },
  { id: 'naked-pair', name: 'Naked pair', level: 'medium', blurb: 'Two squares in a group can only hold the same two digits, so nobody else in the group can.' },
  { id: 'hidden-pair', name: 'Hidden pair', level: 'medium', blurb: 'Two digits can only go in the same two squares, so those squares can\'t hold anything else.' },
  { id: 'naked-triple', name: 'Naked triple', level: 'hard', blurb: 'Three squares share just three digits between them.' },
  { id: 'hidden-triple', name: 'Hidden triple', level: 'hard', blurb: 'Three digits can only go in the same three squares.' },
  { id: 'x-wing', name: 'X-Wing', level: 'hard', blurb: 'A digit fits in only two spots in each of two rows, and they line up in a rectangle.' },
  { id: 'xy-wing', name: 'XY-Wing', level: 'expert', blurb: 'Three two-digit squares that link up, so one digit must be in one of two places.' },
  { id: 'swordfish', name: 'Swordfish', level: 'expert', blurb: 'Like an X-Wing, but with three rows and three columns.' },
  { id: 'xyz-wing', name: 'XYZ-Wing', level: 'fiendish', blurb: 'An XY-Wing whose middle square also holds the shared digit.' },
  { id: 'w-wing', name: 'W-Wing', level: 'fiendish', blurb: 'Two matching two-digit squares joined by a digit that has only two spots in a group.' },
  { id: 'simple-colouring', name: 'Simple colouring', level: 'fiendish', blurb: 'Follow one digit along squares where it must be in one of two places, colouring them in turn.' },
  { id: 'unique-rectangle', name: 'Unique rectangle', level: 'fiendish', blurb: 'A puzzle has only one answer, so four squares can\'t be left with the same two swappable digits.' },
  { id: 'jellyfish', name: 'Jellyfish', level: 'fiendish', blurb: 'Like a Swordfish, with four rows and four columns.' },
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
  /** The groups the pattern lives in (indexes into geo.units). */
  units: number[];
  /** The digits the pattern is about. */
  digits: number[];
  /** What it means, in plain words. */
  text: string;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const digitsText = (ds: (number | string)[]) => list(ds.map(String));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function combos<T>(xs: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < xs.length; i++) { acc.push(xs[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

/** Everything a technique needs: the board, its candidates and its shape. */
class View {
  readonly cn: (i: number) => string;
  constructor(readonly g: Grid, readonly c: number[], readonly geo: Geo) { this.cn = (i) => cellName(i, geo.n); }
  cells(cs: number[]) { return list(cs.map(this.cn)); }
  un(u: number) { return unitName(u, this.geo); }
  has(i: number, d: number) { return !this.g[i] && (this.c[i] & bit(d)) !== 0; }
  sees(a: number, b: number) { return a !== b && this.geo.peers[a].includes(b); }
  /** Groups that must hold every digit (strong links and hidden sets only live there). */
  get fullUnits() { return this.geo.units.map((_, k) => k).filter((k) => this.geo.units[k].full); }
  unitHas(u: number, d: number) { return this.geo.units[u].cells.some((i) => this.g[i] === d); }
  spots(u: number, d: number) { return this.geo.units[u].cells.filter((i) => this.has(i, d)); }
  digits() { return Array.from({ length: this.geo.n }, (_, k) => k + 1); }
  elimsSeeingAll(d: number, from: number[], skip: number[] = from): Elim[] {
    const out: Elim[] = [];
    for (let i = 0; i < this.geo.size; i++) if (!skip.includes(i) && this.has(i, d) && from.every((f) => this.sees(i, f))) out.push({ cell: i, digit: d });
    return out;
  }
}

/** Write a placement or crossings-out into a board and its candidates. */
export function applyStep(g: Grid, cands: number[], s: Step, geo: Geo = CLASSIC): void {
  if (s.place) {
    const { cell, digit } = s.place;
    g[cell] = digit;
    cands[cell] = 0;
    for (const p of geo.peers[cell]) cands[p] &= ~bit(digit);
  }
  for (const e of s.eliminate) cands[e.cell] &= ~bit(e.digit);
}

// ---------- singles ----------
function nakedSingle(v: View): Step | null {
  for (let i = 0; i < v.geo.size; i++) {
    if (v.g[i] || popcount(v.c[i]) !== 1) continue;
    const d = onlyDigit(v.c[i]);
    return { technique: 'naked-single', place: { cell: i, digit: d }, eliminate: [], cells: [i], units: [], digits: [d],
      text: `Look at ${v.cn(i)}. Every other digit is already used in its ${groupWords(v.geo)} or ruled out, so the only digit that fits is ${d}.` };
  }
  return null;
}

function hiddenSingle(v: View): Step | null {
  // Boxes first: that is where people spot them most easily.
  const full = v.fullUnits;
  const order = [...full.filter((u) => v.geo.units[u].kind === 'box'), ...full.filter((u) => v.geo.units[u].kind !== 'box')];
  for (const u of order) for (const d of v.digits()) {
    if (v.unitHas(u, d)) continue;
    const spots = v.spots(u, d);
    if (spots.length !== 1) continue;
    const i = spots[0];
    return { technique: 'hidden-single', place: { cell: i, digit: d }, eliminate: [], cells: [i], units: [u], digits: [d],
      text: `${cap(v.un(u))} needs a ${d}, and ${v.cn(i)} is the only square in it where ${d} can go. So ${v.cn(i)} is ${d}.` };
  }
  return null;
}

// ---------- Killer cages ----------
function cageSum(v: View): Step | null {
  const { geo } = v;
  for (let u = 0; u < geo.units.length; u++) {
    const unit = geo.units[u];
    if (unit.kind !== 'cage') continue;
    const open = unit.cells.filter((i) => !v.g[i]);
    if (!open.length) continue;
    const rest = unit.sum! - unit.cells.reduce((a, i) => a + v.g[i], 0);
    const used = unit.cells.reduce((m, i) => (v.g[i] ? m | bit(v.g[i]) : m), 0);
    // Try every way to fill the open squares from their marks, with no repeats, adding up to what is left.
    const ok = new Array(open.length).fill(0);
    const sets = new Set<number>();
    const pick: number[] = [];
    const rec = (k: number, mask: number, sum: number) => {
      if (sum > rest) return;
      if (k === open.length) { if (sum === rest) { pick.forEach((d, j) => (ok[j] |= bit(d))); sets.add(mask); } return; }
      for (const d of digitsOf(v.c[open[k]])) if (!(mask & bit(d))) { pick[k] = d; rec(k + 1, mask | bit(d), sum + d); }
    };
    rec(0, used, 0);
    const eliminate: Elim[] = [];
    open.forEach((i, k) => { for (const d of digitsOf(v.c[i] & ~ok[k])) eliminate.push({ cell: i, digit: d }); });
    if (!eliminate.length) continue;
    const ways = [...sets].map((m) => digitsOf(m & ~used).join('+')).sort();
    const shown = ways.slice(0, 4).join(', ') + (ways.length > 4 ? ' and others' : '');
    const lost = [...new Set(eliminate.map((e) => e.digit))].sort((a, b) => a - b);
    return { technique: 'cage-sum', eliminate, cells: unit.cells, units: [u], digits: lost,
      text: `The cage at ${v.cn(unit.cells[0])} must add up to ${unit.sum}${used ? `, so its empty squares need ${rest}` : ''}. With the marks left, the only ways are ${shown}. So ${digitsText(lost)} can't go where they are crossed out.` };
  }
  return null;
}

// ---------- intersections ----------
function intersections(v: View): Step | null {
  const { geo } = v;
  const full = v.fullUnits;
  // Pointing (box into a line) before box-line (line into a box), as people learn them.
  const pairs: [number, number][] = [];
  for (const a of full) for (const b of full) if (a !== b && geo.units[a].kind === 'box' && geo.units[b].kind !== 'box') pairs.push([a, b]);
  for (const a of full) for (const b of full) if (a !== b && geo.units[a].kind !== 'box' && geo.units[b].kind === 'box') pairs.push([a, b]);
  for (const [a, b] of pairs) {
    const inB = new Set(geo.units[b].cells);
    if (geo.units[a].cells.filter((i) => inB.has(i)).length < 2) continue;
    for (const d of v.digits()) {
      const spots = v.spots(a, d);
      if (spots.length < 2 || !spots.every((i) => inB.has(i))) continue;
      const eliminate = geo.units[b].cells.filter((i) => !spots.includes(i) && v.has(i, d)).map((cell) => ({ cell, digit: d }));
      if (!eliminate.length) continue;
      const pointing = geo.units[a].kind === 'box';
      return { technique: pointing ? 'pointing' : 'box-line', eliminate, cells: spots, units: [a, b], digits: [d],
        text: `In ${v.un(a)}, the ${d} can only go in ${v.cells(spots)}, which are all in ${v.un(b)}. So the ${d} for ${v.un(a)} is in ${v.un(b)}, and no other square in ${v.un(b)} can be ${d}.` };
    }
  }
  return null;
}

// ---------- subsets ----------
function nakedSubset(v: View, k: number): Step | null {
  for (let u = 0; u < v.geo.units.length; u++) {
    const cellsU = v.geo.units[u].cells;
    const open = cellsU.filter((i) => !v.g[i] && popcount(v.c[i]) >= 2 && popcount(v.c[i]) <= k);
    for (const set of combos(open, k)) {
      const union = set.reduce((m, i) => m | v.c[i], 0);
      if (popcount(union) !== k) continue;
      const ds = digitsOf(union);
      const eliminate: Elim[] = [];
      for (const i of cellsU) if (!v.g[i] && !set.includes(i)) for (const d of ds) if (v.c[i] & bit(d)) eliminate.push({ cell: i, digit: d });
      if (!eliminate.length) continue;
      const word = k === 2 ? 'two' : 'three';
      return { technique: k === 2 ? 'naked-pair' : 'naked-triple', eliminate, cells: set, units: [u], digits: ds,
        text: `In ${v.un(u)}, the ${word} squares ${v.cells(set)} can only hold ${digitsText(ds)}. Those ${word} digits must go in those ${word} squares, so the other squares in ${v.un(u)} can't be ${digitsText(ds)}.` };
    }
  }
  return null;
}

function hiddenSubset(v: View, k: number): Step | null {
  for (const u of v.fullUnits) {
    const missing = v.digits().filter((d) => !v.unitHas(u, d));
    const cand = missing.filter((d) => { const n = v.spots(u, d).length; return n >= 2 && n <= k; });
    for (const ds of combos(cand, k)) {
      const cells = [...new Set(ds.flatMap((d) => v.spots(u, d)))].sort((a, b) => a - b);
      if (cells.length !== k) continue;
      const keep = ds.reduce((m, d) => m | bit(d), 0);
      const eliminate: Elim[] = [];
      for (const i of cells) for (const d of digitsOf(v.c[i] & ~keep)) eliminate.push({ cell: i, digit: d });
      if (!eliminate.length) continue;
      const word = k === 2 ? 'two' : 'three';
      return { technique: k === 2 ? 'hidden-pair' : 'hidden-triple', eliminate, cells, units: [u], digits: ds,
        text: `In ${v.un(u)}, the digits ${digitsText(ds)} can only go in ${v.cells(cells)}. Those ${word} squares are taken by those ${word} digits, so any other pencil marks in them can go.` };
    }
  }
  return null;
}

// ---------- fish (X-Wing, Swordfish, Jellyfish) ----------
const FISH: Record<number, TechniqueId> = { 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' };
function fish(v: View, size: number): Step | null {
  const { n } = v.geo;
  if (size * 2 > n) return null;
  for (const d of v.digits()) for (const byRow of [true, false]) {
    const base = (l: number) => v.geo.units[byRow ? l : n + l].cells;
    const cover = (k: number) => v.geo.units[byRow ? n + k : k].cells;
    const pos = (l: number) => base(l).map((i, k) => (v.has(i, d) ? k : -1)).filter((k) => k >= 0);
    const lines = [...Array(n).keys()].filter((l) => { const p = pos(l).length; return p >= 2 && p <= size && !base(l).some((i) => v.g[i] === d); });
    for (const set of combos(lines, size)) {
      const covers = [...new Set(set.flatMap(pos))].sort((a, b) => a - b);
      if (covers.length !== size) continue;
      const eliminate: Elim[] = [];
      for (const cv of covers) for (const i of cover(cv)) {
        const l = byRow ? Math.floor(i / n) : i % n;
        if (!set.includes(l) && v.has(i, d)) eliminate.push({ cell: i, digit: d });
      }
      if (!eliminate.length) continue;
      const cells = set.flatMap((l) => pos(l).map((k) => base(l)[k]));
      const bName = byRow ? 'rows' : 'columns', cName = byRow ? 'columns' : 'rows';
      const units = [...set.map((l) => (byRow ? l : n + l)), ...covers.map((k) => (byRow ? n + k : k))];
      const ls = digitsText(set.map((l) => l + 1)), cs = digitsText(covers.map((k) => k + 1));
      return { technique: FISH[size], eliminate, cells, units, digits: [d],
        text: `In ${bName} ${ls}, the ${d} can only go in ${cName} ${cs}. Each of those ${bName} needs its own ${d}, so the ${d}s fill ${cName} ${cs} between them. That means no other square in ${cName} ${cs} can be ${d}.` };
    }
  }
  return null;
}

// ---------- wings ----------
function bivalues(v: View) { return [...Array(v.geo.size).keys()].filter((i) => !v.g[i] && popcount(v.c[i]) === 2); }

function xyWing(v: View): Step | null {
  const pairs = bivalues(v);
  for (const pivot of pairs) {
    const [x, y] = digitsOf(v.c[pivot]);
    const wings = pairs.filter((i) => v.sees(pivot, i));
    for (const a of wings) for (const b of wings) {
      if (a >= b) continue;
      const ma = v.c[a], mb = v.c[b];
      if (ma === v.c[pivot] || mb === v.c[pivot] || ma === mb) continue;
      for (const [p, q] of [[x, y], [y, x]]) {
        if (!(ma & bit(p)) || ma & bit(q) || !(mb & bit(q)) || mb & bit(p)) continue;
        const za = ma & ~bit(p), zb = mb & ~bit(q);
        if (za !== zb) continue;
        const z = onlyDigit(za);
        const eliminate = v.elimsSeeingAll(z, [a, b], [pivot, a, b]);
        if (!eliminate.length) continue;
        return { technique: 'xy-wing', eliminate, cells: [pivot, a, b], units: [], digits: [x, y, z],
          text: `${v.cn(pivot)} is either ${p} or ${q}. If it is ${p}, then ${v.cn(a)} must be ${z}. If it is ${q}, then ${v.cn(b)} must be ${z}. Either way one of them is ${z}, so any square that sees both ${v.cn(a)} and ${v.cn(b)} can't be ${z}.` };
      }
    }
  }
  return null;
}

function xyzWing(v: View): Step | null {
  const pairs = bivalues(v);
  for (let pivot = 0; pivot < v.geo.size; pivot++) {
    if (v.g[pivot] || popcount(v.c[pivot]) !== 3) continue;
    const pm = v.c[pivot];
    const wings = pairs.filter((i) => v.sees(pivot, i) && (v.c[i] & ~pm) === 0);
    for (const a of wings) for (const b of wings) {
      if (a >= b || v.c[a] === v.c[b] || (v.c[a] | v.c[b]) !== pm) continue;
      const z = onlyDigit(v.c[a] & v.c[b]);
      const eliminate = v.elimsSeeingAll(z, [pivot, a, b]);
      if (!eliminate.length) continue;
      const [p] = digitsOf(v.c[a] & ~bit(z)), [q] = digitsOf(v.c[b] & ~bit(z));
      return { technique: 'xyz-wing', eliminate, cells: [pivot, a, b], units: [], digits: [p, q, z],
        text: `${v.cn(pivot)} is ${p}, ${q} or ${z}. If it is ${p}, ${v.cn(a)} must be ${z}. If it is ${q}, ${v.cn(b)} must be ${z}. Otherwise it is ${z} itself. So one of those three squares is ${z}, and a square that sees all three can't be ${z}.` };
    }
  }
  return null;
}

function wWing(v: View): Step | null {
  const pairs = bivalues(v);
  for (const p of pairs) for (const q of pairs) {
    if (p >= q || v.c[p] !== v.c[q] || v.sees(p, q)) continue;
    const [x, y] = digitsOf(v.c[p]);
    for (const [link, other] of [[x, y], [y, x]]) {
      for (const u of v.fullUnits) {
        const s = v.spots(u, link);
        if (s.length !== 2 || s.includes(p) || s.includes(q)) continue;
        const [a, b] = s;
        const ok = (v.sees(a, p) && v.sees(b, q)) || (v.sees(a, q) && v.sees(b, p));
        if (!ok) continue;
        const eliminate = v.elimsSeeingAll(other, [p, q]);
        if (!eliminate.length) continue;
        return { technique: 'w-wing', eliminate, cells: [p, q, a, b], units: [u], digits: [x, y],
          text: `${v.cn(p)} and ${v.cn(q)} can each only be ${x} or ${y}. In ${v.un(u)}, the ${link} has just two spots, ${v.cn(a)} and ${v.cn(b)}, one seeing each of them. One spot must be ${link}, so ${v.cn(p)} or ${v.cn(q)} can't be ${link} and must be ${other}. So a square that sees both can't be ${other}.` };
      }
    }
  }
  return null;
}

// ---------- simple colouring ----------
function simpleColouring(v: View): Step | null {
  for (const d of v.digits()) {
    const adj = new Map<number, number[]>();
    for (const u of v.fullUnits) {
      const s = v.spots(u, d);
      if (s.length !== 2) continue;
      for (const [a, b] of [[s[0], s[1]], [s[1], s[0]]]) { if (!adj.has(a)) adj.set(a, []); if (!adj.get(a)!.includes(b)) adj.get(a)!.push(b); }
    }
    const colour = new Map<number, number>();
    for (const start of adj.keys()) {
      if (colour.has(start)) continue;
      const comp: number[] = [];
      const stack = [start];
      colour.set(start, 0);
      while (stack.length) {
        const a = stack.pop()!;
        comp.push(a);
        for (const b of adj.get(a)!) if (!colour.has(b)) { colour.set(b, 1 - colour.get(a)!); stack.push(b); }
      }
      if (comp.length < 4) continue;
      const side = [comp.filter((i) => colour.get(i) === 0), comp.filter((i) => colour.get(i) === 1)];
      // Wrap: two squares of one colour see each other, so that colour is wrong everywhere.
      for (const k of [0, 1]) {
        const clash = side[k].find((a) => side[k].some((b) => v.sees(a, b)));
        if (clash === undefined) continue;
        const mate = side[k].find((b) => v.sees(clash, b))!;
        return { technique: 'simple-colouring', eliminate: side[k].map((cell) => ({ cell, digit: d })), cells: comp, units: [], digits: [d],
          text: `Follow the ${d}: along this chain, each pair of squares holds the ${d} in one or the other, so the squares split into two colours and one colour is all ${d}. ${v.cn(clash)} and ${v.cn(mate)} have the same colour but see each other, so that colour can't be ${d}. Cross the ${d} out of all of them.` };
      }
      // Trap: a square that sees both colours can't be the digit.
      const eliminate: Elim[] = [];
      for (let i = 0; i < v.geo.size; i++) if (!colour.has(i) && v.has(i, d) && side[0].some((a) => v.sees(i, a)) && side[1].some((b) => v.sees(i, b))) eliminate.push({ cell: i, digit: d });
      if (eliminate.length) return { technique: 'simple-colouring', eliminate, cells: comp, units: [], digits: [d],
        text: `Follow the ${d}: along this chain of ${comp.length} squares, each linked pair holds the ${d} in one or the other, so the squares split into two colours and one whole colour is ${d}. ${v.cells(eliminate.map((e) => e.cell))} ${eliminate.length > 1 ? 'see' : 'sees'} squares of both colours, so ${eliminate.length > 1 ? 'they' : 'it'} can't be ${d}.` };
    }
  }
  return null;
}

// ---------- unique rectangle (type 1) ----------
function uniqueRectangle(v: View): Step | null {
  const { geo } = v;
  // Only for plain shapes: diagonals and cages can tell the two swapped answers apart.
  if (geo.variant === 'diagonal' || geo.variant === 'killer') return null;
  const n = geo.n, box = (i: number) => geo.unitsOf[i].find((u) => geo.units[u].kind === 'box');
  for (let r1 = 0; r1 < n; r1++) for (let r2 = r1 + 1; r2 < n; r2++) for (let c1 = 0; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) {
    const cs = [r1 * n + c1, r1 * n + c2, r2 * n + c1, r2 * n + c2];
    if (cs.some((i) => v.g[i]) || new Set(cs.map(box)).size !== 2) continue;
    const bi = cs.filter((i) => popcount(v.c[i]) === 2);
    if (bi.length !== 3 || !bi.every((i) => v.c[i] === v.c[bi[0]])) continue;
    const odd = cs.find((i) => !bi.includes(i))!;
    if ((v.c[odd] & v.c[bi[0]]) !== v.c[bi[0]]) continue;
    const [a, b] = digitsOf(v.c[bi[0]]);
    return { technique: 'unique-rectangle', eliminate: [a, b].map((digit) => ({ cell: odd, digit })), cells: cs, units: [], digits: [a, b],
      text: `${v.cells(bi)} can only be ${a} or ${b}. If ${v.cn(odd)} were also just ${a} or ${b}, the four corners could swap ${a} and ${b} and the puzzle would have two answers. A proper puzzle has one, so ${v.cn(odd)} must be one of its other digits: cross out ${a} and ${b}.` };
  }
  return null;
}

/** The next step a person would find, easiest technique first, or null if none of these techniques helps. */
export function nextStep(g: Grid, c: number[], geo: Geo = CLASSIC): Step | null {
  const v = new View(g, c, geo);
  return nakedSingle(v) ?? hiddenSingle(v) ?? cageSum(v) ?? intersections(v)
    ?? nakedSubset(v, 2) ?? hiddenSubset(v, 2) ?? nakedSubset(v, 3) ?? hiddenSubset(v, 3)
    ?? fish(v, 2) ?? xyWing(v) ?? fish(v, 3)
    ?? xyzWing(v) ?? wWing(v) ?? simpleColouring(v) ?? uniqueRectangle(v) ?? fish(v, 4);
}

export interface LogicResult { steps: Step[]; solved: boolean; grid: Grid; hardest: TechniqueId | null }

const rankOf = (t: TechniqueId) => TECHNIQUES.findIndex((x) => x.id === t);

/** Solve as far as these techniques go, from the given digits (or from given candidates). */
export function solveLogically(start: Grid, startCands?: number[], maxSteps = 800, geo: Geo = CLASSIC): LogicResult {
  const g = start.slice();
  const c = startCands ? startCands.slice() : candidates(g, geo);
  const steps: Step[] = [];
  let hardest: TechniqueId | null = null;
  while (steps.length < maxSteps) {
    if (g.every((x) => x)) break;
    const s = nextStep(g, c, geo);
    if (!s) break;
    steps.push(s);
    applyStep(g, c, s, geo);
    if (hardest === null || rankOf(s.technique) > rankOf(hardest)) hardest = s.technique;
  }
  return { steps, solved: g.every((x) => x), grid: g, hardest };
}

export type Rating = { level: Level | 'beyond'; hardest: TechniqueId | null; steps: number };
/** Difficulty from the hardest technique needed; 'beyond' when these techniques can't finish it. */
export function rate(g: Grid, geo: Geo = CLASSIC): Rating {
  const r = solveLogically(g, undefined, 800, geo);
  if (!r.solved) return { level: 'beyond', hardest: r.hardest, steps: r.steps.length };
  return { level: r.hardest ? TECH[r.hardest].level : 'easy', hardest: r.hardest, steps: r.steps.length };
}

/** One fish search on its own (tests build board states where only a Jellyfish applies). */
export const findFish = (g: Grid, c: number[], size: number, geo: Geo = CLASSIC) => fish(new View(g, c, geo), size);
