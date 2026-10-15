# Sudoku Solver — Build Plan

The third app in the puzzle suite, after `ccharafeddine/cube-solver` and `ccharafeddine/chess-solver`, built to the same standard and reusing Cube Solver's patterns (copied and adapted, not shared as a package).

Repo: `ccharafeddine/sudoku-solver`. Commits as `ccharafeddine` (noreply address). No cloud agents.

## 1. What the suite sets as the bar, and how this app meets it

| Area | Cube Solver | Sudoku Solver |
|---|---|---|
| Stack | TypeScript (strict), Vite 8, plain DOM, Web Worker solver, Tauri 2, PWA | Same. No 3D, so no three.js; the grid is 81 buttons in a CSS grid |
| Engine | Two-phase, optimal IDA*, methods, in a worker | Bitmask DFS solver (unique / multiple / none), human-style logical solver (11 techniques), rating, generator, all in a worker |
| Domain depth | Notation, import/export, solvability reasons, history, method steps | 81-char and pretty-grid import/export, share links with progress, conflict and dead-square reasons, history timeline, explained steps |
| Look | Four skins × light/dark, crafted corners, Bungee title, gear Settings, readable selects | Same token sheet and tests, copied; System is the default mode |
| Layout | Wide, no-shift: scrollbar gutter, fixed panel heights, pinned controls | Same rules, with layout tests |
| Learning | Notation lessons + quiz, spotlight tour | Eight Sudoku lessons (rules to X-Wing) on their own mini boards, spotlight tour |
| Hosting | `wrangler.jsonc` (no routes), SITE_URL og plugin | Same |
| Desktop | Tauri 2 NSIS (per-user) + MSI, update check only on desktop | Same |
| Quality | Vitest, ESLint, CI, tag-triggered release | Same |

## 2. Decisions

- **Puzzle model:** a flat array of 81 digits (0 = empty) and 9-bit candidate masks. Pure functions in `src/sudoku`, tests next to each module.
- **Instant solver:** DFS with minimum-remaining-values and bitmask row/column/box sets, counting to 2. DLX was considered; for 9x9 the bitmask search is simpler, smaller and already sub-millisecond.
- **Human-style solver:** techniques tried easiest first; each returns a `Step` (technique, pattern cells, units, digits, placement or eliminations, plain-words text). Difficulty = level of the hardest technique needed; "Fiendish" when the set runs out.
- **Generator:** dig symmetric pairs from a random full grid while unique and not harder than asked; keep if the rating matches. Time budget 1.5 s, then a bundled rated seed under a random symmetry (techniques are invariant under relabelling, band/stack and row/column-within-band shuffles and transposition).
- **History:** full snapshots (values, givens, notes, ruled-out marks) per action, so jumping either way is O(1). Hints and playback steps are ordinary entries, so undo and the timeline walk them.
- **Auto notes vs. manual notes:** separate. Auto notes show `allowed & ~ruledOut`; crossing out an auto note adds it to `ruledOut`, which hints use too.
- **Mistakes:** not revealed while typing (only rule clashes are red). Hint and Check reveal wrong digits.
- **Default mode:** System (follows the OS live). Default skin: Matte.

## 3. Status

All of the above is built and tested; see `progress.txt`.

## 4. Backlog / for the owner to decide

- **Variants:** 4x4 and 6x6 (kids), 16x16, Killer, Diagonal (X), Jigsaw. The board model assumes 9x9 with 3x3 boxes; 4x4/6x6/16x16 would need a size parameter through board, solver, logic and UI. Killer needs cage input and cage techniques.
- **More techniques:** X-Chains, Simple colouring, Unique rectangles, Jellyfish, WXYZ-Wing, so a "Fiendish" level could be generated rather than only rated.
- **Daily puzzle** (seeded by date) and personal best times per level.
- **Print / PDF** export.
