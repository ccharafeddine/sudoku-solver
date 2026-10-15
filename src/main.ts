import './style.css';
import { keepInView } from './ui/scroll';
import { BoardView, type Marks } from './ui/board';
import { allowed, bit, candidates, cellName, conflicts, filledCount, gridString, isComplete, prettyGrid, UNITS, type Grid } from './sudoku/board';
import { LEVEL_LABELS, LEVELS, nextStep, TECH, type Level, type Rating, type Step } from './sudoku/logic';
import type { Request, Response } from './sudoku/protocol';
import type { SolveResult } from './sudoku/solver';
import { History, blankSnap, cloneSnap, type Snapshot } from './app/history';
import { fromHash, importText, shareUrl } from './app/share';
import { Timer, formatTime, stepDelay } from './app/timer';
import { checkForUpdate, updatesEnabled } from './app/update';
import { Tutorial } from './tutorial/tutorial';
import { pickSkin, resolveTheme, modeFor, SKINS, SKIN_LABELS, SKIN_MODES, type SkinId } from './theme/skins';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- error boundary ----------
// Any uncaught error shows a banner with a way out instead of a silently dead page.
function showError(msg: string) {
  const el = $('error-banner');
  el.innerHTML = '';
  el.append(`Something went wrong: ${msg} `);
  const reload = document.createElement('button');
  reload.textContent = 'Reload';
  reload.onclick = () => location.reload();
  const dismiss = document.createElement('button');
  dismiss.textContent = 'Dismiss';
  dismiss.onclick = () => el.classList.add('hidden');
  el.append(reload, dismiss);
  el.classList.remove('hidden');
}
window.addEventListener('error', (e) => showError(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', (e) => showError(String((e.reason as Error)?.message ?? e.reason)));

// ---------- settings ----------
interface Settings { level: Level; speed: number; autoNotes: boolean; guides: boolean; clean: boolean }
const SETTINGS_KEY = 'sudoku-solver-settings', GAME_KEY = 'sudoku-solver-game';
const saved: Partial<Settings> = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); } catch { return {}; } })();
const settings: Settings = {
  level: LEVELS.includes(saved.level as Level) ? saved.level! : 'easy',
  speed: typeof saved.speed === 'number' ? saved.speed : 45,
  autoNotes: saved.autoNotes === true,
  guides: saved.guides !== false,
  clean: saved.clean !== false,
};
const persist = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

// ---------- worker ----------
// All searching happens off the main thread. If the worker ever dies, the next request starts a fresh one.
let worker: Worker | null = null;
let reqId = 0;
const pending = new Map<number, (r: Response) => void>();
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./sudoku/worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<Response>) => { const f = pending.get(e.data.id); pending.delete(e.data.id); f?.(e.data); };
  worker.onerror = (e) => { e.preventDefault(); worker?.terminate(); worker = null; for (const [, f] of pending) f({ id: -1, kind: 'error', message: 'The solver stopped; trying again will restart it.' }); pending.clear(); };
  return worker;
}
type Body = Request extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;
function ask(body: Body): Promise<Response> {
  const id = ++reqId;
  return new Promise((res) => { pending.set(id, res); getWorker().postMessage({ ...body, id } as Request); });
}

// ---------- state ----------
let snap: Snapshot = blankSnap();
const history = new History(snap, 'Start');
let selected = 40;
let pencil = false;
let paint = false;
let brush = 0;
let editing = false;
/** The answer for the current givens, once the worker has found it (null while unknown or if there is none or many). */
let solution: Grid | null = null;
let solveInfo: SolveResult | null = null;
let rating: Rating | null = null;
let solvedAt: number | null = null;
/** True when the solver (not the player) filled the grid, so no time is celebrated. */
let usedSolve = false;
/** A hint being shown, waiting for a second press to apply it. */
let hint: Step | null = null;
let marks: Marks | undefined;
let wrongCells = new Set<number>();
const timer = new Timer();

// Steps playback: steps computed from the history entry at `stepsBase`; entries after it are those steps, in order.
let steps: Step[] = [];
let stepsBase = -1;
let stepsApplied = 0;
let playing = false;
let playTimer = 0;

const board = new BoardView($('board'), 'Sudoku grid. Use the arrow keys to move and 1 to 9 to fill a square.');
const givensGrid = () => snap.values.map((v, i) => (snap.givens[i] ? v : 0));
const notesOf = (i: number) => (snap.values[i] ? 0 : settings.autoNotes ? allowed(snap.values, i) & ~snap.elims[i] : snap.notes[i]);
/** Pencil marks the hint engine works from: automatic marks minus anything ruled out so far. */
const hintCands = () => candidates(snap.values).map((m, i) => m & ~snap.elims[i]);

function status(text: string, kind: '' | 'ok' | 'bad' | 'thinking' = '') {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${kind}`;
}

// ---------- rendering ----------
const padButtons: HTMLButtonElement[] = [];
for (let d = 1; d <= 9; d++) {
  const b = document.createElement('button');
  b.dataset.d = String(d);
  b.innerHTML = `${d}<small></small>`;
  b.onclick = () => digitInput(d, false);
  padButtons.push(b);
  $('pad').append(b);
}

function render() {
  const bad = conflicts(snap.values);
  board.draw({ values: snap.values, givens: snap.givens, notes: notesOf, selected, conflicts: bad, guides: settings.guides, marks: wrongCells.size ? { ...(marks ?? {}), wrong: wrongCells } : marks });
  // Digit pad: how many of each digit are still missing.
  const count = new Array(10).fill(0);
  for (const v of snap.values) count[v]++;
  padButtons.forEach((b, k) => {
    const left = 9 - count[k + 1];
    b.querySelector('small')!.textContent = left > 0 ? String(left) : '';
    b.classList.toggle('done', left <= 0);
    b.classList.toggle('brush', paint && brush === k + 1);
    b.setAttribute('aria-label', `${k + 1}${left > 0 ? `, ${left} left` : ', all placed'}`);
    b.setAttribute('aria-pressed', String(paint && brush === k + 1));
  });
  $<HTMLInputElement>('pencil').checked = pencil;
  $<HTMLInputElement>('paint').checked = paint;
  $<HTMLInputElement>('auto-notes').checked = settings.autoNotes;
  $<HTMLButtonElement>('undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('redo').disabled = !history.canRedo;
  $('edit').setAttribute('aria-pressed', String(editing));
  $('edit').textContent = editing ? 'Done editing' : 'Edit puzzle';
  const ready = !editing && !!solution;
  $<HTMLButtonElement>('hint').disabled = editing || isComplete(snap.values);
  $<HTMLButtonElement>('hint').textContent = hint ? 'Do it' : 'Hint';
  $<HTMLButtonElement>('check').disabled = !ready;
  $<HTMLButtonElement>('solve').disabled = !ready || isComplete(snap.values);
  $<HTMLButtonElement>('restart').disabled = editing;
  $('rating').textContent = editing ? 'Editing' : rating ? ratingText(rating) : '';
  renderHistory();
  renderSteps();
}

function ratingText(r: Rating): string {
  if (r.level === 'beyond') return 'Fiendish: needs guessing';
  return `${LEVEL_LABELS[r.level]}${r.hardest ? ` · up to ${TECH[r.hardest].name}` : ''}`;
}

/** History list: rebuilt only when entries change, otherwise just restyled. */
let histShown = '';
function renderHistory() {
  const box = $('history');
  const key = history.list.map((e) => e.label).join('\u0001');
  if (key !== histShown) {
    histShown = key;
    box.replaceChildren(...history.list.map((e, k) => {
      const b = document.createElement('button');
      b.textContent = e.label;
      b.title = k === 0 ? 'Jump back to the start' : `Jump to after: ${e.label}`;
      b.onclick = () => jumpHistory(k);
      return b;
    }));
  }
  const bs = box.children;
  for (let k = 0; k < bs.length; k++) { bs[k].classList.toggle('now', k === history.index); bs[k].classList.toggle('later', k > history.index); }
  keepInView(box, bs[history.index]);
  $('hist-count').textContent = `${history.index} of ${history.length - 1}`;
}

/** Where the steps playback stands, or -1 if the board has moved away from it. */
function stepsPos(): number {
  if (stepsBase < 0) return -1;
  const p = history.index - stepsBase;
  return p >= 0 && p <= stepsApplied ? p : -1;
}

let stepsShown: Step[] | null = null;
function renderSteps() {
  const list = $('steps');
  const pos = stepsPos();
  if (stepsShown !== steps) {
    stepsShown = steps;
    list.replaceChildren(...steps.map((s, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<span class="n">${k + 1}</span><span>${stepLabel(s)}</span>`;
      b.onclick = () => { stopPlay(); goToStep(k); };
      li.append(b);
      return li;
    }));
  }
  [...list.querySelectorAll('button')].forEach((b, k) => { b.classList.toggle('done', pos >= 0 && k < pos); b.classList.toggle('next', pos >= 0 && k === pos); });
  if (pos >= 0) keepInView(list, list.children[Math.min(pos, steps.length - 1)]);
  const live = pos >= 0 && steps.length > 0;
  $('steps-count').textContent = live ? `${pos} of ${steps.length}` : '';
  $<HTMLButtonElement>('steps-start').disabled = !live || pos === 0;
  $<HTMLButtonElement>('steps-back').disabled = !live || pos === 0;
  $<HTMLButtonElement>('steps-fwd').disabled = editing;
  $<HTMLButtonElement>('play').disabled = editing || isComplete(snap.values);
  $('play').textContent = playing ? '❚❚ Pause' : '▶ Play';
}

function stepLabel(s: Step): string {
  const t = TECH[s.technique].name;
  if (s.place) return `${t}: ${cellName(s.place.cell)} = ${s.place.digit}`;
  const ds = [...new Set(s.eliminate.map((e) => e.digit))].join(', ');
  return `${t}: rules out ${ds}`;
}

/** Outline a step's pattern, shade its groups and show what it changes. */
function marksFor(s: Step): Marks {
  const area = new Set<number>(s.units.flatMap((u) => UNITS[u]));
  const strike = new Map<number, number>();
  for (const e of s.eliminate) strike.set(e.cell, (strike.get(e.cell) ?? 0) | bit(e.digit));
  return { pattern: new Set(s.cells), area, strike, place: s.place ? new Map([[s.place.cell, s.place.digit]]) : undefined, focus: s.digits.length === 1 ? s.digits[0] : undefined };
}

function showStepText(s: Step | null, extra = '') {
  const el = $('step-text');
  if (!s) { el.textContent = extra; return; }
  el.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = `${TECH[s.technique].name}. `;
  el.append(b, s.text, extra ? ` ${extra}` : '');
}

// ---------- changes ----------
function commit(label: string, fromSteps = false) {
  if (!history.push(snap, label)) return;
  if (!fromSteps) { steps = []; stepsBase = -1; stepsApplied = 0; stopPlay(); }
  hint = null; marks = undefined; wrongCells.clear();
  afterChange();
}

function afterChange() {
  save();
  if (!editing && filledCount(snap.values) === 81 && isComplete(snap.values)) {
    if (solvedAt === null) {
      timer.pause();
      solvedAt = timer.ms;
      status(usedSolve ? 'Solved by the solver. Try a new puzzle and see if you can do it yourself!' : `🎉 You solved it in ${formatTime(solvedAt)}! Great job.`, 'ok');
    }
  } else if (!editing && solvedAt === null && filledCount(snap.values) > 0) timer.start();
  render();
}

function setDigit(i: number, d: number) {
  if (snap.givens[i] && !editing) { status('That digit is part of the puzzle, so it can\'t change. Pick an empty square.', 'bad'); return; }
  const before = snap.values[i];
  if (before === d) return;
  snap.values[i] = d;
  if (editing) snap.givens[i] = d > 0;
  if (d) {
    snap.notes[i] = 0;
    if (settings.clean) for (const u of [Math.floor(i / 9), 9 + (i % 9), 18 + Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)]) for (const j of UNITS[u]) snap.notes[j] &= ~bit(d);
  }
  if (!editing && d && solution && solution[i] !== d) { /* no instant spoiler: Check reveals mistakes */ }
  commit(d ? `${cellName(i)} = ${d}` : `Erase ${cellName(i)}`);
  if (!editing && conflicts(snap.values).has(i)) status(`${d} is already in that square's row, column or box. Clashing squares are red.`, 'bad');
  else if (solvedAt === null && !editing) status(statusLine());
}

function toggleNote(i: number, d: number) {
  if (snap.values[i]) { status('That square already has a digit. Erase it first to write notes.', ''); return; }
  if (settings.autoNotes) snap.elims[i] ^= bit(d); else snap.notes[i] ^= bit(d);
  commit(`Note ${d} in ${cellName(i)}`);
}

function digitInput(d: number, asNote: boolean) {
  if (paint) { brush = brush === d ? 0 : d; status(brush ? `Painting ${d}${pencil ? ' notes' : ''}: click squares to fill them. Press Esc to stop.` : 'Pick a digit to paint with.'); render(); return; }
  if (selected < 0) { status('Pick a square first.'); return; }
  if (asNote || (pencil && !editing)) toggleNote(selected, d); else setDigit(selected, snap.values[selected] === d && !editing ? 0 : d);
}

function erase() {
  if (selected < 0) return;
  if (snap.values[selected]) setDigit(selected, 0);
  else if (snap.notes[selected] || snap.elims[selected]) { snap.notes[selected] = 0; commit(`Clear notes in ${cellName(selected)}`); }
}

board.onCell = (i, e) => {
  selected = i;
  if (paint && brush) {
    if (pencil || e.shiftKey) toggleNote(i, brush);
    else if (!snap.givens[i] || editing) setDigit(i, snap.values[i] === brush ? 0 : brush);
  }
  board.cells[i].focus({ preventScroll: true });
  render();
};

function jumpHistory(k: number) {
  stopPlay();
  snap = history.jump(k);
  hint = null; marks = undefined; wrongCells.clear();
  const pos = stepsPos();
  if (pos >= 0 && pos < steps.length) { marks = marksFor(steps[pos]); showStepText(steps[pos]); }
  afterChange();
}
const undo = () => { if (history.canUndo) jumpHistory(history.index - 1); };
const redo = () => { if (history.canRedo) jumpHistory(history.index + 1); };

// ---------- loading puzzles ----------
function loadPuzzle(givens: Grid, label: string, entered?: Grid | null, keepTime = 0) {
  stopPlay();
  snap = blankSnap();
  snap.values = givens.map((v, i) => v || entered?.[i] || 0);
  snap.givens = givens.map((v) => v > 0);
  history.reset(snap, label);
  steps = []; stepsBase = -1; stepsApplied = 0; hint = null; marks = undefined; wrongCells.clear();
  solution = null; solveInfo = null; rating = null; solvedAt = null; usedSolve = false;
  timer.reset(keepTime);
  showStepText(null, 'Press Play to watch the whole puzzle solved one trick at a time, or › to take one step. Each step says which trick it uses and why it works.');
  editing = false;
  selected = givens.findIndex((v) => !v);
  if (filledCount(givens) === 0) { startEditing(); return; }
  analyse();
  afterChange();
}

/** Ask the worker whether the givens have one answer, and how hard they are. */
function analyse() {
  const g = givensGrid();
  status('Checking the puzzle…', 'thinking');
  void ask({ kind: 'solve', grid: g }).then((r) => {
    if (r.kind !== 'solve' || gridString(g) !== gridString(givensGrid())) return;
    solveInfo = r.result;
    solution = r.result.kind === 'unique' ? r.result.solution : null;
    if (r.result.kind === 'none') status(`This puzzle can't be solved. ${r.result.reason}`, 'bad');
    else if (r.result.kind === 'multiple') status('This puzzle has more than one answer, so the solver can\'t pick one. Add more digits with Edit puzzle.', 'bad');
    else if (solvedAt === null) status(statusLine());
    render();
  });
  void ask({ kind: 'rate', grid: g }).then((r) => { if (r.kind === 'rate' && gridString(g) === gridString(givensGrid())) { rating = r.rating; render(); } });
}

function statusLine(): string {
  const left = 81 - filledCount(snap.values);
  return `${left} square${left === 1 ? '' : 's'} to go. Pick a square and type a digit, or press Hint.`;
}

async function newPuzzle() {
  stopPlay();
  const level = settings.level;
  status(`Making a ${LEVEL_LABELS[level]} puzzle…`, 'thinking');
  $<HTMLButtonElement>('new').disabled = true;
  const r = await ask({ kind: 'generate', level });
  $<HTMLButtonElement>('new').disabled = false;
  if (r.kind !== 'generate') { status(`Couldn't make a puzzle: ${r.kind === 'error' ? r.message : 'unknown error'}`, 'bad'); return; }
  loadPuzzle(r.puzzle, `New ${LEVEL_LABELS[level]} puzzle`);
}

function startEditing() {
  stopPlay();
  editing = true;
  timer.pause();
  steps = []; stepsBase = -1; hint = null; marks = undefined;
  // Editing starts from just the givens.
  snap.values = givensGrid();
  history.reset(snap, 'Edit puzzle');
  status('Type in the puzzle\'s digits. Press Done editing when it matches your puzzle.', 'thinking');
  if (selected < 0) selected = 0;
  afterChange();
}
function finishEditing() {
  editing = false;
  const g = snap.values.slice();
  if (filledCount(g) < 17) { editing = true; status('A Sudoku needs at least 17 digits to have just one answer. Add some more.', 'bad'); render(); return; }
  loadPuzzle(g, 'Your puzzle');
}

// ---------- help: hints, check, solve, steps ----------
function mistakes(): number[] {
  if (!solution) return [];
  return snap.values.map((v, i) => (v && !snap.givens[i] && v !== solution![i] ? i : -1)).filter((i) => i >= 0);
}

function doHint() {
  if (editing) return;
  if (hint) { applyHint(hint, `Hint: ${stepLabel(hint)}`); return; }
  if (conflicts(snap.values).size) { status('Fix the red squares first: a digit is in the same row, column or box twice.', 'bad'); return; }
  const wrong = mistakes();
  if (wrong.length) {
    wrongCells = new Set(wrong);
    status(`${wrong.length === 1 ? 'One digit doesn\'t' : `${wrong.length} digits don't`} match the answer: ${wrong.map(cellName).join(', ')}. Erase ${wrong.length === 1 ? 'it' : 'them'} and try again.`, 'bad');
    render();
    return;
  }
  const s = nextStep(snap.values.slice(), hintCands());
  if (!s) {
    status('No step a person would spot comes next. This puzzle needs guessing (trial and error) here. Press Solve to see the answer.', 'bad');
    return;
  }
  hint = s;
  marks = marksFor(s);
  if (s.place) selected = s.place.cell;
  showStepText(s, 'Press Do it (or H again) to make this step.');
  status(`Hint: ${TECH[s.technique].name}. ${TECH[s.technique].blurb}`);
  render();
}

function applyHint(s: Step, label: string, fromSteps = false) {
  if (s.place) { snap.values[s.place.cell] = s.place.digit; snap.notes[s.place.cell] = 0; if (settings.clean) for (let j = 0; j < 81; j++) if (!snap.values[j] && !(allowed(snap.values, j) & bit(s.place.digit))) snap.notes[j] &= ~bit(s.place.digit); }
  for (const e of s.eliminate) { snap.elims[e.cell] |= bit(e.digit); snap.notes[e.cell] &= ~bit(e.digit); }
  commit(label, fromSteps);
  if (solvedAt === null) status(fromSteps ? `Step: ${stepLabel(s)}` : `Done: ${stepLabel(s)}. ${statusLine()}`);
}

function doCheck() {
  if (!solution) return;
  const wrong = mistakes();
  wrongCells = new Set(wrong);
  const left = 81 - filledCount(snap.values);
  status(wrong.length ? `${wrong.length} digit${wrong.length === 1 ? ' is' : 's are'} wrong (marked red).` : `Everything so far is right! ${left ? `${left} to go.` : ''}`, wrong.length ? 'bad' : 'ok');
  render();
  setTimeout(() => { wrongCells.clear(); render(); }, 4000);
}

function doSolve() {
  if (!solution) {
    status(solveInfo?.kind === 'multiple' ? 'This puzzle has more than one answer.' : 'This puzzle has no answer.', 'bad');
    return;
  }
  usedSolve = true;
  snap.values = solution.slice();
  commit('Solved by the solver');
}

/** Work out every step from here (in the worker) and get ready to play them. */
async function computeSteps(): Promise<boolean> {
  if (editing) return false;
  if (conflicts(snap.values).size || mistakes().length) { doHint(); return false; }
  status('Working out the steps…', 'thinking');
  const r = await ask({ kind: 'steps', grid: snap.values.slice(), cands: hintCands() });
  if (r.kind !== 'steps') return false;
  steps = r.steps; stepsBase = history.index; stepsApplied = 0; stepsShown = null;
  hint = null;
  status(r.solved ? `${steps.length} steps to finish, the human way. Press Play, or click a step.` : `${steps.length} steps, then it needs guessing: press Solve for the rest.`, r.solved ? 'ok' : '');
  if (steps.length) { marks = marksFor(steps[0]); showStepText(steps[0]); }
  render();
  return steps.length > 0;
}

/** Move the board to just before step k (k = steps.length means all done), forwards or backwards. */
function goToStep(k: number) {
  let pos = stepsPos();
  if (pos < 0) return;
  k = Math.max(0, Math.min(steps.length, k));
  // Steps already made are on the timeline: jump along it rather than redo them.
  const known = Math.min(k, stepsApplied);
  if (pos !== known) { history.jump(stepsBase + known); snap = history.current; pos = known; }
  while (pos < k) { applyHint(steps[pos], `Step ${pos + 1}: ${stepLabel(steps[pos])}`, true); pos++; stepsApplied = Math.max(stepsApplied, pos); }
  marks = k < steps.length ? marksFor(steps[k]) : undefined;
  showStepText(k < steps.length ? steps[k] : null, k < steps.length ? '' : 'All done!');
  afterChange();
}

async function stepForward() {
  if (stepsPos() < 0 && !(await computeSteps())) return false;
  const pos = stepsPos();
  if (pos >= steps.length) return false;
  goToStep(pos + 1);
  return stepsPos() < steps.length;
}

function stopPlay() { playing = false; clearTimeout(playTimer); }
async function togglePlay() {
  if (playing) { stopPlay(); render(); return; }
  if (stepsPos() < 0 && !(await computeSteps())) return;
  if (stepsPos() >= steps.length) return;
  playing = true;
  render();
  const tick = async () => {
    if (!playing) return;
    const more = await stepForward();
    if (!more) { stopPlay(); render(); return; }
    // Read the slider every step, so moving it mid-play takes effect at once.
    playTimer = window.setTimeout(tick, stepDelay(settings.speed));
  };
  playTimer = window.setTimeout(tick, Math.min(400, stepDelay(settings.speed)));
}

// ---------- controls ----------
$('erase').onclick = erase;
$<HTMLInputElement>('pencil').onchange = (e) => { pencil = (e.target as HTMLInputElement).checked; render(); };
$<HTMLInputElement>('paint').onchange = (e) => { paint = (e.target as HTMLInputElement).checked; if (!paint) brush = 0; status(paint ? 'Paint is on: pick a digit, then click squares to fill them.' : statusLine()); render(); };
$<HTMLInputElement>('auto-notes').onchange = (e) => { settings.autoNotes = (e.target as HTMLInputElement).checked; persist(); render(); };
$('undo').onclick = undo;
$('redo').onclick = redo;
$('pause').onclick = () => setPaused(true);
$('resume').onclick = () => setPaused(false);
let paused = false;
function setPaused(p: boolean) {
  paused = p;
  $('paused').classList.toggle('hidden', !p);
  $('pause').textContent = p ? 'Resume' : 'Pause';
  $('pause').onclick = () => setPaused(!p);
  if (p) { timer.pause(); stopPlay(); } else if (solvedAt === null && !editing && filledCount(snap.values) > 0) timer.start();
}
const levelSel = $<HTMLSelectElement>('level');
levelSel.value = settings.level;
levelSel.onchange = () => { settings.level = levelSel.value as Level; persist(); };
$('new').onclick = () => void newPuzzle();
$('restart').onclick = () => {
  stopPlay();
  snap.values = givensGrid(); snap.notes.fill(0); snap.elims.fill(0);
  solvedAt = null; usedSolve = false; timer.reset();
  commit('Restart');
  status(statusLine());
};
$('edit').onclick = () => (editing ? finishEditing() : startEditing());
$('hint').onclick = doHint;
$('check').onclick = doCheck;
$('solve').onclick = doSolve;
$('play').onclick = () => void togglePlay();
$('steps-fwd').onclick = () => { stopPlay(); void stepForward(); };
$('steps-back').onclick = () => { stopPlay(); const p = stepsPos(); if (p > 0) goToStep(p - 1); };
$('steps-start').onclick = () => { stopPlay(); if (stepsPos() > 0) goToStep(0); };
const speed = $<HTMLInputElement>('speed');
speed.value = String(settings.speed);
speed.oninput = () => { settings.speed = +speed.value; persist(); };

// Load and share
const ioMsg = (t: string) => { $('io-msg').textContent = t; };
async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); ioMsg(`Copied ${what}.`); } catch { $<HTMLTextAreaElement>('io-text').value = text; ioMsg(`Couldn't reach the clipboard, so the ${what} is in the box above.`); }
}
$('import').onclick = () => {
  const r = importText($<HTMLTextAreaElement>('io-text').value);
  if (!r) { ioMsg('That isn\'t a puzzle: it needs 81 squares (digits, with 0 or . for empty ones).'); return; }
  loadPuzzle(r.givens, 'Loaded puzzle', r.entered);
  ioMsg('Loaded.');
};
$('export').onclick = () => void copy(gridString(givensGrid()), 'puzzle');
$('export-grid').onclick = () => void copy(prettyGrid(snap.values), 'grid');
$('share').onclick = () => void copy(shareUrl(location.href, givensGrid(), snap.values.map((v, i) => (snap.givens[i] ? 0 : v))), 'share link');

// ---------- keyboard ----------
const anyDialogOpen = () => !!document.querySelector('dialog[open]') || tutorial.busy;
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'range'))) return;
  if (tutorial.busy && e.key === 'Escape' && !document.querySelector('dialog[open]')) { tutorial.stopAll(); return; }
  if (anyDialogOpen() || paused) return;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
  if (ctrl) return;
  if (e.altKey) {
    if (e.code === 'KeyN') { e.preventDefault(); void newPuzzle(); }
    else if (e.code === 'KeyE') { e.preventDefault(); $('edit').click(); }
    return;
  }
  // Digits by physical key, so Shift+digit (a note) works on every keyboard layout.
  const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (m) {
    e.preventDefault();
    const d = +m[1];
    if (d === 0) erase(); else digitInput(d, e.shiftKey);
    return;
  }
  const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
  if (move !== undefined) {
    e.preventDefault();
    if (selected < 0) selected = 0;
    else {
      const r = Math.floor(selected / 9), c = selected % 9;
      selected = move === -9 ? ((r + 8) % 9) * 9 + c : move === 9 ? ((r + 1) % 9) * 9 + c : move === -1 ? r * 9 + ((c + 8) % 9) : r * 9 + ((c + 1) % 9);
    }
    board.cells[selected].focus({ preventScroll: true });
    render();
    return;
  }
  switch (k) {
    case 'Backspace': case 'Delete': e.preventDefault(); erase(); break;
    case 'n': case 'N': pencil = !pencil; render(); break;
    case 'p': case 'P': paint = !paint; if (!paint) brush = 0; render(); break;
    case 'h': case 'H': doHint(); break;
    case 'c': case 'C': doCheck(); break;
    case ' ': if (t.tagName !== 'BUTTON' || t.classList.contains('cell')) { e.preventDefault(); void togglePlay(); } break;
    case '[': stopPlay(); $('steps-back').click(); break;
    case ']': stopPlay(); void stepForward(); break;
    case '?': $<HTMLDialogElement>('help-dialog').showModal(); break;
    case 'Escape':
      if (hint || wrongCells.size) { hint = null; marks = undefined; wrongCells.clear(); }
      else if (paint) { paint = false; brush = 0; }
      else selected = -1;
      render();
      break;
  }
});

// ---------- saving and resuming ----------
function save() {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ snap, givensOnly: gridString(givensGrid()), ms: timer.ms, solvedAt, editing }));
  } catch { /* storage full or blocked: the game just won't resume */ }
}
function resume(): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(GAME_KEY) ?? 'null') as { snap: Snapshot; ms: number; solvedAt: number | null; editing: boolean } | null;
    if (!raw?.snap?.values || raw.snap.values.length !== 81) return false;
    const s = cloneSnap({ ...blankSnap(), ...raw.snap });
    const givens = s.values.map((v, i) => (s.givens[i] ? v : 0));
    loadPuzzle(givens, 'Resumed', s.values.map((v, i) => (s.givens[i] ? 0 : v)), raw.ms || 0);
    snap.notes = s.notes; snap.elims = s.elims;
    history.reset(snap, 'Resumed');
    if (raw.editing) startEditing();
    timer.pause();
    afterChange();
    return true;
  } catch { return false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) timer.pause();
  else if (!paused && solvedAt === null && !editing && filledCount(snap.values) > 0) timer.start();
});
setInterval(() => { $('timer').textContent = formatTime(solvedAt ?? timer.ms); }, 250);
window.addEventListener('pagehide', save);

// ---------- dialogs ----------
const helpDialog = $<HTMLDialogElement>('help-dialog');
$('help').onclick = () => helpDialog.showModal();
$('help-close').onclick = () => helpDialog.close();

// ---------- tutorial ----------
const tutorial = new Tutorial({
  onFinish: () => { if (filledCount(snap.values) === 0) void newPuzzle(); },
});
const tutDialog = $<HTMLDialogElement>('tutorial-dialog');
const openTutorial = () => { $('tut-summary').textContent = tutorial.summary(); tutDialog.showModal(); };
const fromMenu = (fn: () => void) => () => { tutDialog.close(); fn(); };
$('tutorial').onclick = openTutorial;
$('tour').onclick = () => { helpDialog.close(); openTutorial(); };
$('tut-lessons').onclick = fromMenu(() => tutorial.startLessons());
$('tut-restart').onclick = fromMenu(() => tutorial.startLessons(0));
$('tut-tour').onclick = fromMenu(() => tutorial.startTour());
$('tut-tour-restart').onclick = fromMenu(() => tutorial.startTour(0));
$('tut-reset').onclick = () => { tutorial.resetProgress(); $('tut-summary').textContent = tutorial.summary(); };
$('tut-close').onclick = () => tutDialog.close();

// ---------- theme and skin ----------
// A skin (matte by default) plus light/dark, which follows the computer (System) until the player picks one.
let skin: SkinId = pickSkin(location.search, localStorage.getItem('sudoku-solver-skin'));
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const savedMode = localStorage.getItem('sudoku-solver-theme');
  const t = modeFor(skin, resolveTheme(savedMode, darkQuery.matches));
  document.documentElement.dataset.skin = skin;
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  const mode = savedMode === 'light' || savedMode === 'dark' ? savedMode : 'system';
  const single = SKIN_MODES[skin].length === 1;
  document.querySelectorAll<HTMLButtonElement>('#theme-skins button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.skin === skin)));
  document.querySelectorAll<HTMLButtonElement>('#theme-modes button').forEach((b) => {
    b.disabled = single;
    b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  });
  $('theme-mode-note').textContent = single ? `${SKIN_LABELS[skin]} has a ${SKIN_MODES[skin][0]} look only.` : mode === 'system' ? `Following your computer: ${t}.` : '';
}
for (const id of SKINS) {
  const b = document.createElement('button');
  b.className = 'skin-card';
  b.dataset.skin = id;
  b.setAttribute('role', 'radio');
  b.innerHTML = `<span class="skin-preview" data-preview="${id}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${SKIN_LABELS[id]}</span>`;
  b.onclick = () => { skin = id; localStorage.setItem('sudoku-solver-skin', id); applyTheme(); };
  $('theme-skins').append(b);
}
document.querySelectorAll<HTMLButtonElement>('#theme-modes button').forEach((b) => {
  b.onclick = () => {
    if (b.dataset.mode === 'system') localStorage.removeItem('sudoku-solver-theme');
    else localStorage.setItem('sudoku-solver-theme', b.dataset.mode!);
    applyTheme();
  };
});
darkQuery.addEventListener('change', applyTheme);
applyTheme();
const guides = $<HTMLInputElement>('opt-guides'), clean = $<HTMLInputElement>('opt-clean');
guides.checked = settings.guides; clean.checked = settings.clean;
guides.onchange = () => { settings.guides = guides.checked; persist(); render(); };
clean.onchange = () => { settings.clean = clean.checked; persist(); };
// Settings: theme, light/dark, play options, updates (desktop only) and About in one dialog.
const settingsDialog = $<HTMLDialogElement>('settings-dialog');
const openSettings = () => settingsDialog.showModal();
$('settings').onclick = openSettings;
$('help-appearance').onclick = () => { helpDialog.close(); openSettings(); };
$('settings-close').onclick = () => settingsDialog.close();
settingsDialog.addEventListener('click', (e) => { if (e.target === settingsDialog) settingsDialog.close(); });
for (const d of [helpDialog, tutDialog]) d.addEventListener('click', (e) => { if (e.target === d) d.close(); });

// ---------- update check (desktop app only) ----------
async function runUpdateCheck(manual: boolean) {
  if (manual) $('update-msg').textContent = 'Checking…';
  const r = await checkForUpdate(__APP_VERSION__);
  const el = $('update-banner');
  if (r.kind === 'available') {
    el.innerHTML = `Sudoku Solver ${r.latest} is out. `;
    const a = document.createElement('a');
    a.href = r.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Download';
    a.onclick = (ev) => { ev.preventDefault(); void openExternal(r.url); };
    el.append(a);
    el.classList.remove('hidden');
    $('update-msg').textContent = `Version ${r.latest} is available.`;
  } else if (manual) {
    $('update-msg').textContent = r.kind === 'current' ? `Up to date (v${__APP_VERSION__}).` : `Could not check: ${r.message}.`;
  }
}
async function openExternal(url: string) {
  if ('__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else window.open(url, '_blank', 'noopener');
}
if (updatesEnabled(window)) {
  $('check-update').onclick = () => void runUpdateCheck(true);
  if (import.meta.env.PROD) setTimeout(() => void runUpdateCheck(false), 3000);
} else {
  // Web/PWA: always the latest version, so no Updates section, banner or check.
  $('updates-section').remove();
  $('update-banner').remove();
  $('settings').setAttribute('aria-label', 'Settings: theme, play options and about');
}
$('version').textContent = `v${__APP_VERSION__}`;

// ---------- start ----------
function openShared(): boolean {
  const shared = fromHash(location.hash);
  if (!shared) return false;
  loadPuzzle(shared.givens, 'Shared puzzle', shared.entered);
  // Drop the hash so a reload resumes the game instead of starting the link over.
  window.history.replaceState(null, '', location.pathname + location.search);
  return true;
}
window.addEventListener('hashchange', openShared);
const shared = openShared();
if (shared) { /* opened from a link */ }
else if (!resume()) void newPuzzle();
render();
// Offer the tutorial on first launch, but not over a shared puzzle.
if (!shared) tutorial.offer($('onboarding'));

// Offline support when served as a PWA (not in dev, not inside Tauri).
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !('__TAURI_INTERNALS__' in window)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
}

// Dev-only handle for browser checks.
if (import.meta.env.DEV) (window as unknown as { __app: object }).__app = { get snap() { return snap; }, get solution() { return solution; }, history };
