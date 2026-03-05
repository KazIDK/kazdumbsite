const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const jumpBtn = document.getElementById("jumpBtn");
const slideBtn = document.getElementById("slideBtn");

const BEST_KEY = "kaz_runner_best_v1";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = String(best);

// fixed internal resolution (stable physics)
canvas.width = 520;
canvas.height = 260;

function showOverlay(title, text){
  overlayTitle.textContent = title;
  overlayText.innerHTML = text.replaceAll("\n","<br/>");
  overlay.classList.remove("hidden");
}
function hideOverlay(){
  overlay.classList.add("hidden");
}

// ===== World settings =====
const GROUND_Y = canvas.height - 46;
const GRAVITY = 0.85;
const JUMP_V = -12.5;

// speed ramps
const BASE_SPEED = 5.0;
const SPEED_GAIN = 0.0009; // per ms, ramps slowly

// spawn logic
const MIN_SPAWN = 700;
const MAX_SPAWN = 1200;

// player
let player;

// obstacles
let obstacles = [];
let spawnTimer = 0;

// state
let running = false;
let dead = false;
let score = 0;
let speed = BASE_SPEED;
let lastTime = performance.now();

// slide state
const SLIDE_MS = 520;

function reset(){
  running = false;
  dead = false;
  score = 0;
  speed = BASE_SPEED;
  obstacles = [];
  spawnTimer = rand(MIN_SPAWN, MAX_SPAWN);

  player = {
    x: 80,
    y: GROUND_Y,
    w: 28,
    h: 44,
    vy: 0,
    onGround: true,
    sliding: false,
    slideT: 0,
  };

  scoreEl.textContent = "0";
  draw();
  showOverlay("RUNNER", "Tap / Space = Jump\nSwipe Down / S = Slide");
}

function start(){
  if (dead) reset();
  running = true;
  hideOverlay();
}

function rand(a,b){ return a + Math.random()*(b-a); }

function jump(){
  if (dead){ start(); return; }
  if (!running) start();
  if (!player.onGround) return;

  player.vy = JUMP_V;
  player.onGround = false;
  player.sliding = false;
  player.slideT = 0;
}

function slide(){
  if (dead){ start(); return; }
  if (!running) start();
  if (!player.onGround) return;

  player.sliding = true;
  player.slideT = SLIDE_MS;
}

function spawnObstacle(){
  // types:
  // - spike (ground)
  // - bar (requires slide)
  const t = Math.random();
  if (t < 0.55){
    // ground spike
    obstacles.push({
      type: "spike",
      x: canvas.width + 40,
      y: GROUND_Y,
      w: 22,
      h: 22,
      passed:false
    });
  } else {
    // overhead bar -> must slide under
    obstacles.push({
      type: "bar",
      x: canvas.width + 40,
      y: GROUND_Y - 48,
      w: 34,
      h: 10,
      passed:false
    });
  }
}

function rectHit(ax, ay, aw, ah, bx, by, bw, bh){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function update(dt){
  if (!running) return;

  // ramp speed
  speed = BASE_SPEED + (performance.now() - lastTime) * SPEED_GAIN;

  // score = time survived + little speed weight
  score += dt * 0.01 * (1 + (speed-BASE_SPEED)*0.12);
  scoreEl.textContent = String(Math.floor(score));

  // player physics
  player.vy += GRAVITY;
  player.y += player.vy;

  if (player.y >= GROUND_Y){
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  }

  // slide timer
  if (player.sliding){
    player.slideT -= dt;
    if (player.slideT <= 0){
      player.sliding = false;
      player.slideT = 0;
    }
  }

  // spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0){
    spawnObstacle();
    spawnTimer = rand(MIN_SPAWN, MAX_SPAWN) * (1 / (1 + (speed-BASE_SPEED)*0.06));
    spawnTimer = Math.max(420, spawnTimer);
  }

  // move obstacles
  for (const o of obstacles){
    o.x -= speed;
    // score bonus for passing
    if (!o.passed && o.x + o.w < player.x){
      o.passed = true;
      score += 12;
    }
  }
  obstacles = obstacles.filter(o => o.x + o.w > -60);

  // collision
  const pH = player.sliding ? 26 : player.h;
  const pY = player.sliding ? (GROUND_Y - pH) : (player.y - player.h);

  const pX = player.x;
  const pW = player.w;

  for (const o of obstacles){
    const oY = o.type === "spike" ? (o.y - o.h) : o.y;
    if (rectHit(pX, pY, pW, pH, o.x, oY, o.w, o.h)){
      die();
      return;
    }
  }
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

  showOverlay("GAME OVER", "Tap to restart\nScore saved");
}

function draw(){
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // background layer
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  // ground
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  // moving lines (speed feel)
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  for (let x = 0; x < canvas.width; x += 48){
    const off = (performance.now() * speed * 0.03) % 48;
    ctx.moveTo(x - off, GROUND_Y);
    ctx.lineTo(x - off + 24, GROUND_Y);
  }
  ctx.stroke();

  // obstacles
  for (const o of obstacles){
    if (o.type === "spike"){
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      // triangle
      ctx.beginPath();
      ctx.moveTo(o.x, GROUND_Y);
      ctx.lineTo(o.x + o.w/2, GROUND_Y - o.h);
      ctx.lineTo(o.x + o.w, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  }

  // player
  const pH = player.sliding ? 26 : player.h;
  const pY = player.sliding ? (GROUND_Y - pH) : (player.y - player.h);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(player.x, pY, player.w, pH);

  // eye dot (meme)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(player.x + player.w - 8, pY + 8, 3, 3);
}

function frame(now){
  const dt = Math.min(34, now - lastTime);
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(frame);
}

// ===== Controls =====
// pointer on canvas: tap to jump
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (dead) { reset(); start(); return; }
  jump();
}, { passive:false });

// swipe down to slide
let tStartX = 0, tStartY = 0;
canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  tStartX = t.clientX;
  tStartY = t.clientY;
}, { passive:true });

canvas.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - tStartX;
  const dy = t.clientY - tStartY;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const min = 18;

  if (absX < min && absY < min) return;

  // swipe down triggers slide
  if (absY > absX && dy > 0){
    slide();
  }
}, { passive:true });

// keyboard
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === " " || k === "w" || k === "arrowup") jump();
  if (k === "s" || k === "arrowdown") slide();
  if (k === "r") { reset(); start(); }
});

// buttons
jumpBtn.addEventListener("click", jump);
slideBtn.addEventListener("click", slide);

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", () => { reset(); start(); });

// init
reset();
requestAnimationFrame(frame);