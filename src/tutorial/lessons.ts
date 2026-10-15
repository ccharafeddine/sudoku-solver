/**
 * Tutorial content and the pure logic behind it: the rules and technique
 * lessons, the app-tour steps and saved progress. Nothing here touches the
 * DOM, so every lesson's answer is checked by a unit test.
 */
import { BOXES, ROWS, COLS, candidates, makeGeo, parseGrid, type Grid, type Variant } from '../sudoku/board';
import { applyStep, nextStep, type Step, type TechniqueId } from '../sudoku/logic';
import { SEEDS } from '../sudoku/seeds';

/** The solution all the hand-made lesson boards are cut from. */
export const LESSON_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const S = parseGrid(LESSON_SOLUTION)!;
/** Keep only the listed cells of the lesson solution. */
export const keep = (cells: number[]): Grid => S.map((v, i) => (cells.includes(i) ? v : 0));

export type Ask =
  /** Pick the digit for one highlighted square. */
  | { kind: 'digit'; cell: number; answer: number; choices: number[] }
  /** Click the square where something must go. */
  | { kind: 'cell'; answer: number }
  /** A real technique step from a real puzzle: pick which digits it rules out. */
  | { kind: 'technique'; technique: TechniqueId };

export interface Lesson {
  id: string;
  title: string;
  /** What to know, in plain words. */
  body: string;
  /** The question. */
  ask: string;
  /** The board to show (not used by technique lessons, which find their own). */
  grid?: Grid;
  /** Squares to shade as a clue. */
  shade?: number[];
  check: Ask;
  /** Shown after a wrong answer. */
  hint: string;
  /** Puzzle shape of the lesson board (classic when left out). */
  variant?: Variant;
}

const row1 = ROWS[0], box1 = BOXES[0];
export const LESSONS: Lesson[] = [
  { id: 'rows', title: 'The rule: rows',
    body: 'A Sudoku is a 9 by 9 grid. You fill every empty square with a digit from 1 to 9. Rule one: each row (going across) must have every digit from 1 to 9 exactly once. No repeats!',
    ask: 'Row 1 is missing one digit. Which digit goes in the bright square?',
    grid: keep([...row1.filter((i) => i !== 4), 20, 33, 47, 61, 75]), shade: row1,
    check: { kind: 'digit', cell: 4, answer: 7, choices: [4, 7, 9, 2] },
    hint: 'Count 1 to 9 along row 1. Which number is not there yet?' },
  { id: 'cols-boxes', title: 'The rule: columns and boxes',
    body: 'Rule two: each column (going down) has 1 to 9 once. Rule three: each of the nine 3 by 3 boxes, with the thick borders, has 1 to 9 once. Rows, columns and boxes are called groups.',
    ask: 'The top-left box is missing one digit. Which digit goes in the bright square?',
    grid: keep([...box1.filter((i) => i !== 10), 14, 31, 52, 70]), shade: box1,
    check: { kind: 'digit', cell: 10, answer: 7, choices: [7, 3, 6, 5] },
    hint: 'Look only inside the thick-bordered box in the corner. Which of 1 to 9 is missing?' },
  { id: 'naked-single', title: 'Naked single',
    body: 'Often you have to look at a square\'s row, column and box all together. Cross out every digit you can see in them. If only one digit is left, that\'s the answer. This is called a naked single.',
    ask: 'Look at the bright square\'s row, column and box. Which digit is the only one that fits?',
    grid: keep([36, 37, 38, 44, 4, 13, 76, 58]), shade: [...ROWS[4], ...COLS[4]],
    check: { kind: 'digit', cell: 40, answer: 5, choices: [5, 3, 8, 1] },
    hint: 'Row 5 has 4, 2, 6 and 1. Column 5 has 7, 9, 3 and 8. Which digit from 1 to 9 is not used?' },
  { id: 'hidden-single', title: 'Hidden single',
    body: 'Now flip it around: pick a digit and a group, and ask "where can this digit go?" If there is only one place, it must go there. This is called a hidden single.',
    ask: 'Every box needs a 1. Click the only square in the top-left box where a 1 can go.',
    grid: keep([0, 1, 10, 19, 20, 7, 12]), shade: box1,
    check: { kind: 'cell', answer: 18 },
    hint: 'Rows 1 and 2 already have a 1 further along, so the 1 can\'t go in those rows of the box.' },
  { id: 'notes', title: 'Pencil marks',
    body: 'On harder puzzles, write the digits that could still go in each square, small, like pencil notes. Press N (or turn on Notes under Tools) to write notes, or turn on Auto notes and the app keeps them for you. The next lessons use real puzzles with notes shown.',
    ask: 'Which digits could still go in the bright square?',
    grid: keep([0, 1, 10, 19, 20, 7, 12]), shade: [...row1, ...COLS[2], ...box1],
    check: { kind: 'digit', cell: 2, answer: 4, choices: [4, 5, 3, 1] },
    hint: 'Row 1 has 5, 3 and 1; the box also has 7, 9 and 8; so only 2, 4 and 6 are left. Of the choices, only 4 fits.' },
  { id: 'pointing', title: 'Pointing',
    body: 'If, inside one box, a digit can only go in one row (or one column), then that digit is "pointing" along that line. The box\'s digit will be in that line, so the rest of the line can\'t have it.',
    ask: 'The pattern squares are outlined. Which digit gets crossed out of the red-marked squares?',
    check: { kind: 'technique', technique: 'pointing' },
    hint: 'Look at the outlined squares in the box: they all share one digit in their notes.' },
  { id: 'naked-pair', title: 'Naked pair',
    body: 'If two squares in one group can only hold the same two digits, those two digits belong to those two squares. Cross both digits out of every other square in that group.',
    ask: 'Two outlined squares share the same two notes. Which digits get crossed out elsewhere in the group?',
    check: { kind: 'technique', technique: 'naked-pair' },
    hint: 'Read the notes in the two outlined squares: those are the two digits.' },
  { id: 'x-wing', title: 'X-Wing',
    body: 'A tricky one! If a digit fits in exactly two spots in each of two rows, and those spots line up in the same two columns, the digit makes an X shape. Those two columns get their digit from these rows, so it can\'t go anywhere else in those columns.',
    ask: 'Four outlined squares form a rectangle. Which digit gets crossed out?',
    check: { kind: 'technique', technique: 'x-wing' },
    hint: 'The same digit appears in the notes of all four outlined corners.' },
  { id: 'shapes', title: 'Other puzzle shapes',
    body: 'Pick a puzzle type next to the level. Mini 4x4 and 6x6 use digits 1 to 4 or 1 to 6, great for starting out. Diagonal adds a rule: both long diagonals need every digit once too. In Killer, dashed cages show a total: the digits in a cage add up to it, with no repeats.',
    ask: 'This is a Mini 4x4. Which digit goes in the bright square?',
    variant: 'mini4', grid: [1, 2, 3, 0, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], shade: [0, 1, 2, 3],
    check: { kind: 'digit', cell: 3, answer: 4, choices: [4, 1, 2, 3] },
    hint: 'Row 1 already has 1, 2 and 3. A 4x4 only uses 1 to 4.' },
];

/** The board shape for a lesson. */
export const lessonGeo = (l: Lesson) => makeGeo(l.variant ?? 'classic');

/** The first real step of a technique in the bundled puzzles, with the board and pencil marks just before it. */
export function exampleStep(t: TechniqueId): { grid: Grid; cands: number[]; step: Step } | null {
  for (const s of Object.values(SEEDS).flat()) {
    const g = parseGrid(s)!, c = candidates(g);
    for (let st = nextStep(g, c); st; st = nextStep(g, c)) {
      if (st.technique === t) return { grid: g, cands: c, step: st };
      applyStep(g, c, st);
    }
  }
  return null;
}

/** The answer text for a technique lesson, e.g. "3" or "3 and 7". */
export const elimAnswer = (s: Step) => [...new Set(s.eliminate.map((e) => e.digit))].sort().join(' and ');

/** Answer choices for a technique lesson: the right one plus three wrong ones, stable for a given step. */
export function techniqueChoices(s: Step): string[] {
  const right = elimAnswer(s), n = right.split(' and ').length;
  const out = [right];
  for (let d = 1; out.length < 4 && d <= 9; d++) {
    const alt = n === 1 ? String(d) : `${d} and ${(d % 9) + 1}`;
    if (!out.includes(alt) && alt !== right) out.push(alt);
  }
  // Rotate by a fixed amount so the right answer is not always first.
  const k = (s.cells[0] ?? 0) % 4;
  return [...out.slice(k), ...out.slice(0, k)];
}

export function checkDigit(l: Lesson, d: number): boolean { return l.check.kind === 'digit' && l.check.answer === d; }
export function checkCell(l: Lesson, i: number): boolean { return l.check.kind === 'cell' && l.check.answer === i; }

export interface TourStep {
  id: string;
  /** CSS selector of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Wording for touch screens, when it differs. */
  touchBody?: string;
}

export const TOUR: TourStep[] = [
  { id: 'board', target: '#board', title: 'The puzzle',
    body: 'This is the puzzle. Dark digits were there from the start and can\'t change. Click a square to pick it, then type a digit 1 to 9. Squares that break a rule turn red.',
    touchBody: 'This is the puzzle. Dark digits were there from the start and can\'t change. Tap a square to pick it, then tap a digit below. Squares that break a rule turn red.' },
  { id: 'pad', target: '#pad', title: 'Digit buttons',
    body: 'No keyboard? Use these buttons to fill in the square you picked. The small number on each button says how many of that digit are still missing. Erase clears a square.' },
  { id: 'notes', target: '#note-tools', title: 'Tools',
    body: 'Notes (N) writes small reminder digits instead of answers. Auto notes fills in every digit that still fits. Fill many (P) lets you pick a digit once, then click lots of squares to fill them fast.' },
  { id: 'undo', target: '#undo-row', title: 'Undo and timer',
    body: 'Undo (Ctrl+Z) and Redo (Ctrl+Y) step back and forward. The timer counts while you play and stops when you finish. Pause hides the puzzle.' },
  { id: 'puzzle', target: '#puzzle-card', title: 'New puzzles',
    body: 'Pick a puzzle type (Classic, Diagonal, Killer or a small 6x6 or 4x4) and how hard you want it, from Easy to Fiendish, then press New puzzle. Every puzzle has exactly one answer. Edit puzzle lets you type in one from a book or newspaper.' },
  { id: 'hint', target: '#hint', title: 'Hints',
    body: 'Stuck? Hint shows the next step a person would take. It names the trick, like "Hidden single", outlines the squares involved, and explains it in plain words. Press it again to do the step.' },
  { id: 'steps', target: '#steps-card', title: 'Watch it solved',
    body: 'Press Play to watch the puzzle solved the way a person would, one trick at a time. Every step is listed, so you can click any of them to jump there, forwards or back. The speed slider sets how fast.' },
  { id: 'history', target: '#history-card', title: 'Your history',
    body: 'Every move you make is listed here. Click any of them to jump back to that moment, then click a later one to jump forward again.' },
  { id: 'io', target: '#io-card', title: 'Share and load',
    body: 'Paste a puzzle here as 81 digits (use 0 or . for empty squares) and press Load. Or copy a link to share the puzzle, and your progress, with a friend.' },
  { id: 'settings', target: '#settings', title: 'Settings',
    body: 'The gear opens Settings. Pick one of four looks and light, dark or match your computer. The ? button lists every keyboard shortcut.' },
];

export interface Progress { v: 1; offered: boolean; lessonsDone: string[]; lesson: number; tour: number; tourDone: boolean }
export const PROGRESS_KEY = 'sudoku-solver-tutorial';
export const freshProgress = (): Progress => ({ v: 1, offered: false, lessonsDone: [], lesson: 0, tour: 0, tourDone: false });

type KV = Pick<Storage, 'getItem' | 'setItem'>;

/** Read saved progress, tolerating missing, corrupt or out-of-range data. */
export function loadProgress(store: KV): Progress {
  const p = freshProgress();
  let raw: Partial<Progress> = {};
  try { raw = JSON.parse(store.getItem(PROGRESS_KEY) ?? '{}') ?? {}; } catch { /* corrupt: start over */ }
  if (typeof raw !== 'object') return p;
  const ids = new Set(LESSONS.map((l) => l.id));
  const clamp = (x: unknown, max: number) => (Number.isInteger(x) ? Math.max(0, Math.min(max, x as number)) : 0);
  return {
    v: 1,
    offered: raw.offered === true,
    lessonsDone: Array.isArray(raw.lessonsDone) ? raw.lessonsDone.filter((x) => ids.has(x)) : p.lessonsDone,
    lesson: clamp(raw.lesson, LESSONS.length - 1),
    tour: clamp(raw.tour, TOUR.length - 1),
    tourDone: raw.tourDone === true,
  };
}
export const saveProgress = (store: KV, p: Progress) => store.setItem(PROGRESS_KEY, JSON.stringify(p));

export function progressSummary(p: Progress): string {
  const tour = p.tourDone ? 'tour done' : p.tour > 0 ? `tour at step ${p.tour + 1}/${TOUR.length}` : 'tour not started';
  return `${p.lessonsDone.length}/${LESSONS.length} lessons · ${tour}`;
}

export const WELCOME = {
  title: 'Welcome to Sudoku Solver',
  body: 'New to Sudoku? The short lessons teach the rules and the tricks people use, and you try each one yourself. The tour shows what every button does. Both live in the 🎓 Tutorial menu too.',
  learn: 'Learn Sudoku',
  tour: 'Tour the app',
  skip: 'Not now',
};
