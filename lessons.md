# Lessons

Rules learned building Sudoku Solver. Read them before changing the solvers, the generator or the layout. Cube Solver's `lessons.md` has the packaging lessons (Tauri, disk space, icons); they all apply here too.

## Solvers and generator

- **Test soundness against the real answer, not against expectations.** The logic test replays every step of 170 puzzles and checks each placement equals the unique solution and no elimination removes it. That catches a wrong technique immediately, whatever puzzle exposes it.
- **Measure the level distribution before promising difficulty levels.** Symmetric digging gives roughly 82% Easy, 12% Medium, 0.5% Hard and 5% Expert (XY-Wing turns up more often than triples or X-Wings once singles stall). Hard is the rarest, which is why the generator has a seed fallback.
- **Puzzle symmetries keep the rating.** Relabelling digits, shuffling rows within a band, bands, columns within a stack, stacks, and transposing never change which techniques are needed, so one rated seed gives millions of puzzles.
- **Swordfish is rare.** Random Expert puzzles almost never need it, because XY-Wing is tried first. The bundled seeds include three puzzles that do, so the test that every technique appears stays honest.
- **Hints must start from the player's board, not the start.** The hint engine works from automatic candidates minus everything already ruled out (`elims`), and checks the player's digits against the answer first, or it would explain steps from a board that is not on screen.

## UI

- **Shared board view, separate selectors.** Board styles live on `.board` and only sizing on `#board`, or the lesson mini boards render at zero size.
- **Neubrutalism's hard button shadow is a `button` rule.** The 81 cells and the history/step chips are buttons too; give them explicit overrides.
- **Labels that change text change width.** "Hint" becomes "Do it": give it a min-width, or the buttons after it move.
- **`page.goto` to the same URL with a new hash does not reload.** Listen for `hashchange` so pasted share links open in a running app.
