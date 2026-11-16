// The screenshot scenes behind ?shot=start|play|boss|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (chase the nearest shard, keep clear of enemies and their
// bullets, dash out of a charger's way), so the frame is what a short game
// really looks like and the same seed always gives the same frame. The boss
// and victory scenes stage real waves through the world's own functions.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const BOSS_SECONDS = 14;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer toward the nearest shard while keeping a margin from every threat,
 *  and drift back toward the middle of the sky when there is nothing to chase. */
function autopilot(state) {
  const player = state.player;
  let target = null;
  let best = Infinity;
  for (const shard of state.shards) {
    const dist = Math.hypot(shard.x - player.x, shard.y - player.y);
    if (dist < best) { best = dist; target = shard; }
  }
  let x = 0;
  let y = 0;
  if (target && best < 420) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    x = dx / dist;
    y = dy / dist;
  } else {
    // Home: the middle-left of the sky, where the action is.
    x = (420 - player.x) / 400;
    y = (FIELD.height / 2 - player.y) / 300;
  }
  // Keep out of the corners and off the edges.
  if (player.x > 900) x -= 1.2;
  if (player.x < 140) x += 1.2;
  if (player.y < 110) y += 1;
  if (player.y > FIELD.height - 110) y -= 1;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 150) {
      x += (dx / dist) * 1.6;
      y += (dy / dist) * 1.6;
    }
  }
  for (const bullet of state.enemyBullets) {
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 110) {
      x += (dx / dist) * 1.4;
      y += (dy / dist) * 1.4;
    }
  }
  const length = Math.hypot(x, y) || 1;
  const dash = state.enemies.some((e) => e.kind === 'charger' && e.state === 'aim'
    && Math.hypot(player.x - e.x, player.y - e.y) < 260);
  return {
    x: x / length, y: y / length,
    mouseX: player.x, mouseY: player.y, mouseActive: false,
    burst: state.time % 1.4 < SAMPLE, dash,
  };
}

function playForward(world, seconds, horizon) {
  const state = world.state;
  for (let index = 0; index < seconds / STEP; index += 1) {
    const events = world.step(STEP, autopilot(state), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    void horizon;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show.
 */
export function stageShot(name, world) {
  if (name === 'boss') {
    world.toBossWave(5);
    playForward(world, BOSS_SECONDS, 0);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.toVictory();
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, autopilot(world.state), true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.startWave(1);
  world.state.screen = 'play';
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  playForward(world, limit, 0);
  // Dress the frame so the loop reads at a glance: enemies mid-field, shards
  // in a trail, the ship centred.
  world.dressScene();
  playForward(world, 0.6, 0);
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
