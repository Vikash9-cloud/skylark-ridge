// Keyboard and mouse input for Skylark Ridge.
// Arrows / WASD steer (left-right = roll, up-down = pitch), Shift / Ctrl throttle,
// mouse position steers too, click or Space starts / restarts, P pauses, M mutes.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false; let right = false; let up = false; let down = false;
  let throttleUp = false; let throttleDown = false;
  let mouseX = 0; let mouseY = 0; let mouseActive = false;
  let actions = 0;
  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  window.addEventListener('blur', () => { left = right = up = down = throttleUp = throttleDown = false; mouseActive = false; });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    mouseActive = true;
  });
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });
  return {
    // Steering: keys win; otherwise the mouse position (offset from centre) steers.
    control() {
      let roll = (right ? 1 : 0) - (left ? 1 : 0);
      let pitch = (up ? 1 : 0) - (down ? 1 : 0);
      if (roll === 0 && mouseActive) roll = Math.max(-1, Math.min(1, mouseX * 1.4));
      if (pitch === 0 && mouseActive) pitch = Math.max(-1, Math.min(1, -mouseY * 1.2));
      const throttle = (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
      return { roll, pitch, throttle };
    },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
