# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Vanilla HTML/CSS/JS Tetris. No `package.json`, build step, linter or tests.

- Run: open `index.html` directly, or serve statically with `python -m http.server 8000` and visit http://localhost:8000.

## Architecture

All game logic lives in `game.js`, a single `'use strict'` script loaded by `index.html` (no modules; everything is global scope).

- **Board / pieces**: `board` is a `ROWS × COLS` matrix holding `0` (empty) or a color index 1–7. `PIECES` and `COLORS` are indexed identically (index 0 is `null`), so a cell value doubles as piece type and color.
- **Piece lifecycle**: `loop` (rAF, accumulates `dropAccum` against `dropInterval`) → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` promotes `next` to `current`, and calls `endGame` if the new piece already collides. `softDrop` and `hardDrop` also end in `lockPiece`.
- **State**: mutable globals are declared on one line (`let board, current, next, ...`) and fully reset in `init()`, which the restart button re-calls. `init()` cancels any previous rAF before starting a new loop.
- **Pause**: `P` or `Escape` call `togglePause`, which cancels/restarts the rAF loop itself (resetting `lastTime`) and shows/hides the pause menu (`#pause-menu` inside `#overlay`: resume, restart, controls view, start-level select); the `keydown` handler ignores game input while `paused` or `gameOver`. `startLevel` (menu select, 1–15) is applied by `init()`.
- **Rotation**: `rotateCW` (transpose + reverse) plus wall kicks `[0, -1, 1, -2, 2]` in `tryRotate`; no kick table per piece.
- **Scoring / speed**: soft drop +1 per cell, hard drop +2 per cell, line clears use `LINE_SCORES[n] * level`. Level = `startLevel + floor(lines / 10)`; `dropInterval = intervalForLevel(level)` = `max(100, 1000 − (level−1)·90)`, used by both `init()` and `clearLines()`.

- **Theme**: colors live as CSS variables in `style.css` (`:root` = dark, `[data-theme="light"]` = light). `applyTheme` in `game.js` sets `data-theme`, caches `--grid` into `gridColor` (used by `drawGrid`) and persists to `localStorage`. New colors should use variables, not hardcoded values.

## Gotchas

- Canvas dimensions are hardcoded in `index.html` (`#board` 300×600, `#next-canvas` 120×120). If you change `COLS`, `ROWS` or `BLOCK`, update the canvas `width`/`height` to `COLS*BLOCK` × `ROWS*BLOCK`. `drawNext` assumes a 4×4 grid at 30px per cell.
- User-facing text (HTML, overlay strings in `game.js`) and the README are in Spanish; keep that language.
