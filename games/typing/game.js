const promptEl = document.getElementById("prompt");
const inputEl = document.getElementById("input");

const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const accEl = document.getElementById("acc");
const streakEl = document.getElementById("streak");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");

const modeEl = document.getElementById("mode");
const newBtn = document.getElementById("newBtn");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const BEST_KEY = "kaz_typing_best_wpm_v1";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = String(best);

// Simple word bank (easy to expand)
const WORDS = `
kaz dumb website absolute cinema sigma skibidi keyboard ramen pizza
anime manga manhwa light novel re zero subaru echidna tomoya kamina
discord roblox javascript html css node mongodb github pages
runner flappy doodle jump clicker upgrades coins streak accuracy
focus grind exam qudurat homework no excuses we lock in
`.trim().split(/\s+/);

function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

function buildText(wordCount){
  const out = [];
  for (let i=0;i<wordCount;i++){
    out.push(WORDS[randInt(0, WORDS.length-1)]);
  }
  // add punctuation sometimes
  const punc = [".", ",", "!", "?", ""];
  for (let i=6;i<out.length;i+=randInt(6,10)){
    out[i] = out[i] + punc[randInt(0,punc.length-1)];
  }
  return out.join(" ");
}

let target = "";
let running = false;
let done = false;

let duration = Number(modeEl.value);
let timeLeft = duration;

let startAt = 0;
let timerId = null;

let totalTyped = 0;
let totalCorrect = 0;

let streak = 0;

function setStatus(t){ statusEl.textContent = t; }

function renderPrompt(value){
  // show each character with styling based on current input
  const typed = inputEl.value;
  let html = "";

  for (let i=0;i<value.length;i++){
    const ch = value[i];
    let cls = "char";
    if (i < typed.length){
      cls += (typed[i] === ch) ? " ok" : " bad";
    }
    if (i === typed.length && running && !done){
      cls += " cur";
    }
    html += `<span class="${cls}">${escapeHtml(ch)}</span>`;
  }

  promptEl.innerHTML = html;
}

function escapeHtml(s){
  return s
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function resetStats(){
  totalTyped = 0;
  totalCorrect = 0;
  streak = 0;
  streakEl.textContent = "0";
  wpmEl.textContent = "0";
  accEl.textContent = "100%";
}

function newText(){
  target = buildText(35);
  inputEl.value = "";
  renderPrompt(target);
  setStatus("Press Start");
}

function setTime(t){
  duration = t;
  timeLeft = t;
  timeEl.textContent = String(timeLeft);
}

function start(){
  if (running) return;

  running = true;
  done = false;
  inputEl.focus();

  resetStats();
  setTime(Number(modeEl.value));

  startAt = Date.now();
  setStatus("Go go go");

  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = String(timeLeft);
    if (timeLeft <= 0){
      finish();
    }
  }, 1000);
}

function finish(){
  if (!running) return;
  running = false;
  done = true;

  if (timerId) clearInterval(timerId);
  timerId = null;

  // final calc
  const minutes = duration / 60;
  const words = totalCorrect / 5; // standard: 5 chars = 1 word
  const wpm = Math.max(0, Math.round(words / minutes));

  wpmEl.textContent = String(wpm);

  if (wpm > best){
    best = wpm;
    bestEl.textContent = String(best);
    localStorage.setItem(BEST_KEY, String(best));
  }

  setStatus("Time. Hit Restart or New Text.");
}

function calcLive(){
  const typed = inputEl.value;

  // count correct chars at each position
  let correct = 0;
  for (let i=0;i<typed.length && i<target.length;i++){
    if (typed[i] === target[i]) correct++;
  }

  totalTyped = typed.length;
  totalCorrect = correct;

  // accuracy
  const acc = totalTyped === 0 ? 100 : Math.round((totalCorrect / totalTyped) * 100);
  accEl.textContent = `${acc}%`;

  // wpm live
  const elapsedSec = Math.max(1, Math.floor((Date.now() - startAt) / 1000));
  const minutes = elapsedSec / 60;
  const words = totalCorrect / 5;
  const wpm = Math.max(0, Math.round(words / minutes));
  wpmEl.textContent = String(wpm);

  // streak: consecutive correct chars at the end
  let s = 0;
  for (let i=typed.length-1; i>=0; i--){
    if (i >= target.length) break;
    if (typed[i] === target[i]) s++;
    else break;
  }
  streak = s;
  streakEl.textContent = String(streak);

  // if they finish text early, make a new one (keeps it flowing)
  if (typed.length >= target.length){
    // small reward feel: auto new text and keep stats rolling
    target = buildText(35);
    inputEl.value = "";
    renderPrompt(target);
    setStatus("New text ✨ keep going");
  }
}

function restart(){
  if (timerId) clearInterval(timerId);
  timerId = null;
  running = false;
  done = false;

  inputEl.value = "";
  renderPrompt(target);
  setTime(Number(modeEl.value));
  resetStats();
  setStatus("Press Start");
  inputEl.focus();
}

// events
newBtn.addEventListener("click", () => {
  const wasRunning = running;
  if (timerId) clearInterval(timerId);
  timerId = null;
  running = false;
  done = false;
  newText();
  setTime(Number(modeEl.value));
  resetStats();
  setStatus(wasRunning ? "New text loaded. Press Start." : "Press Start");
  inputEl.focus();
});

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", restart);

modeEl.addEventListener("change", () => {
  setTime(Number(modeEl.value));
});

// typing handler
inputEl.addEventListener("input", () => {
  renderPrompt(target);
  if (!running) return;
  calcLive();
});

// helpful: hitting enter starts/restarts
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter"){
    e.preventDefault();
    if (!running && !done) start();
    else if (!running && done) restart();
  }
});

// init
newText();
setTime(Number(modeEl.value));