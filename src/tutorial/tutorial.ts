/**
 * The interactive tutorial: short Sudoku lessons, each on its own small board
 * inside the coach card (the player's puzzle is never touched), and a
 * spotlight tour of the app. Content and answers live in lessons.ts.
 */
import { UNITS } from '../sudoku/board';
import { BoardView, type Marks } from '../ui/board';
import { SpotlightTour } from './spotlight';
import {
  LESSONS, TOUR, WELCOME, checkCell, checkDigit, elimAnswer, exampleStep, loadProgress, progressSummary, saveProgress, techniqueChoices, type Lesson, type Progress,
} from './lessons';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

export interface TutorialHooks { onFinish(): void }

export class Tutorial {
  progress: Progress;
  private coach: HTMLElement;
  private tour: SpotlightTour;
  private mode: 'off' | 'lesson' | 'tour' = 'off';

  constructor(private hooks: TutorialHooks, private store: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
    this.progress = loadProgress(store);
    this.coach = el('section', { id: 'coach', className: 'coach hidden' });
    this.coach.setAttribute('role', 'dialog');
    this.coach.setAttribute('aria-modal', 'false');
    this.coach.setAttribute('aria-labelledby', 'coach-title');
    document.body.append(this.coach);
    this.tour = new SpotlightTour(TOUR, {
      onStep: (id) => { this.progress.tour = Math.max(0, TOUR.findIndex((t) => t.id === id)); this.save(); },
      onClose: (finished) => {
        if (finished) { this.progress.tourDone = true; this.progress.tour = 0; }
        this.save();
        this.mode = 'off';
      },
    });
  }

  private save() { saveProgress(this.store, this.progress); }
  /** While a lesson or the tour is open, the app's own shortcuts stay quiet. */
  get busy() { return this.mode !== 'off'; }
  summary() { return progressSummary(this.progress); }

  offer(slot: HTMLElement) {
    if (this.progress.offered) return;
    const done = () => { this.progress.offered = true; this.save(); slot.classList.add('hidden'); };
    const learn = el('button', { className: 'primary', textContent: WELCOME.learn });
    learn.onclick = () => { done(); this.startLessons(); };
    const tour = el('button', { textContent: WELCOME.tour });
    tour.onclick = () => { done(); this.startTour(); };
    const skip = el('button', { textContent: WELCOME.skip });
    skip.onclick = done;
    slot.replaceChildren(el('b', { id: 'offer-title' }, WELCOME.title), el('p', {}, WELCOME.body), el('div', { className: 'row' }, skip, tour, learn));
    slot.setAttribute('aria-labelledby', 'offer-title');
    slot.classList.remove('hidden');
    learn.focus();
  }

  startLessons(from = this.progress.lesson) {
    this.stopAll();
    this.mode = 'lesson';
    this.showLesson(Math.max(0, Math.min(from, LESSONS.length - 1)));
  }

  private markDone(l: Lesson) {
    if (!this.progress.lessonsDone.includes(l.id)) this.progress.lessonsDone.push(l.id);
    this.save();
  }

  private showLesson(i: number) {
    this.progress.lesson = i;
    this.save();
    const lesson = LESSONS[i];
    const last = i + 1 === LESSONS.length;
    const feedback = el('p', { className: 'feedback' });
    feedback.setAttribute('aria-live', 'polite');
    const boardEl = el('div');
    const view = new BoardView(boardEl, `Lesson board: ${lesson.title}`);
    const next = el('button', { className: 'primary', textContent: last ? 'Finish' : 'Next lesson', disabled: !this.progress.lessonsDone.includes(lesson.id) });
    next.onclick = () => (last ? this.finish() : this.showLesson(i + 1));
    const right = (msg: string) => { feedback.className = 'feedback good'; feedback.textContent = `✓ ${msg}`; this.markDone(lesson); next.disabled = false; next.focus(); refreshDots(); };
    const wrong = () => { feedback.className = 'feedback bad'; feedback.textContent = `Not quite. ${lesson.hint}`; };

    let values: number[], notes: (k: number) => number = () => 0, marks: Marks = {}, selected = -1;
    const choices = el('div', { className: 'row choices' });
    choices.setAttribute('aria-label', 'Answers');
    const check = lesson.check;
    if (check.kind === 'technique') {
      const ex = exampleStep(check.technique)!;
      values = ex.grid; notes = (k) => ex.cands[k];
      const strike = new Map<number, number>();
      for (const e of ex.step.eliminate) strike.set(e.cell, (strike.get(e.cell) ?? 0) | (1 << (e.digit - 1)));
      // Show which squares lose a mark, but not which mark: that is the question.
      marks = { pattern: new Set(ex.step.cells), area: new Set(ex.step.units.flatMap((u) => UNITS[u])), wrong: new Set(strike.keys()) };
      for (const c of techniqueChoices(ex.step)) {
        const b = el('button', { textContent: c });
        b.onclick = () => (c === elimAnswer(ex.step) ? right(ex.step.text) : wrong());
        choices.append(b);
      }
    } else {
      values = lesson.grid!;
      marks = { area: new Set(lesson.shade ?? []) };
      if (check.kind === 'digit') {
        selected = check.cell;
        for (const d of check.choices) {
          const b = el('button', { textContent: String(d) });
          b.setAttribute('aria-label', `Answer ${d}`);
          b.onclick = () => (checkDigit(lesson, d) ? (right(`Yes, ${d} is the only digit that fits.`), redraw(d)) : wrong());
          choices.append(b);
        }
      } else {
        view.onCell = (k) => {
          if (values[k]) return;
          if (checkCell(lesson, k)) { right('That\'s the only spot left for it in this box.'); redraw(1, k); } else { selected = k; redraw(); wrong(); }
        };
      }
    }
    const redraw = (fill = 0, at = selected) => {
      const v = fill && at >= 0 ? values.map((x, k) => (k === at ? fill : x)) : values;
      view.draw({ values: v, givens: v.map((x) => x > 0), notes, selected, conflicts: new Set(), guides: false, marks });
    };
    redraw();

    const back = el('button', { textContent: 'Back', disabled: i === 0 });
    back.onclick = () => this.showLesson(i - 1);
    const close = el('button', { className: 'icon', textContent: '✕' });
    close.setAttribute('aria-label', 'Close the lessons');
    close.onclick = () => this.stopAll();
    const dots = el('div', { className: 'dots' });
    const refreshDots = () => {
      dots.replaceChildren(...LESSONS.map((l, k) => {
        const d = el('button', { className: 'dot' + (k === i ? ' cur' : '') + (this.progress.lessonsDone.includes(l.id) ? ' done' : '') });
        d.setAttribute('aria-label', `Lesson ${k + 1}: ${l.title}${this.progress.lessonsDone.includes(l.id) ? ' (done)' : ''}`);
        d.onclick = () => this.showLesson(k);
        return d;
      }));
    };
    refreshDots();
    const title = el('h2', { id: 'coach-title', textContent: `${i + 1}. ${lesson.title}` });
    title.tabIndex = -1;
    this.coach.replaceChildren(
      el('div', { className: 'row spread coach-head' }, dots, close),
      title,
      el('p', {}, lesson.body),
      boardEl,
      el('p', { className: 'ask' }, lesson.ask),
      choices,
      feedback,
      el('div', { className: 'row spread' }, back, next),
    );
    this.coach.classList.remove('hidden');
    title.focus({ preventScroll: true });
  }

  private finish() {
    this.stopAll();
    this.hooks.onFinish();
  }

  startTour(from = this.progress.tour) {
    this.stopAll();
    this.mode = 'tour';
    this.tour.start(from);
  }

  stopAll() {
    this.coach.classList.add('hidden');
    if (this.tour.isOpen) this.tour.close(false);
    this.mode = 'off';
  }

  resetProgress() {
    this.progress = { ...loadProgress({ getItem: () => null, setItem: () => {} }), offered: true };
    this.save();
  }
}
