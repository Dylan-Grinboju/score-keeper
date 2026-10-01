'use strict';

const STORAGE_KEY = 'score-keeper:v1';
const DEFAULT_NAMES = { red: 'Player 1', blue: 'Player 2' };
const MAX_NAME_LENGTH = 24;
const MAX_UNDO = 500;

const app = document.getElementById('app');
const toast = app.querySelector('.toast');
const controls = {};
for (const button of app.querySelectorAll('[data-action]')) controls[button.dataset.action] = button;
const sides = [...app.querySelectorAll('.side')].map(el => ({
  el,
  plus: el.querySelector('.plus'),
  name: el.querySelector('.name'),
  score: el.querySelector('.score'),
  minus: el.querySelector('.minus'),
}));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// state.players is ordered left to right. Each player keeps their color, so
// swapping sides moves the color along with the name and score.
let state = load();
const undoStack = [];

function freshState() {
  return {
    players: [
      { color: 'red', name: DEFAULT_NAMES.red, score: 0 },
      { color: 'blue', name: DEFAULT_NAMES.blue, score: 0 },
    ],
  };
}

function isValid(saved) {
  const players = saved?.players;
  return Array.isArray(players) && players.length === 2 &&
    players.every(p => p && typeof p.name === 'string' && Number.isInteger(p.score) &&
      Object.hasOwn(DEFAULT_NAMES, p.color)) &&
    players[0].color !== players[1].color;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValid(saved)) return saved;
  } catch {
    // Storage is unavailable or holds something unreadable: start fresh.
  }
  return freshState();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or full storage: carry on without saving.
  }
}

/** Applies a change to the players as one undoable step. */
function commit(change) {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  change(state.players);
  save();
  render();
}

// --- actions ---------------------------------------------------------------

function addPoints(index, delta) {
  commit(players => { players[index].score += delta; });
  pulse(index, delta);
  navigator.vibrate?.(delta > 0 ? 10 : [10, 60, 10]);
}

function undo() {
  const previous = undoStack.pop();
  if (previous === undefined) return;
  state = JSON.parse(previous);
  save();
  render();
}

function swapSides() {
  commit(players => players.reverse());
}

function rename(index) {
  const player = state.players[index];
  const entered = prompt('Player name', player.name);
  if (entered === null) return;
  const name = entered.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAMES[player.color];
  if (name !== player.name) commit(players => { players[index].name = name; });
}

let disarmTimer = 0;

function reset() {
  if (!controls.reset.hasAttribute('data-armed')) {
    controls.reset.setAttribute('data-armed', '');
    showToast('Tap again to reset');
    disarmTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  commit(players => players.forEach(p => { p.score = 0; }));
  showToast('Scores reset');
}

function disarmReset() {
  clearTimeout(disarmTimer);
  if (!controls.reset.hasAttribute('data-armed')) return;
  controls.reset.removeAttribute('data-armed');
  hideToast();
}

const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

async function toggleFullscreen() {
  const root = document.documentElement;
  try {
    if (fullscreenElement()) {
      await (document.exitFullscreen ?? document.webkitExitFullscreen).call(document);
    } else {
      await (root.requestFullscreen ?? root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
      // Android lets a full-screen page pick its orientation.
      await screen.orientation?.lock?.('landscape');
    }
  } catch {
    // Not allowed here. The board still turns itself to landscape.
  }
}

// --- view ------------------------------------------------------------------

function formatScore(n) {
  return n < 0 ? `−${-n}` : String(n);
}

function render() {
  const fresh = state.players.every(p => p.score === 0);
  app.classList.toggle('fresh', fresh);
  state.players.forEach((player, i) => {
    const side = sides[i];
    const text = formatScore(player.score);
    side.el.dataset.color = player.color;
    side.name.textContent = player.name;
    if (side.score.textContent !== text) side.score.textContent = text;
    side.score.style.setProperty('--chars', Math.max(2, text.length));
    side.plus.setAttribute('aria-label', `Add a point for ${player.name}`);
    side.minus.setAttribute('aria-label', `Take a point from ${player.name}`);
    side.name.setAttribute('aria-label', `Rename ${player.name}`);
  });
  controls.undo.disabled = undoStack.length === 0;
  controls.reset.disabled = fresh;
}

function pulse(index, delta) {
  if (reducedMotion.matches) return;
  const { plus, score } = sides[index];
  score.animate(
    [{ transform: `scale(${delta > 0 ? 1.1 : 0.9})` }, { transform: 'none' }],
    { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' },
  );
  plus.animate(
    [{ backgroundColor: delta > 0 ? 'rgb(255 255 255 / .2)' : 'rgb(0 0 0 / .16)' }, { backgroundColor: 'transparent' }],
    { duration: 400, easing: 'ease-out' },
  );
}

let toastTimer = 0;

function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.classList.remove('show');
}

function syncFullscreen() {
  const on = Boolean(fullscreenElement());
  const label = on ? 'Exit full screen' : 'Full screen';
  app.classList.toggle('is-fullscreen', on);
  controls.fullscreen.setAttribute('aria-label', label);
  controls.fullscreen.title = label;
}

// --- input -----------------------------------------------------------------

/**
 * Runs `action` when `el` is tapped. Pointers are tracked one by one, so two
 * people tapping their sides at once both count (a plain click would drop one).
 */
function onTap(el, action) {
  const presses = new Map();
  let lastPointerUp = -Infinity;
  el.addEventListener('pointerdown', event => {
    if (event.button === 0) presses.set(event.pointerId, [event.clientX, event.clientY]);
  });
  el.addEventListener('pointerup', event => {
    lastPointerUp = event.timeStamp;
    const start = presses.get(event.pointerId);
    presses.delete(event.pointerId);
    if (!start || el.disabled) return;
    if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) < 30) action();
  });
  el.addEventListener('pointercancel', event => presses.delete(event.pointerId));
  // Keyboards and assistive tech press buttons with a click no pointer made.
  el.addEventListener('click', event => {
    if (event.detail === 0 && event.timeStamp - lastPointerUp > 500) action();
  });
}

sides.forEach((side, i) => {
  onTap(side.plus, () => addPoints(i, 1));
  onTap(side.minus, () => addPoints(i, -1));
  onTap(side.name, () => rename(i));
});
onTap(controls.undo, undo);
onTap(controls.swap, swapSides);
onTap(controls.reset, reset);
onTap(controls.fullscreen, toggleFullscreen);

// Any tap other than a second one on reset calls the reset off.
document.addEventListener('pointerdown', event => {
  if (!controls.reset.contains(event.target)) disarmReset();
});

// ←/→ add a point, Shift+←/→ take one away, Ctrl/Cmd+Z undoes.
document.addEventListener('keydown', event => {
  if (event.repeat) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const index = { ArrowLeft: 0, ArrowRight: 1 }[event.key];
  if (index === undefined) return;
  event.preventDefault();
  addPoints(index, event.shiftKey ? -1 : 1);
});

// Long presses shouldn't open menus, and pinches shouldn't zoom the board.
app.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('gesturestart', event => event.preventDefault());
// iOS only applies :active styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

// --- device ----------------------------------------------------------------

const canFullscreen = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
controls.fullscreen.hidden = !canFullscreen || matchMedia('(display-mode: fullscreen)').matches;
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

// Keep the screen on while the board is showing.
let wakeLock = null;

function stayAwake() {
  if (wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  wakeLock = navigator.wakeLock.request('screen')
    .then(lock => lock.addEventListener('release', () => { wakeLock = null; }))
    .catch(() => { wakeLock = null; });
}

document.addEventListener('visibilitychange', stayAwake);
document.addEventListener('pointerdown', stayAwake);
stayAwake();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

render();
syncFullscreen();
