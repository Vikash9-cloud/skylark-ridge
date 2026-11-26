// Skylark Ridge rules and state — no drawing, no browser in here.
// Chase-view flight: the plane flies forward down a valley, steering with
// roll (turn) and pitch (climb / descend), throttle for speed, fuel to manage,
// glowing rings to fly through, and ground / mountains that cost a life.
import { FIELD, LIVES, PALETTE, WORLD } from './config.js';

export const EVENT_RING = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_LOW_FUEL = 8;

export function hash2(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, z) {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = x - ix; const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx); const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz); const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1); const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
export function riverX(z) { return 20 * Math.sin(z * 0.006) + 6 * Math.sin(z * 0.017 + 2); }
export function roadX(z) { return -22 + 9 * Math.sin(z * 0.004 + 1); }
export function groundHeightAt(x, z) {
  const hills = smoothNoise(x * 0.045 + 7, z * 0.045) * 7;
  const edge = Math.max(0, (Math.abs(x) - 32) / 14);
  // Valley walls rise to a capped ridge; far-out ground must never tower over
  // the camera and fill the sky with field-coloured slabs.
  const mountains = Math.min(24, edge * edge * 26 * (0.55 + 0.45 * smoothNoise(x * 0.08, z * 0.03)));
  let h = hills * 0.55 + mountains;
  if (Math.abs(x - riverX(z)) < 5) h = Math.min(h, 0.4);
  return Math.max(0, Math.min(28, h));
}
// What a terrain cell at (x, z) is: field colour, road, river, runway, town or forest.
export function terrainCell(x, z) {
  if (z >= 0 && z <= 280 && Math.abs(x) < 5.5) return { kind: 'runway', color: PALETTE.runway };
  if (Math.abs(x - riverX(z)) < 3.5) return { kind: 'river', color: PALETTE.river };
  if (Math.abs(x - roadX(z)) < 1.6) return { kind: 'road', color: PALETTE.road };
  if (z > 560 && z < 780 && Math.abs(x) < 14) return { kind: 'town', color: '#cbb89a' };
  const n = hash2(Math.floor(x / 9), Math.floor(z / 9));
  if (n < 0.12) return { kind: 'forest', color: '#3e7d33' };
  if (n < 0.24) return { kind: 'field', color: PALETTE.fieldWheat };
  if (n < 0.34) return { kind: 'field', color: PALETTE.fieldPlough };
  const greens = PALETTE.fieldGreen;
  return { kind: 'field', color: greens[Math.floor(n * 10) % greens.length] };
}
export function treeAt(x, z) {
  const n = hash2(Math.floor(x / 6), Math.floor(z / 6));
  return n < 0.22 ? n : -1;
}

export function createWorld(random) {
  const plane = { x: 0, alt: 24, pitch: 0, roll: 0, heading: 0, throttle: 0.65, speed: WORLD.baseSpeed, invulnerable: 0, crashed: false };
  const rings = [];
  for (let i = 0; i < 8; i += 1) rings.push({ active: false, z: 0, x: 0, alt: 26, radius: 7, passed: false, golden: false });
  const particles = [];
  for (let i = 0; i < 40; i += 1) particles.push({ active: false, rx: 0, ry: 0, rz: 0, life: 0, size: 1, color: '#5a5a5a' });
  const state = {
    plane, rings, particles, score: 0, lives: LIVES, level: 1, elapsed: 0,
    distance: 0, fuel: WORLD.fuelMax, ringsPassed: 0, ringsMissed: 0,
    nextRingZ: 140, time: 0, lowFuelWarned: false, message: '', messageTimer: 0,
    skimTimer: 0, skimBonus: 0, nearMiss: 0, goldenRings: 0,
    ringFlash: 0, popupText: '', popupTimer: 0, lastRingGolden: false,
  };
  let ringSeed = 0;

  function spawnRing(slot) {
    const ring = rings[slot];
    ring.active = true; ring.passed = false;
    ring.z = state.nextRingZ;
    // Later levels: rings sit wider and get tighter, so later levels
    // demand more precise flying. Level 1-2 are unchanged in feel.
    ring.x = (random() * 2 - 1) * (24 + Math.min(10, state.level * 0.8));
    ring.alt = 18 + random() * 20;
    ring.radius = Math.max(5.5, 9.5 - state.level * 0.45);
    ring.golden = (ringSeed % WORLD.goldenEvery) === (WORLD.goldenEvery - 1);
    state.nextRingZ += WORLD.ringEvery + random() * 40;
    ringSeed += 1;
  }
  function spawnSmoke(count) {
    for (const p of particles) {
      if (count <= 0) break;
      if (p.active) continue;
      p.active = true; p.rx = (random() - 0.5) * 4; p.ry = (random() - 0.5) * 3; p.rz = -2 - random() * 4;
      p.life = 0.9 + random() * 0.7; p.size = 3 + random() * 5; p.color = '#5a5a5a'; count -= 1;
    }
  }
  function spawnBurst(count) {
    for (const p of particles) {
      if (count <= 0) break;
      if (p.active) continue;
      p.active = true; p.rx = (random() - 0.5) * 6; p.ry = (random() - 0.5) * 4; p.rz = -1 - random() * 3;
      p.life = 0.5 + random() * 0.4; p.size = 2 + random() * 3; p.color = '#ffd23e'; count -= 1;
    }
  }
  function reset() {
    plane.x = 0; plane.alt = 14; plane.pitch = 0; plane.roll = 0; plane.heading = 0;
    plane.throttle = 0.65; plane.speed = WORLD.baseSpeed; plane.invulnerable = 0; plane.crashed = false;
    for (const r of rings) r.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.lives = LIVES; state.level = 1; state.elapsed = 0;
    state.distance = 0; state.fuel = WORLD.fuelMax; state.ringsPassed = 0; state.ringsMissed = 0; state.combo = 0;
    state.nextRingZ = 140; state.time = 0; state.lowFuelWarned = false; state.message = ''; state.messageTimer = 0;
    state.skimTimer = 0; state.skimBonus = 0; state.nearMiss = 0; state.goldenRings = 0;
    state.ringFlash = 0; state.popupText = ''; state.popupTimer = 0; state.lastRingGolden = false;
    spawnRing(0); spawnRing(1); spawnRing(2);
  }
  function crash() {
    plane.invulnerable = 2; state.lives -= 1; plane.crashed = true;
    state.skimTimer = 0;
    spawnSmoke(14);
    if (state.lives <= 0) return EVENT_HIT | EVENT_OVER;
    plane.alt = groundHeightAt(plane.x, state.distance) + 14;
    plane.pitch = 0.25; plane.speed *= 0.55; plane.throttle = 0.6;
    return EVENT_HIT;
  }
  // input: { roll:-1..1, pitch:-1..1 (up positive), throttle:-1..1 }
  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;
    if (!harmless) state.elapsed += dt;
    state.level = Math.min(12, 1 + Math.floor(state.elapsed / 20));
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.ringFlash > 0) state.ringFlash = Math.max(0, state.ringFlash - dt * 1.8);
    if (state.popupTimer > 0) state.popupTimer -= dt;
    const inp = input || { roll: 0, pitch: 0, throttle: 0 };
    if (harmless) {
      // Title backdrop: gentle autopilot cruise over the valley, never crashes.
      plane.roll += (Math.sin(state.time * 0.35) * 0.25 - plane.roll) * dt * 2;
      plane.pitch += (Math.sin(state.time * 0.22) * 0.06 - plane.pitch) * dt * 2;
      plane.throttle = 0.6; plane.alt += (26 - plane.alt) * dt * 0.5;
      plane.x += plane.roll * 10 * dt;
      plane.speed = WORLD.baseSpeed;
    } else {
      plane.throttle = Math.min(1, Math.max(0.3, plane.throttle + (inp.throttle || 0) * dt * 0.55));
      const targetRoll = (inp.roll || 0) * 0.85;
      plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 5);
      const targetPitch = (inp.pitch || 0) * 0.32;
      plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 4);
      plane.speed += ((WORLD.baseSpeed * (0.55 + plane.throttle * 0.75) + state.level * 1.1) - plane.speed) * Math.min(1, dt * 1.2);
      if (state.fuel <= 0) plane.speed = Math.max(16, plane.speed - 12 * dt);
      plane.heading = (plane.heading + plane.roll * 26 * dt * (plane.speed / WORLD.baseSpeed) + 360) % 360;
      plane.x = Math.max(-WORLD.maxLateral, Math.min(WORLD.maxLateral, plane.x + plane.roll * 24 * dt * (plane.speed / WORLD.baseSpeed)));
      plane.alt += plane.pitch * plane.speed * dt * 0.85;
      plane.alt = Math.min(WORLD.maxAlt, Math.max(2, plane.alt));
      // Fuel burn grows with level, so late-game fuel is tighter.
      state.fuel = Math.max(0, state.fuel - WORLD.fuelBurn * (0.45 + plane.throttle) * (1 + (state.level - 1) * 0.02) * dt);
      // Ridge Runner: skimming the valley floor fast is risky (one dip
      // into a hill ends the run) and pays +25 every 2 s of continuous skim.
      if (!plane.crashed) {
        const clearance = plane.alt - groundHeightAt(plane.x, state.distance);
        if (clearance < 5 && plane.speed > 42) {
          state.skimTimer += dt;
          if (state.skimTimer >= WORLD.skimSeconds) {
            state.skimTimer = 0; state.skimBonus += WORLD.skimPoints; state.score += WORLD.skimPoints;
            state.message = `RIDGE RUNNER +${WORLD.skimPoints} — skim the valley!`; state.messageTimer = 1.4;
          }
        } else if (clearance > 8) state.skimTimer = 0;
      }
      if (state.fuel < 20 && !state.lowFuelWarned) { state.lowFuelWarned = true; events |= EVENT_LOW_FUEL; state.message = 'LOW FUEL — fly through a ring!'; state.messageTimer = 3; }
      if (state.fuel >= 25) state.lowFuelWarned = false;
    }
    state.distance += plane.speed * dt;
    // Title-backdrop (harmless) cruising must not bank score: the title
    // screen shows Score 0 until the player actually starts flying.
    if (!harmless) state.score += plane.speed * dt * 0.4;
    // Rings: spawn ahead, resolve as the plane passes them.
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (!ring.active) { if (ring.z < state.distance + 900) spawnRing(i); continue; }
      const rel = ring.z - state.distance;
      if (rel < -8) {
        if (!harmless && !ring.passed) { state.ringsMissed += 1; state.combo = 0; }
        ring.active = false; continue;
      }
      if (!harmless && rel <= 0 && !ring.passed) {
        ring.passed = true;
        const dx = plane.x - ring.x; const dy = plane.alt - ring.alt;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ring.radius + 2.5) {
          state.ringsPassed += 1; state.combo += 1;
          let bonus; let label;
          if (ring.golden) {
            bonus = WORLD.goldenPoints + (state.combo - 1) * 15;
            state.goldenRings += 1; label = `GOLDEN RING! +${bonus}`;
            state.fuel = Math.min(WORLD.fuelMax, state.fuel + WORLD.goldenFuel);
          } else if (dist > ring.radius * 0.55) {
            // Threading the edge of a ring is a near miss: riskier, pays more.
            bonus = WORLD.nearMissPoints + (state.combo - 1) * 15;
            state.nearMiss += 1; label = `NEAR MISS! +${bonus}`;
            state.fuel = Math.min(WORLD.fuelMax, state.fuel + WORLD.ringFuel);
          } else {
            bonus = WORLD.ringPoints + (state.combo - 1) * 15;
            label = `RING! +${bonus}`;
            state.fuel = Math.min(WORLD.fuelMax, state.fuel + WORLD.ringFuel);
          }
          state.score += bonus;
          state.lastRingGolden = ring.golden;
          state.ringFlash = 1; state.popupText = `+${bonus}`; state.popupTimer = 1;
          spawnBurst(10);
          state.message = state.combo > 1 ? `${label}  x${state.combo} COMBO` : label;
          state.messageTimer = 1.4;
          events |= EVENT_RING;
        } else { state.combo = 0; }
      }
    }
    // Particles drift backwards past the plane.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt; p.rz -= plane.speed * dt * 0.9; p.ry += dt * 1.5;
      if (p.life <= 0 || p.rz < -60) p.active = false;
    }
    if (plane.invulnerable > 0) plane.invulnerable = Math.max(0, plane.invulnerable - dt);
    if (plane.crashed && plane.invulnerable < 1.2) plane.crashed = false;
    // Ground / mountain collision.
    if (!harmless && plane.invulnerable === 0) {
      const gh = groundHeightAt(plane.x, state.distance);
      if (plane.alt <= gh + 1.2) events |= crash();
    }
    return events;
  }
  reset();
  return { state, reset, step, groundHeightAt, spawnSmoke };
}
