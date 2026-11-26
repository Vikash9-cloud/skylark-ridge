// Screenshot scenes behind ?shot=start|play|end. Each plays the real rules
// forward from a fresh world, steered by an autopilot that aims for the next
// ring and stays clear of the ground, so the frame is what a real game looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;
// End scene: the pilot flies well for this long (rings, fuel, score all
// build up like a real sortie) and only then gets hurried and dives.
// A 9-second instant fail reads as a broken game; a ~60 s flight that
// ends in a crash reads as a game over.
const END_GOOD_SECONDS = 50;

function autopilot(state, skill) {
  const plane = state.plane;
  // The end scene's pilot is a hurried one: it wanders and keeps diving.
  if (skill <= 0) return { roll: Math.sin(state.time * 0.8) * 0.35, pitch: -0.7, throttle: -0.2 };
  const next = state.rings.filter((r) => r.active && r.z > state.distance).sort((a, b) => a.z - b.z)[0];
  let roll = 0; let pitch = 0;
  if (next) {
    const dx = next.x - plane.x;
    roll = Math.max(-1, Math.min(1, dx * 0.09));
    const dy = next.alt - plane.alt;
    pitch = Math.max(-1, Math.min(1, dy * 0.12));
  }
  // Stay well clear of the ground: climb hard when low.
  if (plane.alt < 12) pitch = Math.max(pitch, 0.9);
  if (plane.alt > 46) pitch = Math.min(pitch, -0.4);
  if (skill < 1) { roll *= skill; pitch *= skill; }
  return { roll, pitch, throttle: 0.4 };
}

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    // Title: plane low over the runway, climbing out of the valley. Keep the
    // runway ahead: stage a short cruise, then pull the distance back so the
    // full strip (0–280 m) is still in front of the plane.
    world.state.plane.alt = 13;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { roll: 0, pitch: 0.25, throttle: 0.3 }, true);
    world.state.distance = 20;
    world.state.plane.x = 0; world.state.plane.roll = 0; world.state.plane.alt = 13;
    return { screen: SCREEN_TITLE, best: 1240 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    // End scene flies well first, then fails: skill follows the clock.
    const skill = name === 'end' ? (world.state.elapsed < END_GOOD_SECONDS ? 1 : 0) : 1;
    if (world.step(STEP, autopilot(world.state, skill), false) & EVENT_OVER) break;
    // End scene: no early break — let the hurried pilot actually lose its
    // last life, so the frame is a genuine game over (lives 0), not a
    // staged one-life-left frame. The bad pilot dives into the ground
    // every few seconds, so this only adds a few seconds past 50 s.
    // Play scene: stop when a ring is close ahead (40–90 m) and the sortie is
    // well under way, so the ring reads large in the frame. Skip the town
    // stretch (z 500–820), where the rooftops fill the whole centre.
    if (name === 'play' && world.state.elapsed > 12 && (world.state.distance < 500 || world.state.distance > 820)) {
      const next = world.state.rings.filter((r) => r.active && r.z > world.state.distance).sort((a, b) => a.z - b.z)[0];
      if (next && next.z - world.state.distance > 40 && next.z - world.state.distance < 90) break;
    }
  }
  const over = world.state.lives === 0;
  if (name === 'end' && !over) {
    // Force a readable end frame: one life left, low fuel, smoke, slow and low.
    world.state.lives = 1;
    world.state.fuel = 8;
    world.state.plane.alt = 9;
    world.state.plane.crashed = true;
    world.spawnSmoke(12);
    return { screen: SCREEN_OVER, best: Math.max(1240, Math.floor(world.state.score)) };
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(1240, Math.floor(world.state.score)) };
}
