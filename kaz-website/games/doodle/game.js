const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const BEST_KEY = "kaz_doodle_best_v1";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = String(best);

// internal resolution
canvas.width = 520;
canvas.height = 640;

function showOverlay(title, text){
  overlayTitle.textContent = title;
  overlayText.innerHTML = text.replaceAll("\n","<br/>");
  overlay.classList.remove("hidden");
}
function hideOverlay(){ overlay.classList.add("hidden"); }

// ===== Gameplay =====
const W = canvas.width;
const H = canvas.height;

const GRAV = 0.45;
const JUMP_V = -11.5;

const PLAYER_W = 34;
const PLAYER_H = 34;

const PLATFORM_W = 70;
const PLATFORM_H = 12;

const PLATFORM_COUNT = 11;

// controls
let inputX = 0; // -1..1, steering

let running = false;
let dead = false;
let score = 0;

// camera
let camY = 0;

// entities
let player;
let platforms;

// tilt input (mobile)
let tilt = 0; // -1..1

function reset(){
  running = false;
  dead = false;
  score = 0;
  camY = 0;

  player = {
    x: W/2 - PLAYER_W/2,
    y: H - 120,
    vx: 0,
    vy: JUMP_V, // start with a hop
  };

  platforms = [];
  // base platform
  platforms.push({ x: W/2 - PLATFORM_W/2, y: H - 60, w: PLATFORM_W, h: PLATFORM_H });

  // generate upward
  let y = H - 120;
  for (let i = 0; i < PLATFORM_COUNT; i++){
    y -= 60 + Math.random() * 40;
    platforms.push({
      x: Math.random() * (W - PLATFORM_W),
      y,
      w: PLATFORM_W,
      h: PLATFORM_H,
    });
  }

  scoreEl.textContent = "0";
  draw();
  showOverlay("DOODLE", "Tilt phone or drag\nPC: A/D or arrows");
}

function start(){
  if (dead) reset();
  running = true;
  hideOverlay();
}

function die(){
  running = false;
  dead = true;

  const final = Math.floor(score);
  if (final > best){
    best = final;
    bestEl.textContent = String(best);
    localStorage.setItem(BEST_KEY, String(best));
  }

  showOverlay("GAME OVER", "Tap Start / Restart");
}

// wrap player (no walls)
function wrapX(){
  if (player.x > W) player.x = -PLAYER_W;
  if (player.x < -PLAYER_W) player.x = W;
}

function update(dt){
  if (!running) return;

  // controls blend: keyboard/drag + tilt
  const steer = clamp(inputX + tilt, -1, 1);
  const targetV = steer * 5.6;

  player.vx = lerp(player.vx, targetV, 0.22);
  player.vy += GRAV * (dt / 16.67);

  player.x += player.vx * (dt / 16.67);
  player.y += player.vy * (dt / 16.67);

  wrapX();

  // collision with platforms only when falling
  if (player.vy > 0){
    for (const p of platforms){
      const px = p.x;
      const py = p.y - camY;

      // player's rect in screen coords
      const rx = player.x;
      const ry = player.y;
      const rw = PLAYER_W;
      const rh = PLAYER_H;

      // platform rect in screen coords
      const bx = px;
      const by = py;
      const bw = p.w;
      const bh = p.h;

      // detect "landing" (simple)
      const wasAbove = (ry + rh - player.vy) <= by;
      const hit = rx < bx + bw && rx + rw > bx && ry + rh >= by && ry + rh <= by + bh + 10;
      if (wasAbove && hit){
        player.vy = JUMP_V;
        break;
      }
    }
  }

  // camera: if player goes above mid, move world down
  const screenY = player.y;
  const targetTop = H * 0.42;
  if (screenY < targetTop){
    const diff = targetTop - screenY;
    player.y = targetTop;
    camY += diff;

    // scoring = height climbed
    score += diff * 0.08;
    scoreEl.textContent = String(Math.floor(score));

    // move platforms upward in world stays same; we just increase camY
    // regenerate platforms that went below
    const bottomWorldY = camY + H + 80;

    for (const p of platforms){
      if (p.y > bottomWorldY){
        // respawn above
        const highest = Math.min(...platforms.map(pp => pp.y));
        p.y = highest - (55 + Math.random() * 55);
        p.x = Math.random() * (W - PLATFORM_W);
        p.w = PLATFORM_W;
        p.h = PLATFORM_H;
      }
    }
  }

  // death: fall below screen
  if (player.y > H + 70){
    die();
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);

  // background
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0,0,W,H);

  // subtle stars/dots
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  for (let i = 0; i < 18; i++){
    const x = (i * 97 + Math.floor(camY)) % W;
    const y = (i * 53 + Math.floor(camY*0.6)) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  // platforms
  for (const p of platforms){
    const y = p.y - camY;
    if (y < -40 || y > H + 40) continue;
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.fillRect(p.x, y, p.w, p.h);
  }

  // player
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fillRect(player.x, player.y, PLAYER_W, PLAYER_H);

  // lil face dot
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(player.x + PLAYER_W - 10, player.y + 10, 3, 3);
}

// ===== Loop =====
let last = performance.now();
function frame(now){
  const dt = Math.min(34, now - last);
  last = now;

  update(dt);
  draw();

  requestAnimationFrame(frame);
}

// ===== Controls =====
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

// Keyboard
let leftHeld = false, rightHeld = false;
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a" || k === "arrowleft") leftHeld = true;
  if (k === "d" || k === "arrowright") rightHeld = true;

  if (k === " " || k === "w" || k === "arrowup"){
    // optional: jump tap starts game
    if (!running) start();
  }
});
document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a" || k === "arrowleft") leftHeld = false;
  if (k === "d" || k === "arrowright") rightHeld = false;
});
function updateKeyboardSteer(){
  const v = (rightHeld ? 1 : 0) + (leftHeld ? -1 : 0);
  inputX = v;
}
setInterval(updateKeyboardSteer, 16);

// Drag / touch steer
let dragging = false;
let dragStartX = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  dragging = true;
  dragStartX = e.clientX;
  if (!running) start();
}, { passive:false });

canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragStartX;
  inputX = clamp(dx / 120, -1, 1);
}, { passive:true });

canvas.addEventListener("pointerup", () => {
  dragging = false;
  inputX = 0;
});
canvas.addEventListener("pointercancel", () => {
  dragging = false;
  inputX = 0;
});

// Tilt (mobile)
window.addEventListener("deviceorientation", (e) => {
  // gamma: left/right tilt
  if (typeof e.gamma !== "number") return;
  // normalize to -1..1
  tilt = clamp(e.gamma / 25, -1, 1);
});

// Buttons
startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", () => { reset(); start(); });

// init
reset();
requestAnimationFrame(frame);