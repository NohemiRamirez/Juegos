/* =========================================================
   EL SECRETO DEL GRAN ARCHIPIÉLAGO — lógica del juego
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   0. UTILIDADES GENERALES
   --------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Sonido sencillo con WebAudio (sin archivos externos) ---
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
}
function playTone(freq, dur, type = 'sine', vol = 0.15) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.stop(audioCtx.currentTime + dur);
}
function soundOk() { playTone(660, 0.12, 'triangle'); setTimeout(() => playTone(880, 0.16, 'triangle'), 90); }
function soundBad() { playTone(180, 0.22, 'sawtooth', 0.1); }
function soundClick() { playTone(440, 0.06, 'square', 0.08); }
function soundWin() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'triangle'), i * 130));
}

function toast(elId, msg, bad = false, duration = 1600) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('bad');
  if (bad) el.classList.add('bad');
  el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), duration);
}

/* ---------------------------------------------------------
   1. NAVEGACIÓN ENTRE PANTALLAS
   --------------------------------------------------------- */
const screenHooks = {}; // { screenId: { onEnter, onExit } }
let currentScreenId = 'screen-start';

function showScreen(id) {
  if (screenHooks[currentScreenId] && screenHooks[currentScreenId].onExit) {
    screenHooks[currentScreenId].onExit();
  }
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  target.classList.add('active');
  window.scrollTo(0, 0);
  currentScreenId = id;
  if (screenHooks[id] && screenHooks[id].onEnter) {
    screenHooks[id].onEnter();
  }
}

const state = {
  character: null,
  islandsUnlocked: [true, false, false, false], // índices 0-3
  islandsCompleted: [false, false, false, false]
};

/* ---------------------------------------------------------
   2. PANTALLA DE INICIO — elegir personaje
   --------------------------------------------------------- */
$$('.char-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureAudio();
    soundClick();
    $$('.char-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.character = btn.dataset.char;
    $('#btn-start-journey').disabled = false;
  });
});

$('#btn-start-journey').addEventListener('click', () => {
  soundClick();
  const isGirl = state.character === 'girl';
  $('#hero-emoji').textContent = isGirl ? '👧' : '🧒';
  $('#hero-name').textContent = isGirl ? 'Aprendiz exploradora' : 'Aprendiz explorador';
  $('#bridge-walker').textContent = isGirl ? '👧' : '🧒';
  refreshMapNodes();
  showScreen('screen-map');
});

/* ---------------------------------------------------------
   3. MAPA DEL ARCHIPIÉLAGO
   --------------------------------------------------------- */
const mapNodes = [
  { el: () => $('#node-1'), target: 'screen-island-1' },
  { el: () => $('#node-2'), target: 'screen-island-2' },
  { el: () => $('#node-3'), target: 'screen-island-3' },
  { el: () => $('#node-4'), target: 'screen-island-4' }
];

function refreshMapNodes() {
  mapNodes.forEach((n, i) => {
    const el = n.el();
    el.classList.toggle('locked', !state.islandsUnlocked[i]);
    el.classList.toggle('completed', state.islandsCompleted[i]);
  });
}

mapNodes.forEach((n, i) => {
  n.el().addEventListener('click', () => {
    if (!state.islandsUnlocked[i]) return;
    soundClick();
    showScreen(n.target);
  });
});

$$('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

function unlockIsland(index) {
  state.islandsUnlocked[index] = true;
  refreshMapNodes();
}
function completeIsland(index) {
  state.islandsCompleted[index] = true;
  refreshMapNodes();
}

/* ---------------------------------------------------------
   4. DRAG & DROP GENÉRICO (funciona con mouse y con dedo)
   --------------------------------------------------------- */
function makeDraggable(el, onDrop) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ensureAudio();
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // IMPORTANTE: no reparentamos el elemento a document.body durante el
    // arrastre. Con position:fixed ya queda visualmente por encima de todo
    // sin moverse de lugar en el DOM, y así el pointer capture no se pierde
    // (mover un elemento capturado de padre en pleno arrastre hace que
    // algunos navegadores, sobre todo Safari/iOS, corten la captura y el
    // arrastre se "trabe" a mitad de camino).
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* no soportado */ }
    el.classList.add('dragging');
    el.style.position = 'fixed';
    el.style.margin = '0';
    el.style.zIndex = 1000;
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';

    function move(ev) {
      el.style.left = (ev.clientX - offsetX) + 'px';
      el.style.top = (ev.clientY - offsetY) + 'px';
      // ocultamos el propio elemento del "radar" un instante para poder
      // detectar qué hay debajo del cursor (si no, elementFromPoint
      // siempre devolvería la semilla/mineral que estamos arrastrando)
      el.style.pointerEvents = 'none';
      highlightDropTarget(ev.clientX, ev.clientY);
      el.style.pointerEvents = '';
    }
    function up(ev) {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
      clearHighlights();

      el.classList.remove('dragging');
      el.style.pointerEvents = 'none';
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
      el.style.pointerEvents = '';

      const accepted = onDrop(el, dropEl);
      if (!accepted) {
        // como nunca se movió de su contenedor original, con solo quitar
        // los estilos de arrastre vuelve exactamente a su lugar
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.height = '';
        el.style.zIndex = '';
        el.style.margin = '';
      }
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

let lastHighlighted = null;
function highlightDropTarget(x, y) {
  clearHighlights();
  const el = document.elementFromPoint(x, y);
  const target = el && el.closest('.hole, .forge-slot, .ore-supply, .seed-pile');
  if (target) {
    target.classList.add('hover-target');
    lastHighlighted = target;
  }
}
function clearHighlights() {
  if (lastHighlighted) lastHighlighted.classList.remove('hover-target');
  lastHighlighted = null;
}

// coloca un token (semilla/mineral) dentro de un contenedor, limpiando estilos de arrastre
function settleTokenInto(token, container) {
  token.style.position = '';
  token.style.left = '';
  token.style.top = '';
  token.style.width = '';
  token.style.height = '';
  token.style.zIndex = '';
  token.style.margin = '';
  container.appendChild(token);
}

/* ---------------------------------------------------------
   5. ISLA 1 — La Semilla (suma repetida / grupos iguales)
   --------------------------------------------------------- */
const I1_TOTAL_EXERCISES = 6;
let i1 = { exIndex: 0, perHole: 0, holesCount: 0, total: 0 };

const NPC1_LINES = [
  '¡Aprendiz! Los surcos de mi huerto están vacíos y no recuerdo cuántas semillas van en cada uno. ¡Ayúdame a repartirlas en partes iguales!',
  '¡Muy bien hecho! Prueba con este otro surco, a ver si lo logras de nuevo.',
  '¡Los brotes están creciendo! Sigamos repartiendo semillas por igual.',
  'Un surco más y el huerto empezará a florecer. ¡Tú puedes!',
  'Recuerda: todos los surcos deben quedar con la misma cantidad.',
  '¡Última siembra! Después de esta, el huerto volverá a la vida.'
];

function newIsland1Exercise() {
  i1.holesCount = randInt(2, 5);
  i1.perHole = randInt(2, 9);
  i1.total = i1.holesCount * i1.perHole;

  $('#i1-total').textContent = i1.total;
  $('#i1-holes').textContent = i1.holesCount;
  $('#i1-npc-text').textContent = NPC1_LINES[Math.min(i1.exIndex, NPC1_LINES.length - 1)];
  $('#i1-equation').innerHTML = '&nbsp;';

  const pile = $('#i1-pile');
  const holesRow = $('#i1-holes-row');
  pile.innerHTML = '';
  holesRow.innerHTML = '';

  for (let i = 0; i < i1.total; i++) {
    const seed = document.createElement('div');
    seed.className = 'seed';
    seed.textContent = '🌱';
    makeDraggable(seed, island1TryDrop);
    pile.appendChild(seed);
  }

  for (let h = 0; h < i1.holesCount; h++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.dataset.count = '0';
    const countLabel = document.createElement('span');
    countLabel.className = 'hole-count';
    countLabel.textContent = '0';
    hole.appendChild(countLabel);
    holesRow.appendChild(hole);
  }
}

function island1TryDrop(seedEl, dropEl) {
  const pile = $('#i1-pile');
  if (dropEl && dropEl.closest('#i1-pile')) {
    settleTokenInto(seedEl, pile);
    island1Recalc();
    return true;
  }
  const hole = dropEl ? dropEl.closest('.hole') : null;
  if (hole && $('#i1-holes-row').contains(hole)) {
    const current = parseInt(hole.dataset.count, 10);
    if (current >= 12) return false; // límite visual de seguridad
    hole.insertBefore(seedEl, hole.querySelector('.hole-count'));
    seedEl.style.position = '';
    seedEl.style.left = '';
    seedEl.style.top = '';
    seedEl.style.width = '';
    seedEl.style.height = '';
    seedEl.style.zIndex = '';
    seedEl.style.margin = '';
    island1Recalc();
    return true;
  }
  return false;
}

function island1Recalc() {
  const holes = $$('#i1-holes-row .hole');
  holes.forEach(h => {
    const count = h.querySelectorAll('.seed').length;
    h.dataset.count = count;
    h.querySelector('.hole-count').textContent = count;
    h.classList.remove('correct');
  });

  const pileLeft = $('#i1-pile').querySelectorAll('.seed').length;
  if (pileLeft > 0) return; // aún faltan semillas por colocar

  const counts = holes.map(h => parseInt(h.dataset.count, 10));
  const allEqual = counts.every(c => c === counts[0]) && counts[0] > 0;

  if (allEqual) {
    holes.forEach(h => h.classList.add('correct'));
    const perHole = counts[0];
    const sumStr = counts.map(() => perHole).join(' + ');
    $('#i1-equation').textContent = `${sumStr} = ${i1.total}   →   ${perHole} × ${holes.length} = ${i1.total}`;
    soundOk();
    toast('i1-toast', '¡Perfecto! Surco en orden 🌾');
    i1.exIndex++;
    setTimeout(() => {
      if (i1.exIndex >= I1_TOTAL_EXERCISES) {
        finishIsland1();
      } else {
        $('#i1-progress').textContent = i1.exIndex;
        newIsland1Exercise();
      }
    }, 1400);
  } else {
    soundBad();
    toast('i1-toast', 'No quedaron parejos, ¡vuelve a repartir!', true, 1600);
    setTimeout(() => {
      // devolver todas las semillas a la pila para reintentar
      const pile = $('#i1-pile');
      $$('#i1-holes-row .seed').forEach(s => settleTokenInto(s, pile));
      island1Recalc();
    }, 1100);
  }
}

function finishIsland1() {
  completeIsland(0);
  $('#i1-progress').textContent = I1_TOTAL_EXERCISES;
  soundWin();
  showScreen('screen-bridge');
}

$('#i1-reset').addEventListener('click', () => {
  const pile = $('#i1-pile');
  $$('#i1-holes-row .seed').forEach(s => settleTokenInto(s, pile));
  island1Recalc();
});

screenHooks['screen-island-1'] = {
  onEnter: () => {
    i1.exIndex = 0;
    $('#i1-progress').textContent = 0;
    newIsland1Exercise();
  }
};

/* ---------------------------------------------------------
   6. TRANSICIÓN 1 — El Puente Colgante
   --------------------------------------------------------- */
let bridge = { progress: 0, holding: false, rafId: null, gustTimer: null };

function updateBridgeUI() {
  $('#bridge-progress').style.width = bridge.progress + '%';
  $('#bridge-walker').style.left = (4 + bridge.progress * 0.9) + '%';
}

function bridgeTick() {
  if (bridge.holding) {
    bridge.progress = Math.min(100, bridge.progress + 0.55);
    updateBridgeUI();
    if (bridge.progress >= 100) {
      finishBridge();
      return;
    }
  }
  bridge.rafId = requestAnimationFrame(bridgeTick);
}

function bridgeRelease() {
  if (!bridge.holding) return;
  bridge.holding = false;
  $('#bridge-hold-btn').classList.remove('active');
  if (bridge.progress < 100) {
    bridge.progress = 0;
    updateBridgeUI();
    soundBad();
    $('#bridge-wind-msg').textContent = '💨 ¡El viento te empujó hasta el inicio! Vuelve a sujetarte.';
  }
}

function bridgeHold() {
  if (bridge.holding) return;
  ensureAudio();
  bridge.holding = true;
  $('#bridge-hold-btn').classList.add('active');
  $('#bridge-wind-msg').textContent = '';
}

function finishBridge() {
  cancelAnimationFrame(bridge.rafId);
  clearInterval(bridge.gustTimer);
  bridge.holding = false;
  unlockIsland(1);
  soundWin();
  showScreen('screen-island-2');
}

$('#bridge-hold-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); bridgeHold(); });
$('#bridge-hold-btn').addEventListener('pointerup', bridgeRelease);
$('#bridge-hold-btn').addEventListener('pointercancel', bridgeRelease);
$('#bridge-hold-btn').addEventListener('pointerleave', bridgeRelease);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && currentScreenId === 'screen-bridge') { e.preventDefault(); bridgeHold(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && currentScreenId === 'screen-bridge') { e.preventDefault(); bridgeRelease(); }
});

screenHooks['screen-bridge'] = {
  onEnter: () => {
    bridge.progress = 0;
    bridge.holding = false;
    updateBridgeUI();
    $('#bridge-wind-msg').textContent = '';
    bridgeTick();
    bridge.gustTimer = setInterval(() => {
      if (currentScreenId !== 'screen-bridge') return;
      if (Math.random() < 0.5 && bridge.holding) {
        $('#bridge-wind-msg').textContent = '💨 ¡Ráfaga fuerte! Sigue sujetándote...';
        setTimeout(() => { if ($('#bridge-wind-msg').textContent.includes('Ráfaga')) $('#bridge-wind-msg').textContent = ''; }, 1000);
      }
    }, 2200);
  },
  onExit: () => {
    cancelAnimationFrame(bridge.rafId);
    clearInterval(bridge.gustTimer);
  }
};

/* ---------------------------------------------------------
   7. ISLA 2 — Templo de los Espejos (conmutatividad AxB=BxA)
   --------------------------------------------------------- */
const I2_TOTAL_EXERCISES = 5;
let i2 = { exIndex: 0, a: 3, b: 5, filled: 0 };

function newIsland2Exercise() {
  i2.a = randInt(2, 6);
  i2.b = randInt(2, 6);
  i2.filled = 0;

  $('#i2-label-a').textContent = `${i2.a} × ${i2.b}`;
  $('#i2-label-b').textContent = `${i2.b} × ${i2.a}`;
  $('#i2-equation').innerHTML = '&nbsp;';

  const gridA = $('#i2-grid-a');
  gridA.style.gridTemplateColumns = `repeat(${i2.b}, 26px)`;
  gridA.innerHTML = '';
  for (let i = 0; i < i2.a * i2.b; i++) {
    const cell = document.createElement('div');
    cell.className = 'crystal-cell filled';
    cell.textContent = '🔷';
    gridA.appendChild(cell);
  }

  const gridB = $('#i2-grid-b');
  gridB.style.gridTemplateColumns = `repeat(${i2.a}, 26px)`;
  gridB.innerHTML = '';
  for (let i = 0; i < i2.b * i2.a; i++) {
    const cell = document.createElement('div');
    cell.className = 'crystal-cell clickable';
    cell.addEventListener('click', () => toggleCrystalCell(cell));
    gridB.appendChild(cell);
  }
}

function toggleCrystalCell(cell) {
  ensureAudio();
  const nowFilled = !cell.classList.contains('filled');
  cell.classList.toggle('filled', nowFilled);
  cell.textContent = nowFilled ? '🔷' : '';
  i2.filled += nowFilled ? 1 : -1;
  soundClick();

  const total = i2.a * i2.b;
  if (i2.filled === total) {
    $('#i2-equation').textContent = `${i2.a} × ${i2.b} = ${i2.b} × ${i2.a} = ${total}`;
    soundOk();
    toast('i2-toast', '¡Los cristales resuenan al unísono! ✨');
    $$('#i2-grid-b .crystal-cell').forEach(c => c.classList.remove('clickable'));
    i2.exIndex++;
    setTimeout(() => {
      if (i2.exIndex >= I2_TOTAL_EXERCISES) {
        finishIsland2();
      } else {
        $('#i2-progress').textContent = i2.exIndex;
        newIsland2Exercise();
      }
    }, 1500);
  }
}

function finishIsland2() {
  completeIsland(1);
  $('#i2-progress').textContent = I2_TOTAL_EXERCISES;
  soundWin();
  showScreen('screen-maze');
}

screenHooks['screen-island-2'] = {
  onEnter: () => {
    i2.exIndex = 0;
    $('#i2-progress').textContent = 0;
    newIsland2Exercise();
  }
};

/* ---------------------------------------------------------
   8. TRANSICIÓN 2 — El Laberinto de Piedra
   --------------------------------------------------------- */
// Laberinto validado manualmente (7x7), con camino garantizado S -> E
const MAZE = [
  '#######',
  '#S....#',
  '###.#.#',
  '#...#.#',
  '#.#####',
  '#.....#',
  '#####E#'
];

let maze = { grid: [], player: { r: 0, c: 0 }, exit: { r: 0, c: 0 } };

function buildMaze() {
  maze.grid = MAZE.map(row => row.split(''));
  for (let r = 0; r < maze.grid.length; r++) {
    for (let c = 0; c < maze.grid[r].length; c++) {
      if (maze.grid[r][c] === 'S') { maze.player = { r, c }; maze.grid[r][c] = '.'; }
      if (maze.grid[r][c] === 'E') { maze.exit = { r, c }; }
    }
  }
  renderMaze();
}

function renderMaze() {
  const rows = maze.grid.length, cols = maze.grid[0].length;
  const container = $('#maze-grid');
  container.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
  container.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const isWall = maze.grid[r][c] === '#';
      const isExit = r === maze.exit.r && c === maze.exit.c;
      const isPlayer = r === maze.player.r && c === maze.player.c;
      cell.className = 'maze-cell' + (isWall ? ' wall' : '') + (isExit ? ' exit' : '') + (isPlayer ? ' player' : '');
      if (isPlayer) cell.textContent = state.character === 'girl' ? '👧' : '🧒';
      else if (isExit) cell.textContent = '⚒️';
      container.appendChild(cell);
    }
  }
}

function tryMovePlayer(dr, dc) {
  const nr = maze.player.r + dr, nc = maze.player.c + dc;
  if (nr < 0 || nc < 0 || nr >= maze.grid.length || nc >= maze.grid[0].length) return;
  if (maze.grid[nr][nc] === '#') return;
  maze.player = { r: nr, c: nc };
  soundClick();
  renderMaze();
  if (nr === maze.exit.r && nc === maze.exit.c) {
    setTimeout(finishMaze, 300);
  }
}

function finishMaze() {
  unlockIsland(2);
  soundWin();
  showScreen('screen-island-3');
}

$$('.dpad-btn[data-dir]').forEach(btn => {
  btn.addEventListener('click', () => {
    const dir = btn.dataset.dir;
    if (dir === 'up') tryMovePlayer(-1, 0);
    if (dir === 'down') tryMovePlayer(1, 0);
    if (dir === 'left') tryMovePlayer(0, -1);
    if (dir === 'right') tryMovePlayer(0, 1);
  });
});

function mazeKeyHandler(e) {
  if (currentScreenId !== 'screen-maze') return;
  if (e.key === 'ArrowUp') { e.preventDefault(); tryMovePlayer(-1, 0); }
  if (e.key === 'ArrowDown') { e.preventDefault(); tryMovePlayer(1, 0); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); tryMovePlayer(0, -1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); tryMovePlayer(0, 1); }
}
window.addEventListener('keydown', mazeKeyHandler);

screenHooks['screen-maze'] = { onEnter: buildMaze };

/* ---------------------------------------------------------
   9. ISLA 3 — Forja de los Elementos (descomposición)
   --------------------------------------------------------- */
const I3_TOTAL_EXERCISES = 5;
let i3 = { exIndex: 0, a: 7, b: 8, slot1: null, slot2: null };

function newIsland3Exercise() {
  i3.a = randInt(2, 9);
  i3.b = randInt(4, 9); // necesitamos margen para poder partirlo en dos
  i3.slot1 = null;
  i3.slot2 = null;

  $('#i3-a').textContent = i3.a;
  $('#i3-b').textContent = i3.b;
  $('#i3-a-chip').textContent = `${i3.a} ×`;
  $('#i3-a-chip2').textContent = `${i3.a} ×`;
  $('#i3-equation').innerHTML = '&nbsp;';
  $('#i3-answer-row').hidden = true;

  const slot1 = $('#i3-slot1'); const slot2 = $('#i3-slot2');
  slot1.textContent = '?'; slot1.classList.remove('filled');
  slot2.textContent = '?'; slot2.classList.remove('filled');

  const supply = $('#i3-supply');
  supply.innerHTML = '';
  const numbers = shuffle(Array.from({ length: i3.b - 1 }, (_, i) => i + 1));
  numbers.forEach(n => {
    const chip = document.createElement('div');
    chip.className = 'ore-chip';
    chip.textContent = n;
    chip.dataset.value = n;
    makeDraggable(chip, island3TryDrop);
    supply.appendChild(chip);
  });
}

function island3TryDrop(chipEl, dropEl) {
  const supply = $('#i3-supply');
  if (dropEl && dropEl.closest('#i3-supply')) {
    returnChipFromSlot(chipEl);
    settleTokenInto(chipEl, supply);
    island3Recalc();
    return true;
  }
  const slot = dropEl ? dropEl.closest('.forge-slot') : null;
  if (slot) {
    const slotNum = slot.dataset.slot;
    // si el slot ya tiene un mineral, lo regresamos a la reserva primero
    const currentValEl = slotNum === '1' ? i3.slot1 : i3.slot2;
    if (currentValEl && currentValEl !== chipEl) {
      settleTokenInto(currentValEl, supply);
    }
    returnChipFromSlot(chipEl);
    slot.innerHTML = '';
    slot.appendChild(chipEl);
    chipEl.style.position = '';
    chipEl.style.left = '';
    chipEl.style.top = '';
    chipEl.style.width = '';
    chipEl.style.height = '';
    chipEl.style.zIndex = '';
    chipEl.style.margin = '';
    slot.classList.add('filled');
    if (slotNum === '1') i3.slot1 = chipEl; else i3.slot2 = chipEl;
    island3Recalc();
    return true;
  }
  return false;
}

function returnChipFromSlot(chipEl) {
  if (i3.slot1 === chipEl) { i3.slot1 = null; $('#i3-slot1').classList.remove('filled'); $('#i3-slot1').textContent='?'; }
  if (i3.slot2 === chipEl) { i3.slot2 = null; $('#i3-slot2').classList.remove('filled'); $('#i3-slot2').textContent='?'; }
}

function island3Recalc() {
  $('#i3-answer-row').hidden = true;
  if (!i3.slot1 || !i3.slot2) return;
  const v1 = parseInt(i3.slot1.dataset.value, 10);
  const v2 = parseInt(i3.slot2.dataset.value, 10);
  if (v1 + v2 !== i3.b) {
    $('#i3-equation').textContent = `${v1} + ${v2} = ${v1 + v2} … ¡debe sumar ${i3.b}! Intenta otra combinación.`;
    return;
  }
  const p1 = i3.a * v1, p2 = i3.a * v2, final = p1 + p2;
  $('#i3-equation').textContent = `${i3.a}×${v1} + ${i3.a}×${v2} = ${p1} + ${p2} = ${final}`;
  soundClick();

  $('#i3-final-eq').textContent = `${i3.a} × ${i3.b}`;
  const options = shuffle([final, final + i3.a, Math.max(1, final - i3.a), final + (i3.a > 2 ? 2 : 3)]);
  const optionsRow = $('#i3-options');
  optionsRow.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'mc-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => island3Answer(btn, opt, final));
    optionsRow.appendChild(btn);
  });
  $('#i3-answer-row').hidden = false;
}

function island3Answer(btn, chosen, correct) {
  ensureAudio();
  const buttons = $$('#i3-options .mc-btn');
  buttons.forEach(b => b.disabled = true);
  if (chosen === correct) {
    btn.classList.add('correct');
    soundOk();
    toast('i3-toast', '¡Cristal forjado con éxito! 🔥');
    i3.exIndex++;
    setTimeout(() => {
      if (i3.exIndex >= I3_TOTAL_EXERCISES) {
        finishIsland3();
      } else {
        $('#i3-progress').textContent = i3.exIndex;
        newIsland3Exercise();
      }
    }, 1500);
  } else {
    btn.classList.add('wrong');
    soundBad();
    toast('i3-toast', 'Ese no es el resultado, ¡observa el yunque otra vez!', true);
    setTimeout(() => { buttons.forEach(b => { b.disabled = false; b.classList.remove('wrong'); }); }, 900);
  }
}

function finishIsland3() {
  completeIsland(2);
  $('#i3-progress').textContent = I3_TOTAL_EXERCISES;
  soundWin();
  showScreen('screen-boat');
}

$('#i3-reset').addEventListener('click', () => {
  const supply = $('#i3-supply');
  if (i3.slot1) settleTokenInto(i3.slot1, supply);
  if (i3.slot2) settleTokenInto(i3.slot2, supply);
  i3.slot1 = null; i3.slot2 = null;
  $('#i3-slot1').classList.remove('filled'); $('#i3-slot1').textContent = '?';
  $('#i3-slot2').classList.remove('filled'); $('#i3-slot2').textContent = '?';
  island3Recalc();
});

screenHooks['screen-island-3'] = {
  onEnter: () => {
    i3.exIndex = 0;
    $('#i3-progress').textContent = 0;
    newIsland3Exercise();
  }
};

/* ---------------------------------------------------------
   10. TRANSICIÓN 3 — Mar de las Rocas Flotantes (bote)
   --------------------------------------------------------- */
let boat = {
  x: 180, width: 46, height: 30, speed: 3.4,
  keys: { left: false, right: false },
  obstacles: [], progress: 0, spawnTimer: 0, rafId: null, running: false
};

function boatReset() {
  boat.x = 180; boat.progress = 0; boat.obstacles = []; boat.spawnTimer = 0;
  boat.keys.left = false; boat.keys.right = false;
  $('#boat-progress').style.width = '0%';
}

function boatSpawnObstacle() {
  const canvas = $('#boat-canvas');
  const x = randInt(20, canvas.width - 20);
  const size = randInt(16, 26);
  boat.obstacles.push({ x, y: -size, size });
}

function boatLoop() {
  const canvas = $('#boat-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // mover bote
  if (boat.keys.left) boat.x -= boat.speed;
  if (boat.keys.right) boat.x += boat.speed;
  boat.x = Math.max(24, Math.min(w - 24, boat.x));

  // avance automático
  boat.progress = Math.min(100, boat.progress + 0.16);
  $('#boat-progress').style.width = boat.progress + '%';

  // obstáculos
  boat.spawnTimer++;
  if (boat.spawnTimer > 55) { boatSpawnObstacle(); boat.spawnTimer = 0; }
  const boatTop = h - 70, boatBottom = h - 30;

  boat.obstacles.forEach(o => { o.y += 3.1; });
  const survivors = [];
  for (const o of boat.obstacles) {
    const hit = Math.abs(o.x - boat.x) < (o.size / 2 + boat.width / 2 - 6) &&
                (o.y + o.size / 2) > boatTop && (o.y - o.size / 2) < boatBottom;
    if (hit) {
      boat.progress = Math.max(0, boat.progress - 6);
      $('#boat-progress').style.width = boat.progress + '%';
      soundBad();
      continue; // el obstáculo se elimina al golpear
    }
    if (o.y < h + 40) survivors.push(o);
  }
  boat.obstacles = survivors;

  // --- dibujar ---
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#274472'); grad.addColorStop(1, '#3A6EA5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const waveOffset = (Date.now() / 300) % 40;
  for (let y = -40 + waveOffset; y < h; y += 40) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, y + Math.sin((x + Date.now() / 200) / 30) * 4);
    }
    ctx.stroke();
  }

  // rocas
  boat.obstacles.forEach(o => {
    ctx.fillStyle = '#6B5A4A';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E332A';
    ctx.stroke();
  });

  // bote (forma sencilla tipo pixel-art)
  ctx.fillStyle = '#C9541C';
  ctx.beginPath();
  ctx.moveTo(boat.x - boat.width / 2, h - 34);
  ctx.lineTo(boat.x + boat.width / 2, h - 34);
  ctx.lineTo(boat.x + boat.width / 2 - 8, h - 18);
  ctx.lineTo(boat.x - boat.width / 2 + 8, h - 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF8EC';
  ctx.beginPath();
  ctx.moveTo(boat.x, h - 70);
  ctx.lineTo(boat.x + 16, h - 36);
  ctx.lineTo(boat.x - 4, h - 36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7A3E17';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(boat.x, h - 70); ctx.lineTo(boat.x, h - 36); ctx.stroke();

  if (boat.progress >= 100) {
    finishBoat();
    return;
  }
  if (boat.running) boat.rafId = requestAnimationFrame(boatLoop);
}

function finishBoat() {
  boat.running = false;
  cancelAnimationFrame(boat.rafId);
  unlockIsland(3);
  soundWin();
  showScreen('screen-island-4');
}

function boatKeyDown(e) {
  if (currentScreenId !== 'screen-boat') return;
  if (e.key === 'ArrowLeft') { boat.keys.left = true; e.preventDefault(); }
  if (e.key === 'ArrowRight') { boat.keys.right = true; e.preventDefault(); }
}
function boatKeyUp(e) {
  if (e.key === 'ArrowLeft') boat.keys.left = false;
  if (e.key === 'ArrowRight') boat.keys.right = false;
}
window.addEventListener('keydown', boatKeyDown);
window.addEventListener('keyup', boatKeyUp);

$$('.dpad-btn[data-boatdir]').forEach(btn => {
  const dir = btn.dataset.boatdir;
  const setDir = (v) => { if (dir === 'left') boat.keys.left = v; if (dir === 'right') boat.keys.right = v; };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); setDir(true); });
  btn.addEventListener('pointerup', () => setDir(false));
  btn.addEventListener('pointercancel', () => setDir(false));
  btn.addEventListener('pointerleave', () => setDir(false));
});

screenHooks['screen-boat'] = {
  onEnter: () => { boatReset(); boat.running = true; boatLoop(); },
  onExit: () => { boat.running = false; cancelAnimationFrame(boat.rafId); boat.keys.left = false; boat.keys.right = false; }
};

/* ---------------------------------------------------------
   11. ISLA 4 — El Faro (prueba final, 10 preguntas)
   --------------------------------------------------------- */
const I4_TOTAL_EXERCISES = 10;
let i4 = { exIndex: 0, a: 6, b: 7 };

function newIsland4Question() {
  i4.a = randInt(2, 9);
  i4.b = randInt(2, 9);
  const correct = i4.a * i4.b;
  $('#i4-question').textContent = `${i4.a} × ${i4.b} = ?`;

  const distractors = new Set();
  const candidates = [correct + i4.a, correct - i4.a, correct + i4.b, correct - i4.b, correct + 1, correct - 1];
  for (const c of candidates) {
    if (c > 0 && c !== correct) distractors.add(c);
    if (distractors.size >= 3) break;
  }
  const options = shuffle([correct, ...Array.from(distractors).slice(0, 3)]);

  const row = $('#i4-options');
  row.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'mc-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => island4Answer(btn, opt, correct));
    row.appendChild(btn);
  });
}

function island4Answer(btn, chosen, correct) {
  ensureAudio();
  const buttons = $$('#i4-options .mc-btn');
  buttons.forEach(b => b.disabled = true);
  if (chosen === correct) {
    btn.classList.add('correct');
    soundOk();
    i4.exIndex++;
    $('#i4-progress').textContent = i4.exIndex;
    $('#i4-meter').style.width = (i4.exIndex / I4_TOTAL_EXERCISES * 100) + '%';
    toast('i4-toast', '¡El Cristal Mayor brilla un poco más! 💡');
    setTimeout(() => {
      if (i4.exIndex >= I4_TOTAL_EXERCISES) finishIsland4();
      else newIsland4Question();
    }, 1200);
  } else {
    btn.classList.add('wrong');
    soundBad();
    toast('i4-toast', 'Casi... ¡inténtalo de nuevo!', true);
    setTimeout(() => { buttons.forEach(b => { b.disabled = false; b.classList.remove('wrong'); }); }, 800);
  }
}

function finishIsland4() {
  completeIsland(3);
  soundWin();
  showScreen('screen-end');
}

screenHooks['screen-island-4'] = {
  onEnter: () => {
    i4.exIndex = 0;
    $('#i4-progress').textContent = 0;
    $('#i4-meter').style.width = '0%';
    newIsland4Question();
  }
};

/* ---------------------------------------------------------
   12. PANTALLA FINAL
   --------------------------------------------------------- */
$('#btn-play-again').addEventListener('click', () => location.reload());

/* ---------------------------------------------------------
   Inicio
   --------------------------------------------------------- */
showScreen('screen-start');