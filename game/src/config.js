// Aurora Drift — tuning, palette and constants in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 420,
  accel: 2600,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletDamage: 1,
  dashSpeed: 950,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 1.6,
  magnetRadius: 130,
};

export const LIVES = 3;

/** Waves: 10 waves; wave 5 and wave 10 end in a boss. Beat the wave-10 boss to win. */
export const WAVES = 10;
export const BOSS_WAVES = [5, 10];

export const ENEMY = {
  drone: { radius: 15, hp: 1, speed: 95, score: 50, color: '#ff5d73' },
  weaver: { radius: 16, hp: 2, speed: 130, score: 80, color: '#c77dff' },
  charger: { radius: 17, hp: 2, speed: 85, score: 120, color: '#ff9f1c' },
  splitter: { radius: 22, hp: 3, speed: 70, score: 150, color: '#2ec4b6' },
  mini: { radius: 9, hp: 1, speed: 190, score: 30, color: '#7bdff2' },
  boss: { radius: 64, hp: 90, speed: 55, score: 5000, color: '#ff2e63' },
};

export const SHARD = { radius: 9, points: 10, magnet: 150, life: 9 };
export const POWERUP = { radius: 15, life: 10 };

/** Seconds a wave's spawn budget lasts; the boss wave ends when the boss dies. */
export const WAVE = { spawnSeconds: 26, betweenSeconds: 4, maxAlive: 26 };

export const PALETTE = {
  backdrop: '#050510',
  deep: '#0b1030',
  nebula1: '#3d1e6d',
  nebula2: '#0e3a5c',
  nebula3: '#5c1a3a',
  player: '#4ef0e0',
  playerCore: '#eafffb',
  bullet: '#ffe66d',
  shard: '#ffd166',
  heart: '#ff5d8f',
  panel: 'rgba(8, 12, 34, 0.82)',
  panelEdge: '#3d5a80',
  text: '#eef1f5',
  muted: '#9aa5c1',
  gold: '#ffd166',
  danger: '#ff5d73',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'aurora-drift.best';
