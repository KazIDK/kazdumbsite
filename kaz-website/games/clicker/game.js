// =========================
// Kaz Clicker (NO SAVE ver.)
// FIXED: no re-render spam, buttons work
// =========================

// ---- Easy edit zone ----
const BUILDINGS = [
  { id:"cursor",  name:"Cursor",  baseCost: 15,    cps: 0.1, desc:"Clicks for you (kinda)." },
  { id:"grandma", name:"Grandma", baseCost: 100,   cps: 1,   desc:"Bakes coins suspiciously fast." },
  { id:"farm",    name:"Farm",    baseCost: 1100,  cps: 8,   desc:"Grows coins. Don’t ask." },
  { id:"factory", name:"Factory", baseCost: 12000, cps: 47,  desc:"Industrial coin printing." },
  { id:"bank",    name:"Bank",    baseCost: 130000,cps: 260, desc:"Money makes money." },
];

const UPGRADES = [
  { id:"u_click2",   name:"Stronger Finger", cost: 200,  type:"click", mult: 2, desc:"Double coins per click." },
  { id:"u_cps2",     name:"Better Machines", cost: 700,  type:"cps",   mult: 2, desc:"Double ALL coins per second." },
  { id:"u_cursor2",  name:"Cursor Oil",      cost: 400,  type:"building", target:"cursor",  mult: 2, desc:"Cursors produce 2x." },
  { id:"u_grandma2", name:"Grandma Rage",    cost: 1500, type:"building", target:"grandma", mult: 2, desc:"Grandmas produce 2x." },
  { id:"u_click5",   name:"Controller Grip", cost: 6000, type:"click", mult: 5, desc:"5x coins per click." },
];

const COST_GROWTH = 1.15; // price increases per building buy
// ---- End easy edit zone ----

// ===== DOM =====
const coinsEl = document.getElementById("coins");
const perClickEl = document.getElementById("perClick");
const perSecEl = document.getElementById("perSec");

const buildingsList = document.getElementById("buildingsList");
const upgradesList = document.getElementById("upgradesList");

const bigClickBtn = document.getElementById("bigClickBtn");
const logEl = document.getElementById("log");
const resetBtn = document.getElementById("resetBtn");

const lifetimeEl = document.getElementById("lifetime");
const ownedTotalEl = document.getElementById("ownedTotal");

// Tabs
const tabBtns = document.querySelectorAll(".tab");
const panels = {
  buildings: document.getElementById("panel-buildings"),
  upgrades: document.getElementById("panel-upgrades"),
  stats: document.getElementById("panel-stats"),
};

// ===== State =====
let state = {
  coins: 0,
  lifetime: 0,
  clickBase: 1,
  clickMult: 1,
  cpsMult: 1,
  owned: {},          // building id -> count
  buildingMults: {},  // building id -> mult
  boughtUpgrades: {}, // upgrade id -> true
};

// ===== Utils =====
function fmt(n){
  if (n < 1000) return String(Math.floor(n));
  const units = ["K","M","B","T","Qa","Qi"];
  let u = -1;
  while (n >= 1000 && u < units.length - 1){
    n /= 1000;
    u++;
  }
  return `${n.toFixed(n >= 10 ? 1 : 2)}${units[u]}`;
}

function log(msg){
  logEl.textContent = msg;
}

function countOwned(id){
  return state.owned[id] || 0;
}

function buildingMult(id){
  return state.buildingMults[id] || 1;
}

function buildingCost(b){
  const n = countOwned(b.id);
  return Math.floor(b.baseCost * Math.pow(COST_GROWTH, n));
}

function totalCps(){
  let cps = 0;
  for (const b of BUILDINGS){
    cps += countOwned(b.id) * b.cps * buildingMult(b.id);
  }
  return cps * state.cpsMult;
}

function coinsPerClick(){
  return state.clickBase * state.clickMult;
}

function canAfford(cost){
  return state.coins >= cost;
}

// ===== Render =====
function renderHUD(){
  coinsEl.textContent = fmt(state.coins);
  perClickEl.textContent = fmt(coinsPerClick());
  perSecEl.textContent = fmt(totalCps());
  lifetimeEl.textContent = fmt(state.lifetime);

  let totalOwned = 0;
  for (const b of BUILDINGS) totalOwned += countOwned(b.id);
  ownedTotalEl.textContent = String(totalOwned);
}

function renderBuildings(){
  buildingsList.innerHTML = "";

  for (const b of BUILDINGS){
    const cost = buildingCost(b);
    const owned = countOwned(b.id);
    const each = b.cps * buildingMult(b.id) * state.cpsMult;

    const row = document.createElement("div");
    row.className = "buyItem";
    row.innerHTML = `
      <div class="buyLeft">
        <div class="buyName">${b.name} <span class="buyMeta">x${owned}</span></div>
        <div class="buyDesc">${b.desc}</div>
        <div class="buyMeta">+${fmt(each)} / sec each</div>
      </div>
      <button class="buyBtn">Buy (${fmt(cost)})</button>
    `;

    const btn = row.querySelector(".buyBtn");

    // tag so we can toggle disabled without rebuilding
    btn.setAttribute("data-kind", "building");
    btn.setAttribute("data-id", b.id);
    btn.setAttribute("data-cost", String(cost));

    btn.disabled = !canAfford(cost);
    btn.addEventListener("click", () => buyBuilding(b.id));

    buildingsList.appendChild(row);
  }
}

function renderUpgrades(){
  upgradesList.innerHTML = "";

  const available = UPGRADES.filter(u => !state.boughtUpgrades[u.id]);
  if (available.length === 0){
    const row = document.createElement("div");
    row.className = "buyItem";
    row.innerHTML = `
      <div class="buyLeft">
        <div class="buyName">No upgrades left</div>
        <div class="buyDesc">Add more in UPGRADES array.</div>
      </div>
      <button class="buyBtn" disabled>Done</button>
    `;
    upgradesList.appendChild(row);
    return;
  }

  for (const u of available){
    const row = document.createElement("div");
    row.className = "buyItem";
    row.innerHTML = `
      <div class="buyLeft">
        <div class="buyName">${u.name}</div>
        <div class="buyDesc">${u.desc}</div>
        <div class="buyMeta">Cost: ${fmt(u.cost)}</div>
      </div>
      <button class="buyBtn">Buy</button>
    `;

    const btn = row.querySelector(".buyBtn");

    btn.setAttribute("data-kind", "upgrade");
    btn.setAttribute("data-id", u.id);
    btn.setAttribute("data-cost", String(u.cost));

    btn.disabled = !canAfford(u.cost);
    btn.addEventListener("click", () => buyUpgrade(u.id));

    upgradesList.appendChild(row);
  }
}

function renderAll(){
  renderHUD();
  renderBuildings();
  renderUpgrades();
}

function updateBuyButtons(){
  document.querySelectorAll(".buyBtn[data-cost]").forEach(btn => {
    const cost = Number(btn.getAttribute("data-cost"));
    btn.disabled = state.coins < cost;
  });
}

// ===== Game actions =====
function addCoins(amount){
  state.coins += amount;
  state.lifetime += amount;
}

function floaty(text){
  const div = document.createElement("div");
  div.className = "floaty";
  div.textContent = text;
  bigClickBtn.appendChild(div);
  setTimeout(() => div.remove(), 900);
}

function click(){
  const gain = coinsPerClick();
  addCoins(gain);
  floaty(`+${fmt(gain)}`);
  renderHUD();
  updateBuyButtons();
}

function buyBuilding(id){
  const b = BUILDINGS.find(x => x.id === id);
  if (!b) return;

  const cost = buildingCost(b);
  if (!canAfford(cost)){
    log("Not enough coins 💀");
    return;
  }

  state.coins -= cost;
  state.owned[id] = countOwned(id) + 1;

  log(`Bought ${b.name} ✅`);
  renderAll(); // rebuild lists once
}

function buyUpgrade(id){
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return;
  if (state.boughtUpgrades[id]) return;

  if (!canAfford(u.cost)){
    log("Too broke for that upgrade 😭");
    return;
  }

  state.coins -= u.cost;
  state.boughtUpgrades[id] = true;

  if (u.type === "click"){
    state.clickMult *= u.mult;
  } else if (u.type === "cps"){
    state.cpsMult *= u.mult;
  } else if (u.type === "building"){
    const t = u.target;
    state.buildingMults[t] = (state.buildingMults[t] || 1) * u.mult;
  }

  log(`Upgrade: ${u.name} 🔥`);
  renderAll(); // rebuild lists once
}

function hardReset(){
  if (!confirm("Reset EVERYTHING?")) return;
  state = {
    coins: 0,
    lifetime: 0,
    clickBase: 1,
    clickMult: 1,
    cpsMult: 1,
    owned: {},
    buildingMults: {},
    boughtUpgrades: {},
  };
  log("Reset ✅");
  renderAll();
}

// ===== Tabs =====
function openTab(key){
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle("open", k === key));
}
tabBtns.forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));

// ===== Loop (income) =====
// FIX: only update HUD + enable/disable; DO NOT rebuild lists every frame
let last = performance.now();
function loop(now){
  const dt = Math.max(0, now - last);
  last = now;

  const cps = totalCps();
  if (cps > 0){
    addCoins(cps * (dt / 1000));
  }

  renderHUD();
  updateBuyButtons();

  requestAnimationFrame(loop);
}

// ===== Events =====
bigClickBtn.addEventListener("click", click);
bigClickBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  click();
}, { passive: false });

resetBtn.addEventListener("click", hardReset);

// ===== Init =====
openTab("buildings");
renderAll();
log("No-save clicker loaded ✅");
requestAnimationFrame(loop);