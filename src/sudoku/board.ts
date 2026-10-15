/**
 * The board model, for every puzzle shape the app plays.
 *
 * A puzzle is a flat array of cells in row-major order (0 = empty) plus a
 * Geo: its size, its groups ("units") and which cells see each other.
 * Candidates are bitmasks (bit d-1 set means digit d is still possible).
 *
 *   classic   9x9, rows, columns, 3x3 boxes
 *   diagonal  classic plus both long diagonals
 *   killer    classic plus cages: dashed groups with a sum and no repeats
 *   mini6     6x6 with 2x3 boxes, digits 1-6
 *   mini4     4x4 with 2x2 boxes, digits 1-4
 *
 * Everything here is pure, so the solvers, generator and UI share one model.
 */
export type Grid = number[];
export type Variant = 'classic' | 'diagonal' | 'killer' | 'mini6' | 'mini4';
export const VARIANTS: Variant[] = ['classic', 'diagonal', 'killer', 'mini6', 'mini4'];
export const VARIANT_LABELS: Record<Variant, string> = { classic: 'Classic 9x9', diagonal: 'Diagonal (X)', killer: 'Killer', mini6: 'Mini 6x6', mini4: 'Mini 4x4' };

export type UnitKind = 'row' | 'col' | 'box' | 'diag' | 'cage';
export interface Unit {
  kind: UnitKind;
  cells: number[];
  /** Number within its kind, from 0. */
  index: number;
  /** True when the unit holds every digit once (rows, columns, boxes, diagonals); cages only forbid repeats. */
  full: boolean;
  /** Cage total. */
  sum?: number;
}
export interface Cage { cells: number[]; sum: number }

export interface Geo {
  variant: Variant;
  n: number;
  boxH: number;
  boxW: number;
  size: number;
  /** Mask with all n digits. */
  all: number;
  /** Rows 0..n-1, columns n..2n-1, boxes 2n..3n-1, then diagonals, then cages. */
  units: Unit[];
  unitsOf: number[][];
  peers: number[][];
  cages: Cage[];
  /** Cage number of each cell, or -1. */
  cageOf: number[];
}

const DIMS: Record<Variant, [number, number, number]> = { classic: [9, 3, 3], diagonal: [9, 3, 3], killer: [9, 3, 3], mini6: [6, 2, 3], mini4: [4, 2, 2] };

export function makeGeo(variant: Variant, cages: Cage[] = []): Geo {
  const [n, boxH, boxW] = DIMS[variant];
  const size = n * n;
  const units: Unit[] = [];
  for (let r = 0; r < n; r++) units.push({ kind: 'row', index: r, full: true, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) units.push({ kind: 'col', index: c, full: true, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  const perRow = n / boxW;
  for (let b = 0; b < n; b++) {
    const r0 = Math.floor(b / perRow) * boxH, c0 = (b % perRow) * boxW;
    units.push({ kind: 'box', index: b, full: true, cells: Array.from({ length: n }, (_, k) => (r0 + Math.floor(k / boxW)) * n + c0 + (k % boxW)) });
  }
  if (variant === 'diagonal') {
    units.push({ kind: 'diag', index: 0, full: true, cells: Array.from({ length: n }, (_, k) => k * n + k) });
    units.push({ kind: 'diag', index: 1, full: true, cells: Array.from({ length: n }, (_, k) => k * n + (n - 1 - k)) });
  }
  const cageOf = new Array(size).fill(-1);
  if (variant === 'killer') cages.forEach((cg, k) => {
    units.push({ kind: 'cage', index: k, full: cg.cells.length === n, cells: [...cg.cells].sort((a, b) => a - b), sum: cg.sum });
    for (const i of cg.cells) cageOf[i] = k;
  });
  const unitsOf: number[][] = Array.from({ length: size }, () => []);
  units.forEach((u, k) => u.cells.forEach((i) => unitsOf[i].push(k)));
  const peers = Array.from({ length: size }, (_, i) => {
    const s = new Set<number>();
    for (const u of unitsOf[i]) for (const j of units[u].cells) if (j !== i) s.add(j);
    return [...s].sort((a, b) => a - b);
  });
  return { variant, n, boxH, boxW, size, all: (1 << n) - 1, units, unitsOf, peers, cages: variant === 'killer' ? cages : [], cageOf };
}

export const CLASSIC = makeGeo('classic');
export const ALL = 0x1ff;

export const rowOf = (i: number, n = 9) => Math.floor(i / n);
export const colOf = (i: number, n = 9) => i % n;
export const boxOf = (i: number, geo: Geo = CLASSIC) => geo.unitsOf[i].find((u) => geo.units[u].kind === 'box')! - 2 * geo.n;

/** Classic 9x9 shortcuts (unit order: rows 0-8, columns 9-17, boxes 18-26). */
export const ROWS = CLASSIC.units.slice(0, 9).map((u) => u.cells);
export const COLS = CLASSIC.units.slice(9, 18).map((u) => u.cells);
export const BOXES = CLASSIC.units.slice(18, 27).map((u) => u.cells);
export const UNITS = CLASSIC.units.map((u) => u.cells);
export const UNITS_OF = CLASSIC.unitsOf;
export const PEERS = CLASSIC.peers;

export const bit = (d: number) => 1 << (d - 1);
export const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
export const digitsOf = (m: number): number[] => { const out: number[] = []; for (let d = 1; m >> (d - 1); d++) if (m & bit(d)) out.push(d); return out; };
export const onlyDigit = (m: number) => 32 - Math.clz32(m);

export const emptyGrid = (size = 81): Grid => new Array(size).fill(0);
export const cellName = (i: number, n = 9) => `r${rowOf(i, n) + 1}c${colOf(i, n) + 1}`;

export function unitName(u: number, geo: Geo = CLASSIC): string {
  const x = geo.units[u];
  switch (x.kind) {
    case 'row': return `row ${x.index + 1}`;
    case 'col': return `column ${x.index + 1}`;
    case 'box': return `box ${x.index + 1}`;
    case 'diag': return x.index === 0 ? 'the diagonal from top-left' : 'the diagonal from top-right';
    case 'cage': return `the ${x.sum} cage at ${cellName(x.cells[0], geo.n)}`;
  }
}

/** The groups a cell's digit must not repeat in, in words: "row, column or box". */
export function groupWords(geo: Geo): string {
  if (geo.variant === 'diagonal') return 'row, column, box or diagonal';
  if (geo.variant === 'killer') return 'row, column, box or cage';
  return 'row, column or box';
}

/**
 * Read a puzzle from text: `size` cells where digits are digits and 0 . - _ *
 * are blanks. Spaces, newlines and grid lines (| + -- =) are ignored, so a
 * pasted, pretty-printed grid works too. Returns null on the wrong count.
 */
export function parseGrid(text: string, size = 81): Grid | null {
  const cleaned = text.replace(/[|+=]/g, ' ').replace(/-{2,}/g, ' ');
  const cells = cleaned.match(/[0-9._*-]/g);
  if (!cells || cells.length !== size) return null;
  const n = Math.round(Math.sqrt(size));
  return cells.map((c) => (c >= '1' && c <= '9' && +c <= n ? +c : 0));
}

/** One character per cell, '.' for blanks unless `zero` asks for '0'. */
export const gridString = (g: Grid, zero = false) => g.map((v) => (v ? String(v) : zero ? '0' : '.')).join('');

/** A pretty, human-readable block for copying into notes. */
export function prettyGrid(g: Grid, geo: Geo = CLASSIC): string {
  const { n, boxH, boxW } = geo;
  const lines: string[] = [];
  const sep = Array.from({ length: n / boxW }, () => '-'.repeat(boxW * 2 - 1)).join('-+-');
  for (let r = 0; r < n; r++) {
    if (r && r % boxH === 0) lines.push(sep);
    const row = g.slice(r * n, r * n + n).map((v) => (v ? String(v) : '.'));
    const parts: string[] = [];
    for (let c = 0; c < n; c += boxW) parts.push(row.slice(c, c + boxW).join(' '));
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

/** Cells breaking a rule: a repeated digit in a group, or a full cage with the wrong total. */
export function conflicts(g: Grid, geo: Geo = CLASSIC): Set<number> {
  const bad = new Set<number>();
  for (const u of geo.units) {
    const seen = new Map<number, number>();
    let sum = 0, filled = 0;
    for (const i of u.cells) {
      const v = g[i];
      if (!v) continue;
      sum += v; filled++;
      const j = seen.get(v);
      if (j !== undefined) { bad.add(i); bad.add(j); } else seen.set(v, i);
    }
    if (u.sum !== undefined && (sum > u.sum || (filled === u.cells.length && sum !== u.sum))) for (const i of u.cells) if (g[i]) bad.add(i);
  }
  return bad;
}

/** Digits still allowed in cell i by its filled peers (0 for a filled cell). */
export function allowed(g: Grid, i: number, geo: Geo = CLASSIC): number {
  if (g[i]) return 0;
  let m = geo.all;
  for (const p of geo.peers[i]) if (g[p]) m &= ~bit(g[p]);
  return m;
}

/** Candidate masks for every cell, from the filled digits alone (auto pencil marks). */
export const candidates = (g: Grid, geo: Geo = CLASSIC): number[] => g.map((_, i) => allowed(g, i, geo));

export const isComplete = (g: Grid, geo: Geo = CLASSIC) => g.every((v) => v > 0) && conflicts(g, geo).size === 0;
export const filledCount = (g: Grid) => g.reduce((a, v) => a + (v ? 1 : 0), 0);
