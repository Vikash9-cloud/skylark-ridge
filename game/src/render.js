// Drawing only: the pseudo-3D world, the chase-view aircraft, the lit HUD
// and the title / pause / game-over panels. 1280x720 logical playfield,
// scaled to fit the window.
import { FIELD, FONT, FOCAL, GAME_NAME, LIVES, PALETTE, WORLD } from './config.js';
import { groundHeightAt, hash2, riverX, roadX, terrainCell, treeAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width; canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key); context.fillStyle = color; context.textAlign = align || 'left'; context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function textGlow(value, x, y, size, color, align) {
    context.save(); context.shadowColor = 'rgba(0,0,0,0.65)'; context.shadowBlur = 6; context.shadowOffsetY = 2;
    text(value, x, y, size, color, align, true); context.restore();
  }
  function project(state, wx, wy, relZ) {
    const plane = state.plane;
    const scale = FOCAL / (relZ + 18);
    const horizon = FIELD.horizonY - plane.pitch * 380;
    const heading = plane.heading > 180 ? plane.heading - 360 : plane.heading;
    return { x: 640 + (wx - plane.x) * scale - heading * 2.2, y: horizon - (wy - plane.alt) * scale, s: scale };
  }
  function drawSky(state) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.horizonY + 40);
    g.addColorStop(0, PALETTE.skyTop); g.addColorStop(0.55, PALETTE.skyMid); g.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = g; context.fillRect(0, 0, FIELD.width, FIELD.horizonY + 40);
    // Sun, low and warm on the right.
    const sx = 1010 - state.plane.heading * 1.5; const sy = 118;
    const glow = context.createRadialGradient(sx, sy, 8, sx, sy, 150);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)'); glow.addColorStop(0.35, 'rgba(255,223,138,0.55)'); glow.addColorStop(1, 'rgba(255,223,138,0)');
    context.fillStyle = glow; context.fillRect(sx - 160, sy - 160, 320, 320);
    context.fillStyle = PALETTE.sun; context.beginPath(); context.arc(sx, sy, 34, 0, Math.PI * 2); context.fill();
    // Drifting clouds.
    for (let i = 0; i < 12; i += 1) {
      const h = hash2(i, 3);
      const cx = ((h * 1400 + state.time * (6 + h * 10) - state.distance * 0.12) % 1500 + 1500) % 1500 - 110;
      const cy = 42 + hash2(i, 7) * 170; const cw = 70 + hash2(i, 11) * 90;
      context.fillStyle = 'rgba(255,255,255,0.88)';
      context.beginPath();
      context.ellipse(cx, cy, cw, cw * 0.28, 0, 0, Math.PI * 2);
      context.ellipse(cx + cw * 0.5, cy + 8, cw * 0.55, cw * 0.2, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Birds, far ahead.
    context.strokeStyle = 'rgba(40,50,60,0.85)'; context.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const bx = 240 + hash2(i, 21) * 800 + Math.sin(state.time * 0.7 + i * 2) * 30;
      const by = 150 + hash2(i, 23) * 90; const flap = Math.sin(state.time * 6 + i * 3) * 5;
      context.beginPath(); context.moveTo(bx - 10, by + flap); context.quadraticCurveTo(bx, by - 4, bx, by); context.quadraticCurveTo(bx, by - 4, bx + 10, by + flap); context.stroke();
    }
  }
  function drawMountains(state) {
    const horizon = FIELD.horizonY - state.plane.pitch * 380;
    for (let layer = 0; layer < 2; layer += 1) {
      const base = horizon + layer * 8; const amp = layer === 0 ? 105 : 58;
      const col = layer === 0 ? PALETTE.mountainFar : PALETTE.mountainNear;
      context.fillStyle = col; context.beginPath(); context.moveTo(-20, base + 30);
      const off = state.distance * (layer === 0 ? 0.04 : 0.1);
      for (let x = -20; x <= 1300; x += 40) {
        const peak = base - (hash2(Math.floor((x + off) / 40), layer + 5) * amp + 12);
        context.lineTo(x, peak);
        if (layer === 0) {
          context.lineTo(x + 20, peak + 26);
        }
      }
      context.lineTo(1300, base + 30); context.closePath(); context.fill();
      if (layer === 0) {
        context.fillStyle = PALETTE.snow;
        for (let x = 0; x <= 1280; x += 40) {
          const peak = base - (hash2(Math.floor((x + off) / 40), 5) * amp + 12);
          context.beginPath(); context.moveTo(x - 16, peak + 22); context.lineTo(x, peak - 2); context.lineTo(x + 16, peak + 22); context.closePath(); context.fill();
        }
      }
    }
  }
  const DEPTHS = [420, 320, 240, 180, 135, 100, 75, 56, 42, 32, 24, 18, 14, 11, 8, 6, 4.5, 3];
  function drawGround(state) {
    const plane = state.plane;
    const horizon = FIELD.horizonY - plane.pitch * 380;
    context.fillStyle = '#4c8f3e'; context.fillRect(0, horizon, FIELD.width, FIELD.height - horizon);
    for (let d = 0; d < DEPTHS.length - 1; d += 1) {
      const zFar = DEPTHS[d]; const zNear = DEPTHS[d + 1];
      const zMid = (zFar + zNear) / 2;
      for (let col = -6; col < 6; col += 1) {
        const x0 = col * 8; const x1 = x0 + 8;
        const cell = terrainCell(x0 + 4, state.distance + zMid);
        const p00 = project(state, x0, groundHeightAt(x0, state.distance + zFar), zFar);
        const p10 = project(state, x1, groundHeightAt(x1, state.distance + zFar), zFar);
        const p11 = project(state, x1, groundHeightAt(x1, state.distance + zNear), zNear);
        const p01 = project(state, x0, groundHeightAt(x0, state.distance + zNear), zNear);
        context.fillStyle = cell.color;
        context.beginPath(); context.moveTo(p00.x, p00.y); context.lineTo(p10.x, p10.y); context.lineTo(p11.x, p11.y); context.lineTo(p01.x, p01.y); context.closePath(); context.fill();
        // Atmospheric fog: far bands fade toward the pale sky colour, so
        // the valley gains depth instead of flat slabs at the horizon.
        // One extra fill per far cell only — cheap on low-end hardware.
        if (zMid > 180) {
          const fogA = Math.min(0.32, (zMid - 180) / 600);
          context.fillStyle = `rgba(190,220,245,${fogA.toFixed(3)})`;
          context.beginPath(); context.moveTo(p00.x, p00.y); context.lineTo(p10.x, p10.y); context.lineTo(p11.x, p11.y); context.lineTo(p01.x, p01.y); context.closePath(); context.fill();
        }
        // Hay bales in wheat fields: small gold dots that make the
        // patchwork read as farmland, not flat colour.
        // Hay bales in wheat fields, kept small and only at mid distance:
        // uncapped, the near bands projected them as giant yellow blobs.
        if (zMid >= 40 && cell.kind === 'field' && cell.color === PALETTE.fieldWheat && hash2(Math.floor((x0 + 4) / 9), Math.floor((state.distance + zMid) / 9)) < 0.25) {
          const hp = project(state, x0 + 6, groundHeightAt(x0 + 4, state.distance + zMid), zMid);
          const hr = Math.max(1.5, Math.min(6, 2.2 * hp.s));
          context.fillStyle = '#e8c85a';
          context.beginPath(); context.arc(hp.x, hp.y - hr, hr, 0, Math.PI * 2); context.fill();
        }
        // Field hedgerow lines.
        if (cell.kind === 'field') {
          context.strokeStyle = 'rgba(0,0,0,0.14)'; context.lineWidth = 1;
          context.beginPath(); context.moveTo(p01.x, p01.y); context.lineTo(p11.x, p11.y); context.stroke();
        }
        // Town houses and trees, only when close enough to read; farther
        // out, forest cells still get a small dark dot, so the far valley
        // walls read as wooded slopes instead of flat empty slabs.
        const cx = x0 + 4; const cz = state.distance + zMid;
        if (zMid < 170) {
          if (cell.kind === 'town') {
            const p = project(state, cx, groundHeightAt(cx, cz), zMid);
            const w = Math.max(3, 13 * p.s); const h = Math.max(2, 9 * p.s);
            // Rooftops vary by house so the town reads as a town, not a stamp.
            const roofs = [PALETTE.townRoof, '#8a5a44', '#5a6b7a'];
            context.fillStyle = PALETTE.townWall; context.fillRect(p.x - w / 2, p.y - h, w, h);
            context.fillStyle = roofs[Math.floor(hash2(cx, cz) * 3) % 3]; context.beginPath(); context.moveTo(p.x - w / 2 - 1, p.y - h); context.lineTo(p.x, p.y - h - w * 0.4); context.lineTo(p.x + w / 2 + 1, p.y - h); context.closePath(); context.fill();
            context.fillStyle = '#3a2c22'; context.fillRect(p.x - 1, p.y - h * 0.55, 2, h * 0.4);
          } else if (cell.kind === 'forest' || treeAt(cx, cz) > 0) {
            const p = project(state, cx + 3, groundHeightAt(cx, cz), zMid);
            // Trees vary in size and shade by hash, with a visible trunk,
            // so the forest has depth instead of identical green discs.
            const tv = hash2(Math.floor(cx / 6), Math.floor(cz / 6));
            const r = Math.max(2, Math.min(24, 9 * p.s * (0.75 + tv * 0.5)));
            const canopies = [['#2f6b28', '#4c9a3f'], ['#27603f', '#3f8a4a'], ['#3a7d2e', '#6ab04e']];
            const pair = canopies[Math.floor(tv * 3) % 3];
            context.fillStyle = '#5a4028'; context.fillRect(p.x - Math.max(1, r * 0.12), p.y - r * 0.5, Math.max(2, r * 0.24), r * 0.6);
            context.fillStyle = pair[0]; context.beginPath(); context.arc(p.x, p.y - r, r, 0, Math.PI * 2); context.fill();
            context.fillStyle = pair[1]; context.beginPath(); context.arc(p.x - r * 0.4, p.y - r * 1.4, r * 0.7, 0, Math.PI * 2); context.fill();
          }
        } else if (cell.kind === 'forest') {
          const p = project(state, cx, groundHeightAt(cx, cz), zMid);
          const rr = Math.max(1.5, 5 * p.s);
          context.fillStyle = 'rgba(38,90,40,0.85)';
          context.beginPath(); context.arc(p.x, p.y - rr, rr, 0, Math.PI * 2); context.fill();
        }
      }
    }
    // Cloud shadows drifting over the valley: large, very soft dark
    // ellipses that sell the sun and the height of the clouds.
    for (let i = 0; i < 3; i += 1) {
      const shx = ((hash2(i, 31) * 1400 + state.time * 8 - state.distance * 0.15) % 1500 + 1500) % 1500 - 110;
      const shy = horizon + 70 + hash2(i, 37) * 90;
      context.fillStyle = 'rgba(20,40,60,0.055)';
      context.beginPath(); context.ellipse(shx, shy, 190, 26, 0, 0, Math.PI * 2); context.fill();
    }
    // Runway strip, centre of the valley at the start of the flight.
    if (state.distance < 300) {
      for (let d = 0; d < DEPTHS.length - 1; d += 1) {
        const zFar = DEPTHS[d]; const zNear = DEPTHS[d + 1];
        if (zFar > 290) continue;
        const a = project(state, -5.5, 0, zFar); const b = project(state, 5.5, 0, zFar);
        const c = project(state, 5.5, 0, zNear); const e = project(state, -5.5, 0, zNear);
        context.fillStyle = PALETTE.runway;
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.lineTo(e.x, e.y); context.closePath(); context.fill();
        if (Math.floor((state.distance + (zFar + zNear) / 2) / 22) % 2 === 0) {
          const m1 = project(state, -0.7, 0.05, zFar); const m2 = project(state, 0.7, 0.05, zFar);
          const m3 = project(state, 0.7, 0.05, zNear); const m4 = project(state, -0.7, 0.05, zNear);
          context.fillStyle = PALETTE.runwayMark;
          context.beginPath(); context.moveTo(m1.x, m1.y); context.lineTo(m2.x, m2.y); context.lineTo(m3.x, m3.y); context.lineTo(m4.x, m4.y); context.closePath(); context.fill();
        }
      }
      // RWY 27 as a runway-threshold sign beside the strip, below the
      // title panel and clear of the aircraft: a centreline label at the
      // far end sat behind the panel, and one lower down sat behind the plane.
      const end = project(state, -16, 0, 18);
      context.fillStyle = 'rgba(8,22,38,0.78)';
      context.beginPath(); context.roundRect(end.x - 44, end.y - 13, 88, 26, 8); context.fill();
      text('RWY 27', end.x, end.y + 5, 14, '#ffffff', 'center', true);
    }
  }
  function drawRings(state, screen) {
    const sorted = state.rings.filter((r) => r.active).slice().sort((a, b) => (b.z - state.distance) - (a.z - state.distance));
    // Only the nearest ring gets a distance label: two rings projected
    // close together used to print e.g. "43m" over "220m" on the same spot.
    let nearest = null; let nearestRel = Infinity;
    for (const ring of sorted) {
      const rel = ring.z - state.distance;
      if (rel > 0 && rel < 260 && rel < nearestRel) { nearest = ring; nearestRel = rel; }
    }
    for (const ring of sorted) {
      const rel = ring.z - state.distance;
      if (rel <= 0 || rel > 620) continue;
      // Game-over frame: never draw a ring right at the camera — the
      // rel-13 m ring used to blow up into a gold arc in the top corner.
      if (screen === SCREEN_OVER && rel < 50) continue;
      const p = project(state, ring.x, ring.alt, rel);
      // A ring right at the camera used to blow up into a giant cropped
      // arc in the corner: cap its drawn size and fade it (and its glow)
      // as you enter it, so it reads as a ring you are flying through,
      // not a gold crescent filling a corner.
      const r = Math.min(220, Math.max(6, ring.radius * p.s));
      if (p.x < -r || p.x > FIELD.width + r || p.y < -r || p.y > FIELD.height + r) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 5);
      const fade = rel < 25 ? Math.max(0.3, rel / 25) : 1;
      context.save();
      context.globalAlpha = fade;
      // Glow is the expensive canvas effect: only the nearest ring gets
      // it (it is the one the eye reads); farther rings are plain gold.
      // That keeps the frame rate up on low-end hardware.
      context.shadowColor = PALETTE.ringGlow; context.shadowBlur = ring === nearest ? 22 * pulse * fade : 0;
      // Golden rings (every 5th) are brighter, thicker and pulse faster —
      // the player can spot the high-value ring from far away.
      const golden = ring.golden;
      context.strokeStyle = golden ? '#ffe98a' : PALETTE.ring;
      context.lineWidth = Math.max(3, r * (golden ? 0.22 : 0.16));
      if (golden) context.shadowBlur = Math.max(context.shadowBlur, 26 * pulse * fade);
      context.beginPath(); context.ellipse(p.x, p.y, r, r * 0.94, 0, 0, Math.PI * 2); context.stroke();
      if (golden) {
        context.strokeStyle = '#fff7d6'; context.lineWidth = Math.max(2, r * 0.07);
        context.beginPath(); context.ellipse(p.x, p.y, r * 1.12, r * 1.05, 0, 0, Math.PI * 2); context.stroke();
      }
      context.shadowBlur = 0; context.strokeStyle = '#fff7d6'; context.lineWidth = Math.max(1.5, r * 0.05);
      context.beginPath(); context.ellipse(p.x, p.y, r * 0.82, r * 0.77, 0, 0, Math.PI * 2); context.stroke();
      context.restore();
      // Labels are a gameplay aid: only during play, only the nearest
      // ring, and clamped clear of the HUD bar and the screen edges, so a
      // label can never sit on a HUD box or a title / game-over panel.
      if (screen === SCREEN_PLAY && ring === nearest) {
        textGlow(`${Math.round(rel)}m`, clamp(p.x, 90, 1190), Math.max(p.y - r - 10, 172), 16, '#ffe98a', 'center');
      }
    }
    // Arrow to the next ring when it is off-centre.
    const next = state.rings.filter((r) => r.active && r.z > state.distance).sort((a, b) => a.z - b.z)[0];
    if (next) {
      const p = project(state, next.x, next.alt, next.z - state.distance);
      if (p.x < 120 || p.x > 1160) {
        const dir = p.x < 640 ? -1 : 1;
        context.fillStyle = PALETTE.ring;
        context.beginPath(); context.moveTo(640 + dir * 150, 210); context.lineTo(640 + dir * 110, 192); context.lineTo(640 + dir * 110, 228); context.closePath(); context.fill();
        textGlow('NEXT RING', 640 + dir * 150, 180, 15, '#ffe98a', 'center');
      }
    }
  }
  function drawPlane(state) {
    const plane = state.plane;
    // The plane is always drawn: damage reads through its tilt and smoke, never
    // by blinking it away (a screenshot must always show the aircraft).
    const px = 640; const py = 492 - plane.pitch * 140;
    const t = state.time;
    // Soft shadow on the ground below: the higher the plane, the larger
    // and fainter the shadow — the one cheap cue that sells altitude.
    {
      const gy = groundHeightAt(plane.x, state.distance + 24);
      const sp = project(state, plane.x, gy, 24);
      const clearance = Math.max(0, plane.alt - gy);
      const shA = clamp(0.26 - clearance * 0.005, 0.05, 0.26);
      const shR = clamp(95 - clearance * 0.7, 34, 95);
      context.fillStyle = `rgba(0,20,10,${shA.toFixed(3)})`;
      context.beginPath(); context.ellipse(sp.x, sp.y, shR, shR * 0.18, 0, 0, Math.PI * 2); context.fill();
    }
    context.save(); context.translate(px, py); context.rotate(plane.roll * 0.7);
    if (plane.crashed) context.rotate(0.35);
    context.shadowColor = 'rgba(0,0,0,0.4)'; context.shadowBlur = 18; context.shadowOffsetY = 10;
    // Wings, swept back, with red trim and glowing nav lights.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath(); context.moveTo(-18, -18); context.lineTo(-218, 28); context.lineTo(-206, 52); context.lineTo(-14, 34); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(18, -18); context.lineTo(218, 28); context.lineTo(206, 52); context.lineTo(14, 34); context.closePath(); context.fill();
    context.fillStyle = PALETTE.planeTrim;
    context.fillRect(-218, 24, 196, 7); context.fillRect(22, 24, 196, 7);
    // Engine glow under the wings: brighter and bigger with throttle,
    // so acceleration reads in the frame, not just on the HUD.
    const glow = 0.7 + 0.3 * Math.sin(t * 22);
    const glowR = 7 + plane.throttle * 7;
    context.shadowColor = '#ff9d00'; context.shadowBlur = 26;
    context.fillStyle = `rgba(255,${Math.round(150 + 60 * glow)},40,0.95)`;
    context.beginPath(); context.arc(-92, 44, glowR, 0, Math.PI * 2); context.arc(92, 44, glowR, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0;
    // Contrails: longer and stronger with speed and throttle.
    const trailLen = 60 + plane.speed * 1.2;
    context.strokeStyle = `rgba(255,255,255,${(0.35 + plane.throttle * 0.3).toFixed(2)})`; context.lineWidth = 3;
    context.beginPath(); context.moveTo(-92, 52); context.lineTo(-96, 52 + trailLen); context.moveTo(92, 52); context.lineTo(96, 52 + trailLen); context.stroke();
    // Fuselage, seen from behind and above: tail at the bottom, nose away at the top.
    const body = context.createLinearGradient(-24, 0, 24, 0);
    body.addColorStop(0, '#c9d6de'); body.addColorStop(0.5, '#ffffff'); body.addColorStop(1, '#c9d6de');
    context.fillStyle = body;
    context.beginPath(); context.moveTo(-20, 58); context.quadraticCurveTo(-26, -40, -13, -118); context.quadraticCurveTo(0, -132, 13, -118); context.quadraticCurveTo(26, -40, 20, 58); context.quadraticCurveTo(0, 72, -20, 58); context.fill();
    context.fillStyle = PALETTE.planeBelly; context.fillRect(-20, 44, 40, 10);
    // Canopy and windows, lit.
    context.fillStyle = PALETTE.planeGlass;
    context.beginPath(); context.ellipse(0, -88, 11, 22, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = 'rgba(180,230,255,0.9)';
    context.beginPath(); context.ellipse(-3, -96, 4, 10, -0.2, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#ffd23e';
    for (let i = 0; i < 3; i += 1) { context.beginPath(); context.arc(-12 + i * 12, -52, 2.6, 0, Math.PI * 2); context.fill(); }
    // Tail fin and stabilisers.
    context.fillStyle = PALETTE.planeTrim;
    context.beginPath(); context.moveTo(-4, 62); context.lineTo(0, 108); context.lineTo(10, 62); context.closePath(); context.fill();
    context.fillStyle = PALETTE.planeBody;
    context.beginPath(); context.moveTo(-58, 62); context.lineTo(-14, 52); context.lineTo(-12, 66); context.lineTo(-52, 76); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(58, 62); context.lineTo(14, 52); context.lineTo(12, 66); context.lineTo(52, 76); context.closePath(); context.fill();
    context.restore();
    // Nav lights, blinking.
    const blink = Math.sin(t * 6) > 0;
    if (blink) {
      context.fillStyle = '#ff3b30'; context.beginPath(); context.arc(px - 218, py + 34, 6, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#34e07a'; context.beginPath(); context.arc(px + 218, py + 34, 6, 0, Math.PI * 2); context.fill();
    }
    // Smoke puffs from a crash, gold burst particles from a ring.
    for (const p of state.particles) {
      if (!p.active) continue;
      const col = p.color === '#ffd23e' ? '255,210,62' : '90,90,90';
      context.fillStyle = `rgba(${col},${clamp(p.life, 0, 0.8)})`;
      context.beginPath(); context.arc(px + p.rx * 12, py + 30 + p.ry * 8 + (1 - p.life) * 30, p.size * (2.2 - p.life), 0, Math.PI * 2); context.fill();
    }
    // Ring-collection flash: an expanding gold ring around the plane,
    // plus the score popup — the reward reads in the frame itself.
    if (state.ringFlash > 0) {
      const fr = (1 - state.ringFlash) * 150 + 50;
      context.strokeStyle = `rgba(255,210,62,${(state.ringFlash * 0.7).toFixed(2)})`;
      context.lineWidth = 6;
      context.beginPath(); context.arc(px, py - 20, fr, 0, Math.PI * 2); context.stroke();
    }
    if (state.popupTimer > 0) textGlow(state.popupText, px, py - 170, 34, '#ffe98a', 'center');
  }
  function hudBox(x, y, w, h) {
    context.fillStyle = PALETTE.hudBg; context.strokeStyle = 'rgba(127,212,255,0.55)'; context.lineWidth = 1.5;
    context.beginPath(); context.roundRect(x, y, w, h, 10); context.fill(); context.stroke();
  }
  function drawHud(state, best, screen) {
    // The score / fuel row sits at y 100–152, exactly where the title,
    // pause and game-over panels sit (y 100, centred). Only draw that row
    // during play; the panels themselves show score / rings / time / best.
    const showScoreRow = screen === SCREEN_PLAY;
    const plane = state.plane;
    const altFt = Math.round(plane.alt * 92);
    const speedKt = Math.round(plane.speed * 3.4);
    const heading = Math.round(plane.heading);
    const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8];
    // Top bar: altitude, compass, speed.
    hudBox(18, 14, 250, 74); hudBox(515, 14, 250, 74); hudBox(1012, 14, 250, 74);
    text('ALTITUDE', 34, 36, 13, PALETTE.hudLine, 'left', true);
    textGlow(`${altFt.toLocaleString()} FT`, 34, 70, 30, PALETTE.hudText, 'left');
    text('HEADING', 640, 36, 13, PALETTE.hudLine, 'center', true);
    textGlow(`${String(heading).padStart(3, '0')}°  ${compass}`, 640, 70, 30, PALETTE.hudText, 'center');
    // Compass tick strip.
    context.fillStyle = PALETTE.hudLine;
    for (let d = -60; d <= 60; d += 15) {
      const x = 640 + d * 1.6;
      context.fillRect(x - 1, 76, 2, d % 45 === 0 ? 9 : 5);
    }
    text('SPEED', 1028, 36, 13, PALETTE.hudLine, 'left', true);
    textGlow(`${speedKt} KT`, 1028, 70, 30, PALETTE.hudText, 'left');
    text(`THR ${Math.round(plane.throttle * 100)}%`, 1180, 36, 13, PALETTE.hudAmber, 'right', true);
    context.fillStyle = 'rgba(255,255,255,0.18)'; context.fillRect(1028, 76, 218, 6);
    context.fillStyle = PALETTE.hudAmber; context.fillRect(1028, 76, 218 * plane.throttle, 6);
    // Score / rings / time / fuel row (play only — see above).
    if (showScoreRow) {
      hudBox(18, 100, 360, 52);
      textGlow(`SCORE ${Math.floor(state.score)}`, 34, 122, 22, '#ffffff', 'left');
      text(`BEST ${best}`, 362, 122, 18, PALETTE.hudAmber, 'right', true);
      text(state.combo > 1 ? `RINGS ${state.ringsPassed}  •  COMBO x${state.combo}  •  LVL ${state.level}` : `RINGS ${state.ringsPassed}  •  LVL ${state.level}`, 34, 144, 15, PALETTE.hudGreen, 'left', true);
      text(`TIME ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`, 362, 144, 15, PALETTE.muted, 'right', true);
      hudBox(932, 100, 330, 52);
      const fuelCol = state.fuel > 35 ? PALETTE.hudGreen : state.fuel > 15 ? PALETTE.hudAmber : PALETTE.hudRed;
      text('FUEL', 948, 122, 15, fuelCol, 'left', true);
      context.fillStyle = 'rgba(255,255,255,0.18)'; context.fillRect(1000, 112, 180, 12);
      context.fillStyle = fuelCol; context.fillRect(1000, 112, 180 * (state.fuel / WORLD.fuelMax), 12);
      text(`${Math.round(state.fuel)}%`, 1196, 124, 15, fuelCol, 'left', true);
      // Lives as little planes, nose up.
      for (let i = 0; i < LIVES; i += 1) {
        context.fillStyle = i < state.lives ? PALETTE.hudGreen : 'rgba(255,255,255,0.2)';
        const lx = 954 + i * 26;
        context.beginPath(); context.moveTo(lx, 134); context.lineTo(lx + 7, 146); context.lineTo(lx - 7, 146); context.closePath(); context.fill();
      }
    }
    // Artificial horizon, bottom left — lit instrument.
    const ax = 92; const ay = 612; const ar = 56;
    context.save(); context.beginPath(); context.arc(ax, ay, ar, 0, Math.PI * 2); context.clip();
    context.translate(ax, ay); context.rotate(-plane.roll);
    const horizonOff = plane.pitch * 160;
    context.fillStyle = '#3f8fd2'; context.fillRect(-ar, -ar, ar * 2, ar + horizonOff);
    context.fillStyle = '#8a5a34'; context.fillRect(-ar, horizonOff, ar * 2, ar - horizonOff + 2);
    context.fillStyle = '#ffffff'; context.fillRect(-ar, horizonOff - 1.5, ar * 2, 3);
    context.restore();
    context.strokeStyle = PALETTE.hudLine; context.lineWidth = 3; context.beginPath(); context.arc(ax, ay, ar, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = '#ffffff'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(ax - 26, ay); context.lineTo(ax - 8, ay); context.moveTo(ax + 8, ay); context.lineTo(ax + 26, ay); context.stroke();
    context.fillStyle = '#ffffff'; context.beginPath(); context.arc(ax, ay, 4, 0, Math.PI * 2); context.fill();
    text('ATTITUDE', ax, ay + ar + 20, 12, PALETTE.hudText, 'center', true);
    // Centre reticle and message.
    context.strokeStyle = 'rgba(255,255,255,0.85)'; context.lineWidth = 2;
    context.beginPath(); context.arc(640, 330, 14, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.moveTo(640 - 24, 330); context.lineTo(640 - 16, 330); context.moveTo(640 + 16, 330); context.lineTo(640 + 24, 330); context.moveTo(640, 306); context.lineTo(640, 314); context.moveTo(640, 346); context.lineTo(640, 354); context.stroke();
    if (state.messageTimer > 0) textGlow(state.message, 640, 250, 34, '#ffe98a', 'center');
    if (state.fuel < 20) textGlow('LOW FUEL', 640, 200, 24, PALETTE.hudRed, 'center');
    // Controls hint, bottom right.
    text('← → roll · ↑ ↓ climb / dive · SHIFT throttle · mouse steers · P pause · M sound', 1262, 700, 14, 'rgba(255,255,255,0.85)', 'right');
  }
  function drawPanel(title, lines, prompt, best) {
    // Compact panel (y 96, tighter rows) so it clears the top HUD bar above
    // and the aircraft nose below, and never reaches the score/fuel row.
    const w = 560; const h = 124 + lines.length * 26 + (best !== undefined ? 26 : 0);
    const x = (FIELD.width - w) / 2; const y = 96;
    context.fillStyle = PALETTE.panel; context.strokeStyle = 'rgba(127,212,255,0.7)'; context.lineWidth = 2;
    context.beginPath(); context.roundRect(x, y, w, h, 16); context.fill(); context.stroke();
    textGlow(title, FIELD.width / 2, y + 54, 46, '#ffffff', 'center');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], FIELD.width / 2, y + 90 + i * 26, 18, PALETTE.muted, 'center');
    if (best !== undefined) text(`Best score  ${best}`, FIELD.width / 2, y + 90 + lines.length * 26, 18, PALETTE.hudAmber, 'center', true);
    const blink = Math.sin(Date.now() / 350) > -0.4;
    if (blink) text(prompt, FIELD.width / 2, y + h - 22, 22, '#ffd23e', 'center', true);
  }
  function draw(state, screen, best, newBest) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b1c2e'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state); drawMountains(state); drawGround(state);
    // Distance haze softens the far valley, and speed streaks sell the rush.
    const haze = context.createLinearGradient(0, FIELD.horizonY - 10, 0, FIELD.horizonY + 200);
    haze.addColorStop(0, 'rgba(200,225,245,0.30)'); haze.addColorStop(1, 'rgba(200,225,245,0)');
    context.fillStyle = haze; context.fillRect(0, FIELD.horizonY - 10, FIELD.width, 210);
    if (state.plane.speed > 40) {
      const streaks = Math.round((state.plane.speed - 40) * 0.5);
      context.strokeStyle = 'rgba(255,255,255,0.35)'; context.lineWidth = 2;
      for (let i = 0; i < streaks; i += 1) {
        const sx = hash2(i, Math.floor(state.time * 3)) * FIELD.width;
        const sy = 60 + hash2(i, 41) * 200;
        const len = 30 + state.plane.speed * 0.9;
        context.beginPath(); context.moveTo(sx, sy); context.lineTo(sx, sy + len); context.stroke();
      }
    }
    drawRings(state, screen); drawPlane(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state, best, screen);
      drawPanel(GAME_NAME, ['Fly the valley. Thread the rings — skim low, earn more.', 'Rings: +100, golden +250, near-miss +150.', 'Three lives. Full throttle burns fuel — cruise to stay up.', 'Score 0  •  Rings 0  •  Time 0:00'], 'PRESS SPACE OR CLICK TO FLY', best);
      return;
    }
    drawHud(state, best, screen);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The valley is waiting.'], 'PRESS P TO RESUME');
    else if (screen === SCREEN_OVER) {
      const lines = [`Score  ${Math.floor(state.score)}`, `Rings flown  ${state.ringsPassed}   •   Time  ${Math.floor(state.elapsed)}s   •   Level ${state.level}`];
      if (newBest) lines.push('★ NEW BEST! ★');
      drawPanel('FLIGHT OVER', lines, 'PRESS SPACE TO FLY AGAIN', best);
    }
  }
  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
