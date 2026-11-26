// Skylark Ridge — boot and the one loop. Fixed 1/60 s steps, four screens
// (title, play, paused, game over), synthesised engine sound.
// ?seed=N fixes the world. ?shot=start|play|end stages that scene, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, GAME_NAME, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_LOW_FUEL, EVENT_OVER, EVENT_RING } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private window */ }
}
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}
function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let newBest = false;
  let accumulator = 0;
  let last = performance.now();
  function announce(message) { status.textContent = message; }
  function startGame() {
    world.reset(); accumulator = 0; screen = SCREEN_PLAY; newBest = false;
    sound.startEngine();
    announce(`Playing ${GAME_NAME}. ${LIVES} lives. Fly through the golden rings.`);
  }
  function endGame() {
    screen = SCREEN_OVER; sound.stopEngine(); sound.crash();
    newBest = false;
    if (world.state.score > best) { best = Math.floor(world.state.score); newBest = true; saveBest(best); }
    announce(`Flight over. Score ${Math.floor(world.state.score)}. Best ${best}.`);
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) { const muted = sound.toggleMute(); announce(muted ? 'Sound off.' : 'Sound on.'); }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; sound.stopEngine(); announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; sound.startEngine(); announce('Playing.'); }
  }
  function step() {
    if (screen === SCREEN_TITLE) { world.step(STEP, { roll: 0, pitch: 0, throttle: 0 }, true); return; }
    const events = world.step(STEP, input.control(), false);
    const plane = world.state.plane;
    sound.setEngine(plane.throttle, plane.speed);
    if (events & EVENT_RING) sound.ring(world.state.lastRingGolden);
    if (events & EVENT_HIT) { sound.crash(); announce(world.state.lives === 1 ? 'Hit the ground. 1 life left.' : `Hit the ground. ${world.state.lives} lives left.`); }
    if (events & EVENT_LOW_FUEL) announce('Low fuel. Fly through a ring.');
    if (events & EVENT_OVER) endGame();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) { step(); accumulator -= STEP; }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best, newBest);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; sound.stopEngine(); announce('Paused.'); }
  });
  announce(`${GAME_NAME}. Press Space or click to fly.`);
  requestAnimationFrame(frame);
}
if (shot) runShot(shot);
else runGame();
