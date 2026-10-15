/**
 * The 9x9 board: 81 cells in row-major order, 0 for empty, 1-9 for a digit.
 * Candidates are 9-bit masks (bit d-1 set means digit d is still possible).
 * Everything here is pure, so the solvers, generator and UI share one model.
 */
export type Grid = number[];
export const ALL = 0x1ff;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 27 units: rows 0-8, columns 9-17, boxes 18-26, each a list of 9 cell indexes. */
export const ROWS: number[][] = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c));
export const COLS: number[][] = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c));
export const BOXES: number[][] = Array.from({ length: 9 }, (_, b) =>
  Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)));
export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];
export const UNITS_OF: number[][] = Array.from({ length: 81 }, (_, i) => [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);
/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of UNITS_OF[i]) for (const j of UNITS[u]) if (j !== i) s.add(j);
  return [...s].sort((a, b) => a - b);
});

export const bit = (d: number) => 1 << (d - 1);
export const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
export const digitsOf = (m: number): number[] => { const out: number[] = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };
export const onlyDigit = (m: number) => 32 - Math.clz32(m);

export const emptyGrid = (): Grid => new Array(81).fill(0);
export const cellName = (i: number) => `r${rowOf(i) + 1}c${colOf(i) + 1}`;
export const unitName = (u: number) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);

/**
 * Read a puzzle from text: 81 cells where 1-9 are digits and 0 . - _ * are
 * blanks. Spaces, newlines and grid lines (| + -- =) between cells are ignored,
 * so a pasted, pretty-printed grid works too. Returns null if there are not
 * exactly 81 cells.
 */
export function parseGrid(text: string): Grid | null {
  const cleaned = text.replace(/[|+=]/g, ' ').replace(/-{2,}/g, ' ');
  const cells = cleaned.match(/[0-9._*-]/g);
  if (!cells || cells.length !== 81) return null;
  return cells.map((c) => (c >= '1' && c <= '9' ? +c : 0));
}

/** 81 characters, '.' for blanks unless `zero` asks for '0'. */
export const gridString = (g: Grid, zero = false) => g.map((v) => (v ? String(v) : zero ? '0' : '.')).join('');

/** A pretty, human-readable 9x9 block for copying into notes. */
export function prettyGrid(g: Grid): string {
  const lines: string[] = [];
  for (let r = 0; r < 9; r++) {
    if (r && r % 3 === 0) lines.push('------+-------+------');
    const row = g.slice(r * 9, r * 9 + 9).map((v) => (v ? String(v) : '.'));
    lines.push(`${row.slice(0, 3).join(' ')} | ${row.slice(3, 6).join(' ')} | ${row.slice(6).join(' ')}`);
  }
  return lines.join('\n');
}

/** Cells whose digit also appears in one of their peers. */
export function conflicts(g: Grid): Set<number> {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = g[i];
      if (!v) continue;
      const j = seen.get(v);
      if (j !== undefined) { bad.add(i); bad.add(j); } else seen.set(v, i);
    }
  }
  return bad;
}

/** Digits still allowed in cell i by its filled peers (0 for a filled cell). */
export function allowed(g: Grid, i: number): number {
  if (g[i]) return 0;
  let m = ALL;
  for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
  return m;
}

/** Candidate masks for every cell, from the filled digits alone (auto pencil marks). */
export const candidates = (g: Grid): number[] => g.map((_, i) => allowed(g, i));

export const isComplete = (g: Grid) => g.every((v) => v > 0) && conflicts(g).size === 0;
export const filledCount = (g: Grid) => g.reduce((a, v) => a + (v ? 1 : 0), 0);
