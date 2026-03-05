// ======= Config =======
const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // canvas scale (canvas is 300x600)
const BASE_DROP_MS = 700;

// Pieces (matrix + spawn color index)
const PIECES = [
  { name: "I", m: [[1,1,1,1]] },
  { name: "O", m: [[1,1],[1,1]] },
  { name: "T", m: [[0,1,0],[1,1,1]] },
  { name: "S", m: [[0,1,1],[1,1,0]] },
  { name: "Z", m: [[1,1,0],[0,1,1]] },
  { name: "J", m: [[1,0,0],[1,1,1]] },
  { name: "L", m: [[0,0,1],[1,1,1]] },
];

// ======= DOM =======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const rotateBtn = document.getElementById("rotateBtn");
const dropBtn = document.getElementById("dropBtn");

// ======= State =======
let board, current, next;
let score = 0, lines = 0, level = 1;
let dropMs = BASE_DROP_MS;
let lastDrop = 0;
let running = false;
let paused = false;
let rafId = null;

function makeBoard(){
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cloneMatrix(m){
  return m.map(row => row.slice());
}

function randPiece(){
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    name: p.name,
    m: cloneMatrix(p.m),
    x: Math.floor((COLS - p.m[0].length) / 2),
    y: 0
  };
}

function resetGame(){
  board = makeBoard();
  current = randPiece();
  next = randPiece();
  score = 0; lines = 0; level = 1;
  dropMs = BASE_DROP_MS;
  updateHUD();
}

function updateHUD(){
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function showOverlay(title, text){
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}
function hideOverlay(){
  overlay.classList.add("hidden");
}

function collide(piece, dx = 0, dy = 0, matrixOverride = null){
  const m = matrixOverride || piece.m;
  for (let y = 0; y < m.length; y++){
    for (let x = 0; x < m[y].length; x++){
      if (!m[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge(piece){
  for (let y = 0; y < piece.m.length; y++){
    for (let x = 0; x < piece.m[y].length; x++){
      if (!piece.m[y][x]) continue;
      const by = piece.y + y;
      const bx = piece.x + x;
      if (by >= 0) board[by][bx] = 1; // we store 1 for filled
    }
  }
}

function clearLines(){
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--){
    if (board[y].every(v => v !== 0)){
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++; // re-check same y after shifting
    }
  }
  if (cleared > 0){
    // classic-ish scoring
    const points = [0, 100, 300, 500, 800][cleared] || (cleared * 250);
    score += points * level;
    lines += cleared;

    // level up every 10 lines
    const newLevel = 1 + Math.floor(lines / 10);
    if (newLevel !== level){
      level = newLevel;
      dropMs = Math.max(120, BASE_DROP_MS - (level - 1) * 60);
    }
    updateHUD();
  }
}

function rotateMatrix(m){
  // clockwise rotate
  const h = m.length;
  const w = m[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      out[x][h - 1 - y] = m[y][x];
    }
  }
  return out;
}

// simple wall-kick tries
function tryRotate(){
  const rotated = rotateMatrix(current.m);
  if (!collide(current, 0, 0, rotated)){
    current.m = rotated; return;
  }
  // try shift left/right a bit
  const kicks = [-1, 1, -2, 2];
  for (const k of kicks){
    if (!collide(current, k, 0, rotated)){
      current.x += k;
      current.m = rotated;
      return;
    }
  }
}

function hardDrop(){
  let d = 0;
  while (!collide(current, 0, d + 1)) d++;
  current.y += d;
  lockPiece();
}

function lockPiece(){
  merge(current);
  clearLines();

  current = next;
  next = randPiece();
  current.x = Math.floor((COLS - current.m[0].length) / 2);
  current.y = 0;

  // game over check
  if (collide(current, 0, 0)){
    running = false;
    showOverlay("GAME OVER", "Press Start to restart");
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function step(time){
  if (!running) return;
  if (!paused){
    if (!lastDrop) lastDrop = time;
    const dt = time - lastDrop;
    if (dt >= dropMs){
      if (!collide(current, 0, 1)){
        current.y += 1;
      } else {
        lockPiece();
      }
      lastDrop = time;
    }
    draw();
  }
  rafId = requestAnimationFrame(step);
}

function draw(){
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // board
  for (let y = 0; y < ROWS; y++){
    for (let x = 0; x < COLS; x++){
      if (board[y][x]) drawBlock(x, y, 0.9);
      else drawCell(x, y);
    }
  }

  // current piece
  for (let y = 0; y < current.m.length; y++){
    for (let x = 0; x < current.m[y].length; x++){
      if (current.m[y][x]) drawBlock(current.x + x, current.y + y, 1);
    }
  }
}

function drawCell(x,y){
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
}

function drawBlock(x,y,alpha=1){
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
}

// ======= Controls =======
function move(dx){
  if (!running || paused) return;
  if (!collide(current, dx, 0)) current.x += dx;
  draw();
}
function softDrop(){
  if (!running || paused) return;
  if (!collide(current, 0, 1)){
    current.y += 1;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
  draw();
}

function togglePause(){
  if (!running) return;
  paused = !paused;
  if (paused) showOverlay("PAUSED", "Press Pause to resume");
  else hideOverlay();
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "arrowleft") move(-1);
  if (k === "arrowright") move(1);
  if (k === "arrowdown") softDrop();
  if (k === "arrowup") { if (running && !paused) { tryRotate(); draw(); } }
  if (k === " ") { if (running && !paused) hardDrop(); }
  if (k === "p") togglePause();
});

// touch buttons (tap)
leftBtn.addEventListener("click", () => move(-1));
rightBtn.addEventListener("click", () => move(1));
downBtn.addEventListener("click", softDrop);
rotateBtn.addEventListener("click", () => { if (running && !paused) { tryRotate(); draw(); } });
dropBtn.addEventListener("click", () => { if (running && !paused) hardDrop(); });

startBtn.addEventListener("click", () => {
  resetGame();
  running = true;
  paused = false;
  lastDrop = 0;
  hideOverlay();
  draw();
  if (!rafId) rafId = requestAnimationFrame(step);
});

pauseBtn.addEventListener("click", () => {
  if (!running) return;
  togglePause();
});

// initial
resetGame();
showOverlay("TETRIS", "Press Start");
draw();