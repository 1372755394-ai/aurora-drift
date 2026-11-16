// Aurora Drift — the simulation. Pure state in, events out; the renderer only
// paints it, and the audio hooks only announce it, so a screenshot staged from
// a world is a real frame of the game.
import { BOSS_WAVES, ENEMY, FIELD, LIVES, PLAYER, POWERUP, SHARD, STEP, WAVE, WAVES } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE = 8;
export const EVENT_BOSS = 16;
export const EVENT_POWERUP = 32;

const KIND = { drone: 'drone', weaver: 'weaver', charger: 'charger', splitter: 'splitter', mini: 'mini', boss: 'boss' };

/** Spawn table: which enemies a wave may deal, weighted. */
function tableFor(wave) {
  const table = [['drone', 10]];
  if (wave >= 2) table.push(['weaver', 6]);
  if (wave >= 3) table.push(['charger', 4]);
  if (wave >= 4) table.push(['splitter', 4]);
  if (wave >= 6) table.push(['drone', 4], ['weaver', 3]);
  return table;
}

function pickWeighted(random, table) {
  let total = 0;
  for (const [, weight] of table) total += weight;
  let roll = random.next() * total;
  for (const [kind, weight] of table) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return table[0][0];
}

export function createWorld(random, hooks = {}) {
  const silent = { shoot() {}, hit() {}, explode() {}, pickup() {}, powerup() {}, hurt() {}, dash() {}, wave() {}, boss() {}, win() {} };
  const sound = { ...silent, ...hooks };

  const state = {
    screen: 'title',
    time: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    multiplier: 1,
    lives: LIVES,
    wave: 1,
    waveTime: 0,
    betweenTimer: 0,
    spawnTimer: 0,
    spawnLeft: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    shardsCollected: 0,
    boss: null,
    shake: 0,
    flash: 0,
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    shards: [],
    powerups: [],
    particles: [],
    texts: [],
    stars: [],
    nebulae: [],
    victoryStats: null,
  };

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 150; i += 1) {
      state.stars.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        layer: random.int(1, 3),
        size: random.range(0.6, 2.2),
        twinkle: random.range(0, Math.PI * 2),
      });
    }
    state.nebulae = [
      { x: 260, y: 150, r: 320, color: '61, 30, 109' },
      { x: 1020, y: 520, r: 360, color: '14, 58, 92' },
      { x: 900, y: 120, r: 260, color: '92, 26, 58' },
      { x: 180, y: 580, r: 240, color: '20, 80, 90' },
    ];
  }

  function resetPlayer() {
    state.player = {
      x: 220, y: FIELD.height / 2, vx: 0, vy: 0, angle: 0,
      fireTimer: 0, burstCooldown: 0, dashTimer: 0, dashCooldown: 0,
      invuln: 0, shield: false, weapon: 'single', weaponTimer: 0,
    };
  }

  function reset() {
    state.screen = 'title';
    state.time = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.multiplier = 1;
    state.lives = LIVES;
    state.wave = 1;
    state.waveTime = 0;
    state.betweenTimer = 0;
    state.spawnTimer = 0;
    state.spawnLeft = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.shardsCollected = 0;
    state.boss = null;
    state.shake = 0;
    state.flash = 0;
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    state.shards = [];
    state.powerups = [];
    state.particles = [];
    state.texts = [];
    state.victoryStats = null;
    resetPlayer();
    makeStars();
  }

  function burst(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 320) return;
      const angle = random.range(0, Math.PI * 2);
      const velocity = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
        life: random.range(life * 0.5, life), maxLife: life, size: random.range(1.5, 4), color,
      });
    }
  }

  function addText(x, y, value, color) {
    state.texts.push({ x, y, value, color, life: 1 });
    if (state.texts.length > 24) state.texts.shift();
  }

  function addScore(base, x, y) {
    const gained = base * state.multiplier;
    state.score += gained;
    addText(x, y, `+${gained}`, '#ffd166');
  }

  function addCombo() {
    state.combo += 1;
    state.comboTimer = 4;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 10));
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const enemy = {
      kind, x, y, vx: 0, vy: 0, radius: def.radius, hp: def.hp, maxHp: def.hp,
      speed: def.speed * random.range(0.9, 1.15), t: random.range(0, Math.PI * 2),
      shootTimer: random.range(1, 2.5), state: 'enter', stateTimer: 0.6, angle: Math.PI,
    };
    if (kind === 'boss') {
      enemy.hp = state.wave >= 10 ? 170 : 95;
      enemy.maxHp = enemy.hp;
      enemy.radius = ENEMY.boss.radius;
      enemy.speed = ENEMY.boss.speed;
      state.boss = enemy;
    }
    state.enemies.push(enemy);
    return enemy;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveTime = 0;
    state.spawnTimer = 0.4;
    state.spawnLeft = 6 + wave * 4;
    if (BOSS_WAVES.includes(wave)) {
      spawnEnemy('boss', FIELD.width + 90, FIELD.height / 2);
      sound.boss();
      return EVENT_BOSS;
    }
    sound.wave();
    return EVENT_WAVE;
  }

  function dropLoot(x, y, kind) {
    const roll = random.next();
    if (kind === 'boss') {
      state.powerups.push({ kind: 'heart', x, y, vx: -30, vy: 0, life: POWERUP.life, t: 0 });
      state.powerups.push({ kind: 'bomb', x: x - 40, y: y + 30, vx: -30, vy: 0, life: POWERUP.life, t: 0 });
      return;
    }
    if (roll < 0.62) {
      const count = kind === 'splitter' ? 3 : 1;
      for (let i = 0; i < count; i += 1) {
        state.shards.push({
          x: x + random.range(-14, 14), y: y + random.range(-14, 14),
          vx: random.range(-40, 10), vy: random.range(-30, 30),
          life: SHARD.life, t: random.range(0, Math.PI * 2),
        });
      }
    } else if (roll < 0.70) {
      const kinds = ['spread', 'rapid', 'shield', 'bomb'];
      state.powerups.push({ kind: random.pick(kinds), x, y, vx: -30, vy: 0, life: POWERUP.life, t: 0 });
    } else if (roll < 0.73 && state.lives < LIVES + 2) {
      state.powerups.push({ kind: 'heart', x, y, vx: -30, vy: 0, life: POWERUP.life, t: 0 });
    }
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    addCombo();
    const def = ENEMY[enemy.kind];
    addScore(def.score, enemy.x, enemy.y);
    burst(enemy.x, enemy.y, def.color, enemy.kind === 'boss' ? 60 : 16, 260, 0.7);
    sound.explode();
    if (enemy.kind === 'splitter') {
      spawnEnemy('mini', enemy.x - 20, enemy.y - 14);
      spawnEnemy('mini', enemy.x + 20, enemy.y + 14);
    }
    dropLoot(enemy.x, enemy.y, enemy.kind);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.flash = 0.5;
      state.shake = 14;
      if (state.wave >= WAVES) {
        state.screen = 'win';
        state.victoryStats = {
          score: state.score, kills: state.kills, bestCombo: state.bestCombo,
          shards: state.shardsCollected,
          accuracy: state.shotsFired === 0 ? 0 : Math.round((state.shotsHit / state.shotsFired) * 100),
        };
        sound.win();
        return EVENT_WIN;
      }
      state.betweenTimer = WAVE.betweenSeconds;
    }
    return 0;
  }

  function hurtPlayer() {
    const player = state.player;
    if (player.invuln > 0 || state.screen !== 'play') return 0;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.2;
      burst(player.x, player.y, '#4ef0e0', 24, 300, 0.6);
      sound.hit();
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.multiplier = 1;
    player.invuln = PLAYER.invulnerable;
    state.shake = 12;
    state.flash = 0.35;
    burst(player.x, player.y, '#ff5d73', 30, 320, 0.8);
    sound.hurt();
    if (state.lives <= 0) {
      state.screen = 'over';
      burst(player.x, player.y, '#4ef0e0', 60, 380, 1.1);
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBullet(angle, speed, damage) {
    const player = state.player;
    state.bullets.push({
      x: player.x + Math.cos(angle) * 22, y: player.y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life: 1.6,
    });
    state.shotsFired += 1;
  }

  function playerFire(dt) {
    const player = state.player;
    player.fireTimer -= dt;
    player.burstCooldown -= dt;
    const interval = player.weapon === 'rapid' ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
    if (player.fireTimer > 0) return;
    player.fireTimer = interval;
    const base = player.angle;
    if (player.weapon === 'spread') {
      fireBullet(base - 0.22, PLAYER.bulletSpeed, PLAYER.bulletDamage);
      fireBullet(base, PLAYER.bulletSpeed, PLAYER.bulletDamage);
      fireBullet(base + 0.22, PLAYER.bulletSpeed, PLAYER.bulletDamage);
    } else {
      fireBullet(base, PLAYER.bulletSpeed, PLAYER.bulletDamage);
    }
    sound.shoot();
  }

  function playerBurst() {
    const player = state.player;
    if (player.burstCooldown > 0) return;
    player.burstCooldown = 1.1;
    for (const offset of [-0.35, -0.18, 0, 0.18, 0.35]) fireBullet(player.angle + offset, PLAYER.bulletSpeed * 1.05, PLAYER.bulletDamage);
    burst(player.x + 24, player.y, '#ffe66d', 8, 200, 0.3);
    sound.shoot();
  }

  function applyPowerup(kind) {
    const player = state.player;
    if (kind === 'heart') {
      state.lives = Math.min(LIVES + 2, state.lives + 1);
      addText(player.x, player.y - 30, '+1 LIFE', '#ff5d8f');
    } else if (kind === 'shield') {
      player.shield = true;
      addText(player.x, player.y - 30, 'SHIELD UP', '#4ef0e0');
    } else if (kind === 'spread' || kind === 'rapid') {
      player.weapon = kind;
      player.weaponTimer = 14;
      addText(player.x, player.y - 30, kind === 'spread' ? 'SPREAD SHOT' : 'RAPID FIRE', '#ffd166');
    } else if (kind === 'bomb') {
      state.flash = 0.4;
      state.shake = 10;
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        if (enemy.kind !== 'boss') killEnemy(enemy, i);
        else { enemy.hp -= 25; burst(enemy.x, enemy.y, '#ffd166', 20, 300, 0.6); }
      }
      addText(player.x, player.y - 30, 'NOVA BOMB', '#ffd166');
    }
    sound.powerup();
  }

  function stepEnemies(dt) {
    const player = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.t += dt;
      if (enemy.state === 'enter') {
        enemy.stateTimer -= dt;
        enemy.x -= enemy.speed * dt * 1.4;
        if (enemy.x < FIELD.width - enemy.radius - 10 || enemy.stateTimer <= 0) enemy.state = 'fight';
        continue;
      }
      if (enemy.kind === 'drone') {
        enemy.x -= enemy.speed * dt;
        enemy.y += Math.sin(enemy.t * 2) * 30 * dt;
      } else if (enemy.kind === 'weaver') {
        enemy.x -= enemy.speed * dt;
        enemy.y += Math.sin(enemy.t * 3.2) * 130 * dt;
      } else if (enemy.kind === 'charger') {
        if (enemy.state === 'fight') {
          enemy.stateTimer -= dt;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.hypot(dx, dy) || 1;
          enemy.x += (dx / dist) * enemy.speed * 0.5 * dt;
          enemy.y += (dy / dist) * enemy.speed * 0.5 * dt;
          if (enemy.stateTimer <= 0) { enemy.state = 'aim'; enemy.stateTimer = 0.55; }
        } else if (enemy.state === 'aim') {
          enemy.stateTimer -= dt;
          if (enemy.stateTimer <= 0) {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.hypot(dx, dy) || 1;
            enemy.vx = (dx / dist) * 620;
            enemy.vy = (dy / dist) * 620;
            enemy.state = 'dash';
            enemy.stateTimer = 0.45;
          }
        } else {
          enemy.x += enemy.vx * dt;
          enemy.y += enemy.vy * dt;
          enemy.stateTimer -= dt;
          if (enemy.stateTimer <= 0) { enemy.state = 'fight'; enemy.stateTimer = random.range(1.2, 2); }
        }
      } else if (enemy.kind === 'splitter' || enemy.kind === 'mini') {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      } else if (enemy.kind === 'boss') {
        // Drift into the arena first, then hover in a slow figure-eight.
        if (enemy.x > FIELD.width - 220) enemy.x -= 130 * dt;
        enemy.x += Math.sin(enemy.t * 0.7) * 40 * dt;
        enemy.y = FIELD.height / 2 + Math.sin(enemy.t * 0.9) * 170;
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = state.wave >= 10 ? 1.1 : 1.5;
          const shots = state.wave >= 10 ? 8 : 6;
          for (let s = 0; s < shots; s += 1) {
            const angle = (s / shots) * Math.PI * 2 + enemy.t;
            state.enemyBullets.push({
              x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150, radius: 8, life: 6,
            });
          }
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.hypot(dx, dy) || 1;
          state.enemyBullets.push({
            x: enemy.x - 40, y: enemy.y, vx: (dx / dist) * 260, vy: (dy / dist) * 260, radius: 10, life: 6,
          });
          if (random.next() < 0.4) spawnEnemy('drone', FIELD.width + 30, random.range(80, FIELD.height - 80));
        }
      }
      enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
      if (enemy.x < -90) state.enemies.splice(i, 1);
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20 || bullet.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (dx * dx + dy * dy < (enemy.radius + 5) * (enemy.radius + 5)) {
          state.bullets.splice(i, 1);
          state.shotsHit += 1;
          enemy.hp -= bullet.damage;
          burst(bullet.x, bullet.y, '#ffe66d', 4, 160, 0.3);
          if (enemy.hp <= 0) killEnemy(enemy, j);
          break;
        }
      }
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.x < -30 || bullet.x > FIELD.width + 30 || bullet.y < -30 || bullet.y > FIELD.height + 30 || bullet.life <= 0) {
        state.enemyBullets.splice(i, 1);
      }
    }
  }

  function stepPickups(dt) {
    const player = state.player;
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const shard = state.shards[i];
      shard.t += dt;
      shard.life -= dt;
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < PLAYER.magnetRadius) {
        shard.vx += (dx / dist) * 900 * dt;
        shard.vy += (dy / dist) * 900 * dt;
      } else {
        shard.vx *= 0.98;
        shard.vy *= 0.98;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (shard.life <= 0) { state.shards.splice(i, 1); continue; }
      if (dist < PLAYER.radius + SHARD.radius + 4) {
        state.shards.splice(i, 1);
        state.shardsCollected += 1;
        addCombo();
        addScore(SHARD.points, shard.x, shard.y);
        burst(shard.x, shard.y, '#ffd166', 5, 140, 0.35);
        sound.pickup();
      }
    }
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const powerup = state.powerups[i];
      powerup.t += dt;
      powerup.life -= dt;
      powerup.x += powerup.vx * dt;
      powerup.y += Math.sin(powerup.t * 3) * 20 * dt;
      if (powerup.life <= 0 || powerup.x < -40) { state.powerups.splice(i, 1); continue; }
      const dx = player.x - powerup.x;
      const dy = player.y - powerup.y;
      if (dx * dx + dy * dy < (PLAYER.radius + POWERUP.radius) ** 2) {
        state.powerups.splice(i, 1);
        applyPowerup(powerup.kind);
      }
    }
  }

  function stepPlayer(dt, controls) {
    const player = state.player;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.weaponTimer > 0) {
      player.weaponTimer -= dt;
      if (player.weaponTimer <= 0) player.weapon = 'single';
    }
    let ax = 0;
    let ay = 0;
    if (controls.x !== 0 || controls.y !== 0) {
      ax = controls.x;
      ay = controls.y;
    } else if (controls.mouseActive) {
      const dx = controls.mouseX - player.x;
      const dy = controls.mouseY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { ax = dx / dist; ay = dy / dist; }
    }
    if (controls.dash && player.dashCooldown <= 0 && (ax !== 0 || ay !== 0)) {
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.vx = ax * PLAYER.dashSpeed;
      player.vy = ay * PLAYER.dashSpeed;
      burst(player.x, player.y, '#4ef0e0', 10, 220, 0.35);
      sound.dash();
    }
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
    } else {
      player.vx += ax * PLAYER.accel * dt;
      player.vy += ay * PLAYER.accel * dt;
      player.vx *= Math.pow(0.0015, dt);
      player.vy *= Math.pow(0.0015, dt);
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER.speed) {
        player.vx = (player.vx / speed) * PLAYER.speed;
        player.vy = (player.vy / speed) * PLAYER.speed;
      }
    }
    player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y + player.vy * dt));
    // The ship points at the nearest enemy, else where it is flying.
    let target = null;
    let bestDist = Infinity;
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < bestDist) { bestDist = dist; target = enemy; }
    }
    if (target) player.angle = Math.atan2(target.y - player.y, target.x - player.x);
    else if (Math.hypot(player.vx, player.vy) > 40) player.angle = Math.atan2(player.vy, player.vx);
    playerFire(dt);
    if (controls.burst) playerBurst();
    // Trail
    if (Math.hypot(player.vx, player.vy) > 120 && state.particles.length < 300) {
      state.particles.push({
        x: player.x - Math.cos(player.angle) * 18, y: player.y - Math.sin(player.angle) * 18,
        vx: -player.vx * 0.1, vy: -player.vy * 0.1, life: 0.35, maxLife: 0.35,
        size: random.range(2, 4), color: '#4ef0e0',
      });
    }
  }

  function stepCollisions() {
    const player = state.player;
    for (const enemy of state.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const hit = PLAYER.radius + enemy.radius - 6;
      if (dx * dx + dy * dy < hit * hit) {
        const event = hurtPlayer();
        if (event & EVENT_OVER) return event;
        if (event) {
          // Rammed enemies take a hit too, so a collision is never free for them.
          enemy.hp -= 2;
          if (enemy.hp <= 0) {
            const index = state.enemies.indexOf(enemy);
            if (index >= 0) killEnemy(enemy, index);
          }
        }
        break;
      }
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.enemyBullets[i];
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      if (dx * dx + dy * dy < (PLAYER.radius + bullet.radius - 4) ** 2) {
        state.enemyBullets.splice(i, 1);
        const event = hurtPlayer();
        if (event & EVENT_OVER) return event;
        break;
      }
    }
    return 0;
  }

  function step(dt, controls, demo) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 30);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.combo = 0; state.multiplier = 1; }
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 34 * dt;
      t.life -= dt * 0.9;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    if (state.screen === 'title') {
      // The title screen lives: enemies drift past behind the panel.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < 8) {
        state.spawnTimer = 0.9;
        spawnEnemy(random.pick(['drone', 'weaver', 'mini']), FIELD.width + 30, random.range(60, FIELD.height - 60));
      }
      stepEnemies(dt);
      return 0;
    }
    if (state.screen !== 'play') return 0;

    stepPlayer(dt, controls);
    if (state.screen !== 'play') return 0;
    stepEnemies(dt);
    stepBullets(dt);
    stepPickups(dt);
    const hitEvent = stepCollisions();
    if (hitEvent & EVENT_OVER) return hitEvent;

    // Wave flow.
    if (state.boss) {
      if (!state.enemies.includes(state.boss)) state.boss = null;
    } else if (state.betweenTimer > 0) {
      state.betweenTimer -= dt;
      if (state.betweenTimer <= 0 && state.wave < WAVES) return startWave(state.wave + 1);
    } else {
      state.waveTime += dt;
      if (state.spawnLeft > 0 && state.waveTime < WAVE.spawnSeconds) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.enemies.length < WAVE.maxAlive) {
          state.spawnTimer = Math.max(0.35, 1.15 - state.wave * 0.06);
          spawnEnemy(pickWeighted(random, tableFor(state.wave)), FIELD.width + 30, random.range(50, FIELD.height - 50));
          state.spawnLeft -= 1;
        }
      } else if (state.spawnLeft <= 0 && state.enemies.length === 0 && !BOSS_WAVES.includes(state.wave)) {
        state.betweenTimer = WAVE.betweenSeconds;
      }
    }
    return hitEvent;
  }

  /** Jump straight to a boss wave (used by the boss screenshot): a real wave, staged. */
  function toBossWave(wave) {
    reset();
    state.screen = 'play';
    state.score = wave >= 10 ? 18400 : 7250;
    state.combo = 14;
    state.multiplier = 2;
    state.lives = 2;
    startWave(wave);
    for (let i = 0; i < 5; i += 1) spawnEnemy(random.pick(['drone', 'weaver']), FIELD.width + random.range(30, 200), random.range(80, FIELD.height - 80));
    return state;
  }

  /** Stage the victory screen: the wave-10 boss falls, the stats are tallied. */
  function toVictory() {
    reset();
    state.screen = 'play';
    state.score = 24850;
    state.kills = 187;
    state.bestCombo = 42;
    state.shardsCollected = 96;
    state.shotsFired = 1200;
    state.shotsHit = 864;
    state.wave = WAVES;
    state.lives = 2;
    const boss = spawnEnemy('boss', FIELD.width - 260, FIELD.height / 2);
    boss.hp = 1;
    killEnemy(boss, state.enemies.indexOf(boss));
    state.screen = 'win';
    // The victory panel is the picture: clear the death flash, loot and debris.
    state.powerups = [];
    state.texts = [];
    state.particles = [];
    state.enemyBullets = [];
    state.flash = 0;
    state.shake = 0;
    state.victoryStats = {
      score: state.score, kills: state.kills, bestCombo: state.bestCombo,
      shards: state.shardsCollected, accuracy: 72,
    };
    return state;
  }

  /** Dress a staged scene: a few enemies and shards mid-field, player centred. */
  function dressScene() {
    const player = state.player;
    player.x = 420;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    for (const [kind, x, y] of [['drone', 820, 200], ['weaver', 980, 480], ['charger', 1080, 300], ['splitter', 880, 560]]) {
      spawnEnemy(kind, x, y);
    }
    for (let i = 0; i < 6; i += 1) {
      state.shards.push({
        x: 560 + i * 55, y: 300 + (i % 2 === 0 ? -60 : 70),
        vx: 0, vy: 0, life: SHARD.life, t: i,
      });
    }
  }

  reset();
  return { state, reset, step, startWave, toBossWave, toVictory, dressScene };
}
