'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const linesBefore = lines;
  clearLines();
  updateCombo(lines > linesBefore);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // endGame ya detuvo el bucle; no volver a armarlo
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  gameMaxCombo = 0;
  hideGameOverRecords();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

let gridColor;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  const light = theme === 'light';
  themeBtn.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-pressed', String(light));
  try { localStorage.setItem('theme', theme); } catch (e) {}
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que el botón capture Space (caída dura)
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

// ---- Tabla de records ----
const MAX_RECORDS = 5;
const DEFAULT_NAME = 'Jugador';
const startOverlay = document.getElementById('start-overlay');
const playBtn = document.getElementById('play-btn');
const startRecordsList = document.getElementById('start-records-list');
const goRecords = document.getElementById('go-records');
const goRecordsList = document.getElementById('go-records-list');
const goRecordMsg = document.getElementById('go-record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');

let combo = 0, gameMaxCombo = 0, started = false;
let pendingEntry = null; // puntuación pendiente de guardar con nombre

function loadRecords() {
  const data = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem('records'));
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.top)) {
        data.top = raw.top
          .filter(e => e && Number.isFinite(e.score))
          .map(e => ({ name: String(e.name ?? DEFAULT_NAME).slice(0, 12), score: e.score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECORDS);
      }
      if (Number.isFinite(raw.bestCombo)) data.bestCombo = raw.bestCombo;
      if (Number.isFinite(raw.maxLines)) data.maxLines = raw.maxLines;
    }
  } catch (e) {}
  return data;
}

function saveRecords(data) {
  try { localStorage.setItem('records', JSON.stringify(data)); } catch (e) {}
}

function qualifiesForTop(top, s) {
  return s > 0 && (top.length < MAX_RECORDS || s > top[top.length - 1].score);
}

// Inserta la entrada (tras las de igual puntuación) y devuelve su posición, o -1 si queda fuera.
function insertRecord(top, entry) {
  let i = top.findIndex(e => e.score < entry.score);
  if (i === -1) i = top.length;
  top.splice(i, 0, entry);
  top.length = Math.min(top.length, MAX_RECORDS);
  return i < MAX_RECORDS ? i : -1;
}

function updateCombo(cleared) {
  combo = cleared ? combo + 1 : 0;
  if (combo > gameMaxCombo) gameMaxCombo = combo;
}

function renderRecords(container, highlight) {
  const data = loadRecords();
  container.textContent = '';
  const ol = document.createElement('ol');
  ol.className = 'records-table';
  for (let i = 0; i < MAX_RECORDS; i++) {
    const li = document.createElement('li');
    const e = data.top[i];
    const name = document.createElement('span');
    const sc = document.createElement('span');
    if (e) {
      name.textContent = `${i + 1}. ${e.name}`;
      sc.textContent = e.score.toLocaleString();
      if (i === highlight) li.className = 'highlight';
    } else {
      name.textContent = `${i + 1}. ---`;
      li.className = 'empty';
    }
    li.append(name, sc);
    ol.appendChild(li);
  }
  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${data.bestCombo} · Líneas máx.: ${data.maxLines}`;
  container.append(ol, stats);
}

function commitPendingEntry() {
  if (!pendingEntry) return -1;
  const name = nameInput.value.trim().slice(0, 12) || DEFAULT_NAME;
  const data = loadRecords();
  const pos = insertRecord(data.top, { name, score: pendingEntry.score });
  saveRecords(data);
  pendingEntry = null;
  return pos;
}

function hideGameOverRecords() {
  commitPendingEntry(); // si se reinicia sin pulsar "Guardar", no se pierde la puntuación
  pendingEntry = null;
  goRecords.classList.add('hidden');
  goRecordMsg.classList.add('hidden');
  nameForm.classList.add('hidden');
}

function showGameOverRecords() {
  const data = loadRecords();
  if (gameMaxCombo > data.bestCombo) data.bestCombo = gameMaxCombo;
  if (lines > data.maxLines) data.maxLines = lines;
  saveRecords(data);
  goRecords.classList.remove('hidden');
  if (qualifiesForTop(data.top, score)) {
    pendingEntry = { score };
    nameInput.value = DEFAULT_NAME;
    goRecordMsg.textContent = '¡Nuevo récord! Escribe tu nombre';
    goRecordMsg.classList.remove('hidden');
    nameForm.classList.remove('hidden');
    renderRecords(goRecordsList, -1);
    nameInput.focus();
    nameInput.select();
  } else {
    renderRecords(goRecordsList, -1);
  }
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingEntry) return;
  const pos = commitPendingEntry();
  nameForm.classList.add('hidden');
  goRecordMsg.textContent = '¡Récord guardado!';
  renderRecords(goRecordsList, pos);
  restartBtn.focus();
});

document.querySelectorAll('.reset-records-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.blur();
    if (!confirm('¿Borrar todos los records?')) return;
    try { localStorage.removeItem('records'); } catch (e) {}
    pendingEntry = null;
    nameForm.classList.add('hidden');
    goRecordMsg.classList.add('hidden');
    renderRecords(startRecordsList, -1);
    renderRecords(goRecordsList, -1);
  });
});

// Antes que el resto de handlers: ignora el teclado en la pantalla de inicio y mientras se escribe el nombre.
document.addEventListener('keydown', e => {
  if (!started || e.target === nameInput) e.stopImmediatePropagation();
}, true);

function startGame() {
  started = true;
  startOverlay.classList.add('hidden');
  playBtn.blur(); // evita que Space re-dispare el botón
  dropAccum = 0;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

playBtn.addEventListener('click', startGame);

// Estado inicial: partida preparada pero detenida hasta pulsar "Jugar".
init();
cancelAnimationFrame(animId);
draw();
renderRecords(startRecordsList, -1);
