/**
 * Draws a board as buttons in a CSS grid, for any shape: 9x9, 6x6 and 4x4
 * boxes, shaded diagonals, and dashed Killer cages with their totals. The
 * same view draws the main puzzle and the small boards in the tutorial. It
 * only paints what it is told; all game rules live in main.ts and src/sudoku.
 */
import { CLASSIC, bit, cellName, digitsOf, type Geo } from '../sudoku/board';

export interface Marks {
  /** Pattern cells of a hint (outlined). */
  pattern?: Set<number>;
  /** Shaded cells: the groups a hint is about. */
  area?: Set<number>;
  /** cell -> digits being crossed out (shown struck through in red). */
  strike?: Map<number, number>;
  /** cell -> digit to write in (shown as a ghost digit). */
  place?: Map<number, number>;
  /** Cells to flag as wrong. */
  wrong?: Set<number>;
  /** Digit the hint is about (highlighted in notes). */
  focus?: number;
}

export interface BoardModel {
  values: number[];
  givens: boolean[];
  /** Pencil-mark mask to show in each empty cell. */
  notes: (i: number) => number;
  selected: number;
  conflicts: Set<number>;
  /** Highlight the selected cell's groups and matching digits. */
  guides: boolean;
  marks?: Marks;
}

export class BoardView {
  cells: HTMLButtonElement[] = [];
  geo: Geo = CLASSIC;
  onCell: (i: number, e: MouseEvent) => void = () => {};

  constructor(readonly el: HTMLElement, label: string, geo: Geo = CLASSIC) {
    el.classList.add('board');
    el.setAttribute('role', 'grid');
    el.setAttribute('aria-label', label);
    this.build(geo);
  }

  /** Lay out the cells for a shape (cheap; called when the puzzle's shape or cages change). */
  build(geo: Geo) {
    this.geo = geo;
    const { n, boxH, boxW } = geo;
    this.el.replaceChildren();
    this.el.style.setProperty('--n', String(n));
    this.el.dataset.variant = geo.variant;
    this.cells = [];
    const diag = new Set(geo.units.filter((u) => u.kind === 'diag').flatMap((u) => u.cells));
    const cageHead = new Map(geo.cages.map((c) => [Math.min(...c.cells), c.sum]));
    for (let r = 0; r < n; r++) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.className = 'brow';
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.i = String(i);
        b.setAttribute('role', 'gridcell');
        b.tabIndex = -1;
        if (c % boxW === boxW - 1 && c < n - 1) b.classList.add('br');
        if (r % boxH === boxH - 1 && r < n - 1) b.classList.add('bb');
        if ((Math.floor(r / boxH) + Math.floor(c / boxW)) % 2 === 1 && geo.variant !== 'killer') b.classList.add('alt');
        if (diag.has(i)) b.classList.add('diag');
        const k = geo.cageOf[i];
        if (k >= 0) {
          // Dashed cage edges on the sides that border another cage.
          const same = (j: number) => j >= 0 && j < geo.size && geo.cageOf[j] === k;
          const edges = [!same(i - n) && 'et', !(c < n - 1 && same(i + 1)) && 'er', !same(i + n) && 'eb', !(c > 0 && same(i - 1)) && 'el'].filter(Boolean).join(' ');
          const cage = document.createElement('span');
          cage.className = `cage ${edges}`;
          cage.setAttribute('aria-hidden', 'true');
          b.append(cage);
          const sum = cageHead.get(i);
          if (sum !== undefined) { const s = document.createElement('span'); s.className = 'sum'; s.textContent = String(sum); b.append(s); }
        }
        const body = document.createElement('span');
        body.className = 'body';
        b.append(body);
        b.addEventListener('click', (e) => this.onCell(i, e));
        this.cells.push(b);
        row.append(b);
      }
      this.el.append(row);
    }
  }

  draw(m: BoardModel) {
    const { geo } = this;
    const sel = m.selected, selVal = sel >= 0 ? m.values[sel] : 0;
    const peers = new Set(m.guides && sel >= 0 ? geo.peers[sel] : []);
    const mk = m.marks ?? {};
    const digits = Array.from({ length: geo.n }, (_, k) => k + 1);
    for (let i = 0; i < geo.size; i++) {
      const b = this.cells[i], v = m.values[i];
      const cls = b.classList;
      cls.toggle('given', v > 0 && m.givens[i]);
      cls.toggle('entered', v > 0 && !m.givens[i]);
      cls.toggle('sel', i === sel);
      cls.toggle('peer', peers.has(i));
      cls.toggle('same', m.guides && selVal > 0 && v === selVal && i !== sel);
      cls.toggle('conflict', m.conflicts.has(i));
      cls.toggle('pattern', !!mk.pattern?.has(i));
      cls.toggle('area', !!mk.area?.has(i));
      cls.toggle('wrong', !!mk.wrong?.has(i));
      b.tabIndex = i === Math.max(0, sel) ? 0 : -1;
      const ghost = mk.place?.get(i);
      const strike = mk.strike?.get(i) ?? 0;
      let html: string;
      let label = `${cellName(i, geo.n).replace('r', 'Row ').replace('c', ', column ')}: `;
      if (v) { html = `<span class="v">${v}</span>`; label += `${v}${m.givens[i] ? ' (given)' : ''}`; }
      else if (ghost) { html = `<span class="v ghost">${ghost}</span>`; label += `empty, hint: ${ghost}`; }
      else {
        const n = m.notes(i) | strike;
        if (n) {
          html = `<span class="notes" style="--nc:${geo.boxW};--nr:${geo.boxH}">` + digits.map((d) => {
            if (!(n & bit(d))) return '<i></i>';
            const c = strike & bit(d) ? ' class="x"' : mk.focus === d || (selVal === d && m.guides) ? ' class="f"' : '';
            return `<i${c}>${d}</i>`;
          }).join('') + '</span>';
          label += `empty, notes ${digitsOf(n).join(' ')}`;
        } else { html = ''; label += 'empty'; }
      }
      const body = b.querySelector<HTMLElement>('.body')!;
      if (body.dataset.html !== html) { body.innerHTML = html; body.dataset.html = html; }
      const k = geo.cageOf[i];
      if (k >= 0) label += `, in a cage adding up to ${geo.cages[k].sum}`;
      if (m.conflicts.has(i)) label += ', breaks a rule';
      if (mk.wrong?.has(i)) label += ', wrong';
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-selected', String(i === sel));
    }
  }
}
