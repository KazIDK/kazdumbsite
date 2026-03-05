const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const eventTextEl = document.getElementById("eventText");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

const upBtn = document.getElementById("upBtn");
const leftBtn = document.getElementById("leftBtn");
const downBtn = document.getElementById("downBtn");
const rightBtn = document.getElementById("rightBtn");

const difficultySel = document.getElementById("difficulty");
const applyDiffBtn = document.getElementById("applyDiffBtn");

// ===== Settings =====
const GRID = 18;
const SIZE = canvas.width / GRID;

// Difficulty presets (you can tweak anytime)
const DIFF = {
  easy:   { startMs: 160, bombChance: 0.04, maxBombs: 2, eventChance: 0.06 },
  normal: { startMs: 135, bombChance: 0.06, maxBombs: 3, eventChance: 0.08 },
  hard:   { startMs: 110, bombChance: 0.09, maxBombs: 5, eventChance: 0.11 },
};

let diffKey = "normal";
let startSpeedMs = DIFF[diffKey].startMs;

// ===== Game State =====
let snake, dir, nextDir, food;
let bombs = [];          // obstacles
let score = 0;
let best = Number(localStorage.getItem("snakeBest") || 0);

let running = false;
let paused = false;
let tickTimer = null;
let speedMs = startSpeedMs;

// Event system
let activeEvent = null;
let eventTimer = 0; // ticks remaining

bestEl.textContent = String(best);

function showOverlay(title, text){
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}
function hideOverlay(){
  overlay.classList.add("hidden");
}

function setEvent(text){
  eventTextEl.textContent = text || "None";
}

function resetGame(){
  snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };

  bombs = [];
  activeEvent = null;
  eventTimer = 0;
  setEvent("None");

  score = 0;
  scoreEl.textContent = "0";

  speedMs = startSpeedMs;

  spawnFood();
  draw();
}

function randCell(){
  return {
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID)
  };
}

function cellOccupied(x, y){
  if (snake.some(s => s.x === x && s.y === y)) return true;
  if (bombs.some(b => b.x === x && b.y === y)) return true;
  if (food && food.x === x && food.y === y) return true;
  return false;
}

function spawnFood(){
  for (let tries = 0; tries < 500; tries++){
    const f = randCell();
    if (!cellOccupied(f.x, f.y)){ food = f; return; }
  }
  // if the board is full (rare), just end
  gameOver("YOU WIN", "You filled the board 💀");
}

function spawnBomb(){
  for (let tries = 0; tries < 500; tries++){
    const b = randCell();
    if (!cellOccupied(b.x, b.y)){
      bombs.push(b);
      return true;
    }
  }
  return false;
}

function setDir(nx, ny){
  if (nx === -dir.x && ny === -dir.y) return;
  nextDir = { x: nx, y: ny };
}

// Wrap-around movement
function wrap(v){
  if (v < 0) return GRID - 1;
  if (v >= GRID) return 0;
  return v;
}

function start(){
  if (running) return;
  running = true;
  paused = false;
  hideOverlay();
  restartTick();
}

function togglePause(){
  if (!running) return;
  paused = !paused;
  if (paused) showOverlay("PAUSED", "Press Pause to resume");
  else hideOverlay();
}

function restart(){
  stopTick();
  resetGame();
  running = true;
  paused = false;
  hideOverlay();
  restartTick();
}

function restartTick(){
  stopTick();
  tickTimer = setInterval(step, speedMs);
}

function stopTick(){
  if (tickTimer){
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function applyDifficulty(){
  diffKey = difficultySel.value;
  startSpeedMs = DIFF[diffKey].startMs;
  speedMs = startSpeedMs;

  // If running, reapply speed immediately
  if (running && !paused) restartTick();

  setEvent(`Difficulty: ${diffKey}`);
  setTimeout(() => setEvent(activeEvent ? activeEvent : "None"), 700);
}

// ===== Events =====
// Event ideas (simple but fun):
// - "Bomb Rain": spawns extra bombs for a short time
// - "Speed Boost": temporarily faster
function maybeStartEvent(){
  if (activeEvent) return;

  const chance = DIFF[diffKey].eventChance;
  if (Math.random() > chance) return;

  const pick = Math.random();
  if (pick < 0.6){
    activeEvent = "Bomb Rain";
    eventTimer = 12; // ticks
    setEvent("Bomb Rain!");
  } else {
    activeEvent = "Speed Boost";
    eventTimer = 10; // ticks
    speedMs = Math.max(60, speedMs - 35);
    restartTick();
    setEvent("Speed Boost!");
  }
}

function tickEvent(){
  if (!activeEvent) return;

  if (activeEvent === "Bomb Rain"){
    // spawn a bomb every tick (until maxBombs cap still respected below)
    // actual spawning happens in step() bomb logic so it stays consistent
  }

  eventTimer--;
  if (eventTimer <= 0){
    // end event
    if (activeEvent === "Speed Boost"){
      speedMs = startSpeedMs;
      restartTick();
    }
    activeEvent = null;
    setEvent("None");
  }
}

// ===== Main loop =====
function step(){
  if (!running || paused) return;

  dir = nextDir;

  const head = snake[0];
  const newHead = {
    x: wrap(head.x + dir.x),
    y: wrap(head.y + dir.y),
  };

  // self collision
  if (snake.some(s => s.x === newHead.x && s.y === newHead.y)){
    return gameOver("GAME OVER", "You ate yourself");
  }

  // bomb collision
  if (bombs.some(b => b.x === newHead.x && b.y === newHead.y)){
    return gameOver("BOOM", "You hit a bomb");
  }

  snake.unshift(newHead);

  // eat
  const ate = (newHead.x === food.x && newHead.y === food.y);
  if (ate){
    score += 1;
    scoreEl.textContent = String(score);

    if (score > best){
      best = score;
      bestEl.textContent = String(best);
      localStorage.setItem("snakeBest", String(best));
    }

    // Slight speed-up as you score (feels good)
    speedMs = Math.max(70, startSpeedMs - score * 2);
    restartTick();

    spawnFood();
  } else {
    snake.pop();
  }

  // Obstacles logic:
  // bombs spawn sometimes, limited by difficulty
  const maxBombs = DIFF[diffKey].maxBombs + Math.floor(score / 8); // grows slowly
  const bombChance = DIFF[diffKey].bombChance;

  // Event logic
  maybeStartEvent();

  // If Bomb Rain event is active, increase spawn chance
  let effectiveChance = bombChance;
  if (activeEvent === "Bomb Rain") effectiveChance += 0.35;

  if (bombs.length < maxBombs && Math.random() < effectiveChance){
    spawnBomb();
  }

  tickEvent();
  draw();
}

function gameOver(title, text){
  running = false;
  stopTick();
  showOverlay(title, text);
  setEvent("None");
}

function draw(){
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i <= GRID; i++){
    ctx.beginPath();
    ctx.moveTo(i * SIZE, 0);
    ctx.lineTo(i * SIZE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * SIZE);
    ctx.lineTo(canvas.width, i * SIZE);
    ctx.stroke();
  }

  // food
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc((food.x + 0.5) * SIZE, (food.y + 0.5) * SIZE, SIZE * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // bombs
  for (const b of bombs){
    // little bomb circle
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc((b.x + 0.5) * SIZE, (b.y + 0.5) * SIZE, SIZE * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // fuse dot
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc((b.x + 0.66) * SIZE, (b.y + 0.33) * SIZE, SIZE * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // snake
  for (let i = 0; i < snake.length; i++){
    const s = snake[i];
    const pad = i === 0 ? 2 : 4;
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.70)";
    ctx.fillRect(s.x * SIZE + pad, s.y * SIZE + pad, SIZE - pad*2, SIZE - pad*2);
  }
}

// ===== Controls =====
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") setDir(0,-1);
  if (k === "arrowdown" || k === "s") setDir(0,1);
  if (k === "arrowleft" || k === "a") setDir(-1,0);
  if (k === "arrowright" || k === "d") setDir(1,0);
  if (k === "p") togglePause();
  if (k === "enter") start();
});

upBtn.addEventListener("click", () => setDir(0,-1));
downBtn.addEventListener("click", () => setDir(0,1));
leftBtn.addEventListener("click", () => setDir(-1,0));
rightBtn.addEventListener("click", () => setDir(1,0));

let touchStartX = 0, touchStartY = 0;
canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const min = 18;

  if (absX < min && absY < min) return;

  if (absX > absY) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
}, { passive: true });

// UI buttons
startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", restart);
applyDiffBtn.addEventListener("click", applyDifficulty);

// init
applyDifficulty();
resetGame();
showOverlay("SNAKE", "Press Start");