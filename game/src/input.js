// Keyboard and mouse: WASD or arrows to fly, mouse to steer toward the cursor,
// Space or click to fire a burst, Shift to dash, P or Esc to pause, M to mute,
// R to restart, Enter/Space/click to confirm on the title and end screens.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_DASH = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dashQueued = false;
  let mouse = { x: FIELD.width / 2, y: FIELD.height / 2, down: false, active: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function setView(nextScale, nextX, nextY) {
    scale = nextScale;
    offsetX = nextX;
    offsetY = nextY;
  }

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
    if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
    if (event.key === 'Shift') dashQueued = true;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event);
    mouse = { ...point, down: mouse.down, active: true };
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toField(event);
    mouse = { ...point, down: true, active: true };
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', () => {
    mouse = { ...mouse, down: false };
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** Dash presses are a separate queue: reading them must not eat pause/confirm. */
  function takeDash() {
    const taken = dashQueued;
    dashQueued = false;
    return taken;
  }

  function firing() {
    return keys.has(' ') || mouse.down;
  }

  return { direction, takeActions, takeDash, firing, setView, get mouse() { return mouse; } };
}
