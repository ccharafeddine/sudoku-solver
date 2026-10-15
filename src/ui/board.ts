/**
 * Draws a 9x9 board as 81 buttons in a CSS grid. The same view draws the main
 * puzzle and the small boards in the tutorial. It only paints what it is told;
 * all game rules live in main.ts and src/sudoku.
 */
import { bit, cellName, colOf, digitsOf, rowOf } from '../sudoku/board';

export interface Marks {
  /** Pattern cells of a hint (outlined). */
  pattern?: Set<number>;
  /** Shaded cells: the rows, columns or boxes a hint is about. */
  area?: Set<number>;
  /** cell -> digits being crossed out (shown struck through in red). */
  strike?: Map<number, number>;
  /** cell -> digit to write in (shown as a ghost digit). */
  place?: Map<number, number>;
  /** Cells to flag as wrong. */
  wrong?: Set<number>;
  /** Digits the hint is about (highlighted in notes). */
  focus?: number;
}

export interface BoardModel {
  values: number[];
  givens: boolean[];
  /** Pencil-mark mask to show in each empty cell. */
  notes: (i: number) => number;
  selected: number;
  conflicts: Set<number>;
  /** Highlight the selected cell's row, column, box and matching digits. */
  guides: boolean;
  marks?: Marks;
}

export class BoardView {
  readonly cells: HTMLButtonElement[] = [];
  onCell: (i: number, e: MouseEvent) => void = () => {};

  constructor(readonly el: HTMLElement, label: string) {
    el.classList.add('board');
    el.setAttribute('role', 'grid');
    el.setAttribute('aria-label', label);
    for (let r = 0; r < 9; r++) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.className = 'brow';
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.i = String(i);
        b.setAttribute('role', 'gridcell');
        b.tabIndex = -1;
        if (c % 3 === 2 && c < 8) b.classList.add('br');
        if (r % 3 === 2 && r < 8) b.classList.add('bb');
        if (((Math.floor(r / 3) + Math.floor(c / 3)) & 1) === 1) b.classList.add('alt');
        b.addEventListener('click', (e) => this.onCell(i, e));
        this.cells.push(b);
        row.append(b);
      }
      el.append(row);
    }
  }

  draw(m: BoardModel) {
    const sel = m.selected, selVal = sel >= 0 ? m.values[sel] : 0;
    const mk = m.marks ?? {};
    for (let i = 0; i < 81; i++) {
      const b = this.cells[i], v = m.values[i];
      const peer = m.guides && sel >= 0 && i !== sel && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || (Math.floor(rowOf(i) / 3) === Math.floor(rowOf(sel) / 3) && Math.floor(colOf(i) / 3) === Math.floor(colOf(sel) / 3)));
      const cls = b.classList;
      cls.toggle('given', v > 0 && m.givens[i]);
      cls.toggle('entered', v > 0 && !m.givens[i]);
      cls.toggle('sel', i === sel);
      cls.toggle('peer', !!peer);
      cls.toggle('same', m.guides && selVal > 0 && v === selVal && i !== sel);
      cls.toggle('conflict', m.conflicts.has(i));
      cls.toggle('pattern', !!mk.pattern?.has(i));
      cls.toggle('area', !!mk.area?.has(i));
      cls.toggle('wrong', !!mk.wrong?.has(i));
      b.tabIndex = i === Math.max(0, sel) ? 0 : -1;
      const ghost = mk.place?.get(i);
      const strike = mk.strike?.get(i) ?? 0;
      let html: string;
      let label = `${cellName(i).replace('r', 'Row ').replace('c', ', column ')}: `;
      if (v) { html = `<span class="v">${v}</span>`; label += `${v}${m.givens[i] ? ' (given)' : ''}`; }
      else if (ghost) { html = `<span class="v ghost">${ghost}</span>`; label += `empty, hint: ${ghost}`; }
      else {
        const n = m.notes(i) | strike;
        if (n) {
          html = '<span class="notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            if (!(n & bit(d))) return '<i></i>';
            const c = strike & bit(d) ? ' class="x"' : mk.focus === d || (selVal === d && m.guides) ? ' class="f"' : '';
            return `<i${c}>${d}</i>`;
          }).join('') + '</span>';
          label += `empty, notes ${digitsOf(n).join(' ')}`;
        } else { html = ''; label += 'empty'; }
      }
      if (b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }
      if (m.conflicts.has(i)) label += ', clashes with another square';
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-selected', String(i === sel));
    }
  }
}
