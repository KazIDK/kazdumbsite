const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const BEST_KEY = "kaz_flappy_best_v1";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = String(best);

// Responsive canvas size (keeps physics stable by using internal resolution)
function resizeCanvas(){
  // internal resolution (game units)
  canvas.width = 420;
  canvas.height = 560;
}
resizeCanvas();

// ===== Game constants =====
const GRAVITY = 0.42;
const FLAP_VEL = -7.6;

const PIPE_W = 72;
const PIPE_GAP = 150;
const PIPE_SPACING = 210;
const PIPE_SPEED = 2.7;

const FLOOR_H = 70;

let running = false;
let gameOver = false;
let score = 0;

let bird, pipes;
let lastSpawnX = 0;

function showOverlay(title, text){
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}
function hideOverlay(){
  overlay.classList.add("hidden");
}

function reset(){
  score = 0;
  scoreEl.textContent = "0";
  running = false;
  gameOver = false;

  bird = {
    x: 130,
    y: canvas.height * 0.45,
    r: 16,
    vy: 0,
    rot: 0,
  };

  pipes = [];
  lastSpawnX = canvas.width + 50;

  // prefill pipes
  for (let x = canvas.width + 120; x < canvas.width + 120 + PIPE_SPACING * 3; x += PIPE_SPACING){
    spawnPipe(x);
  }

  draw();
  showOverlay("FLAPPY", "Tap / Click / Space");
}

function spawnPipe(x){
  const marginTop = 60;
  const marginBottom = FLOOR_H + 60;
  const maxCenter = canvas.height - marginBottom - PIPE_GAP/2;
  const minCenter = marginTop + PIPE_GAP/2;

  const center = minCenter + Math.random() * (maxCenter - minCenter);

  pipes.push({
    x,
    w: PIPE_W,
    gapY: center,
    scored: false
  });
}

function flap(){
  if (gameOver){
    // quick restart with tap
    startGame(true);
    return;
  }
  if (!running){
    startGame(false);
  }
  bird.vy = FLAP_VEL;
}

function startGame(forceRestart){
  if (forceRestart) reset();
  running = true;
  hideOverlay();
}

function collideCircleRect(cx, cy, r, rx, ry, rw, rh){
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return (dx*dx + dy*dy) <= r*r;
}

function tick(){
  if (!running) return;

  // bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;

  // rotation feel
  bird.rot = Math.max(-0.6, Math.min(1.3, bird.vy / 10));

  // move pipes
  for (const p of pipes){
    p.x -= PIPE_SPEED;

    // scoring
    if (!p.scored && p.x + p.w < bird.x){
      p.scored = true;
      score += 1;
      scoreEl.textContent = String(score);

      if (score > best){
        best = score;
        bestEl.textContent = String(best);
        localStorage.setItem(BEST_KEY, String(best));
      }
    }
  }

  // remove offscreen pipes
  while (pipes.length && pipes[0].x + pipes[0].w < -20){
    pipes.shift();
  }

  // ensure pipe stream
  const last = pipes[pipes.length - 1];
  if (last && last.x < canvas.width){
    spawnPipe(last.x + PIPE_SPACING);
  }

  // collisions (pipes)
  for (const p of pipes){
    const topRect = { x: p.x, y: 0, w: p.w, h: p.gapY - PIPE_GAP/2 };
    const botRect = { x: p.x, y: p.gapY + PIPE_GAP/2, w: p.w, h: canvas.height - (p.gapY + PIPE_GAP/2) - FLOOR_H };

    if (collideCircleRect(bird.x, bird.y, bird.r, topRect.x, topRect.y, topRect.w, topRect.h) ||
        collideCircleRect(bird.x, bird.y, bird.r, botRect.x, botRect.y, botRect.w, botRect.h)){
      endGame();
      return;
    }
  }

  // floor/ceiling
  if (bird.y - bird.r < 0) {
    bird.y = bird.r;
    bird.vy = 0;
  }
  if (bird.y + bird.r > canvas.height - FLOOR_H){
    endGame();
    return;
  }
}

function endGame(){
  running = false;
  gameOver = true;
  showOverlay("GAME OVER", "Tap to restart");
}

function draw(){
  // background
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // sky gradient-ish (no explicit colors requested; keep simple)
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  // pipes
  for (const p of pipes){
    const topH = p.gapY - PIPE_GAP/2;
    const botY = p.gapY + PIPE_GAP/2;
    const botH = canvas.height - botY - FLOOR_H;

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(p.x, 0, p.w, topH);

    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(p.x, botY, p.w, botH);

    // pipe edges
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(p.x, 0, p.w, topH);
    ctx.strokeRect(p.x, botY, p.w, botH);
  }

  // floor
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, canvas.height - FLOOR_H, canvas.width, FLOOR_H);

  // bird
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, bird.r, 0, Math.PI*2);
  ctx.fill();

  // eye
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(6, -4, 3, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

let last = performance.now();
function loop(now){
  const dt = now - last;
  last = now;

  // fixed-ish step for consistent speed
  tick();
  draw();

  requestAnimationFrame(loop);
}

// Controls
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  flap();
}, { passive: false });

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === " " || k === "arrowup" || k === "w") flap();
  if (k === "r") startGame(true);
});

startBtn.addEventListener("click", () => startGame(false));
restartBtn.addEventListener("click", () => startGame(true));

// init
reset();
requestAnimationFrame(loop);