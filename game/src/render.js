// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. Neon glow is
// painted with layered shapes and shadowBlur, kept small so a frame stays fast.
import { FIELD, FONT, LIVES, PALETTE, PLAYER, POWERUP, SHARD, WAVES } from './config.js';
import { ENEMY } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const POWERUP_LABEL = { spread: 'SPREAD', rapid: 'RAPID', shield: 'SHIELD', bomb: 'NOVA', heart: 'LIFE' };
const POWERUP_COLOR = { spread: '#ffd166', rapid: '#ffe66d', shield: '#4ef0e0', bomb: '#ff9f1c', heart: '#ff5d8f' };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, weight = 600) {
    const key = `${weight}-${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowCircle(x, y, radius, color, alpha = 1) {
    context.save();
    context.globalAlpha = alpha;
    context.shadowColor = color;
    context.shadowBlur = 18;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBackground(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.backdrop);
    gradient.addColorStop(0.55, PALETTE.deep);
    gradient.addColorStop(1, '#0a0618');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const nebula of state.nebulae) {
      const glow = context.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
      glow.addColorStop(0, `rgba(${nebula.color}, 0.34)`);
      glow.addColorStop(1, `rgba(${nebula.color}, 0)`);
      context.fillStyle = glow;
      context.fillRect(nebula.x - nebula.r, nebula.y - nebula.r, nebula.r * 2, nebula.r * 2);
    }
    for (const star of state.stars) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(state.time * 1.4 + star.twinkle));
      context.globalAlpha = twinkle * (0.35 + star.layer * 0.2);
      context.fillStyle = star.layer === 3 ? '#cfe8ff' : '#8fa8d8';
      context.fillRect(star.x - (star.size / 2), star.y - (star.size / 2), star.size, star.size);
    }
    context.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const player = state.player;
    if (!player) return;
    if (player.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) return;
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    if (player.shield) {
      context.strokeStyle = 'rgba(78, 240, 224, 0.8)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, PLAYER.radius + 9, 0, Math.PI * 2);
      context.stroke();
    }
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 22;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(24, 0);
    context.lineTo(-14, -13);
    context.lineTo(-7, 0);
    context.lineTo(-14, 13);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(4, 0, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (player.dashCooldown > 0 && player.dashTimer <= 0) {
      const ready = 1 - player.dashCooldown / 1.6;
      context.fillStyle = 'rgba(78, 240, 224, 0.25)';
      context.fillRect(player.x - 16, player.y + 26, 32, 4);
      context.fillStyle = PALETTE.player;
      context.fillRect(player.x - 16, player.y + 26, 32 * ready, 4);
    }
  }

  function drawEnemy(enemy, time) {
    const def = ENEMY[enemy.kind];
    context.save();
    context.translate(enemy.x, enemy.y);
    context.shadowColor = def.color;
    context.shadowBlur = 16;
    if (enemy.kind === 'drone') {
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = '#2b0a12';
      context.beginPath();
      context.arc(-4, -3, 5, 0, Math.PI * 2);
      context.arc(6, 4, 4, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'weaver') {
      context.rotate(Math.sin(time * 3 + enemy.t) * 0.5);
      context.fillStyle = def.color;
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const outer = i % 2 === 0 ? enemy.radius + 6 : enemy.radius - 4;
        const x = Math.cos(angle) * outer;
        const y = Math.sin(angle) * outer;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
    } else if (enemy.kind === 'charger') {
      const aiming = enemy.state === 'aim';
      context.rotate(Math.atan2(0, -1));
      context.fillStyle = aiming ? '#ffd166' : def.color;
      context.beginPath();
      context.moveTo(-enemy.radius, -enemy.radius * 0.7);
      context.lineTo(enemy.radius, 0);
      context.lineTo(-enemy.radius, enemy.radius * 0.7);
      context.closePath();
      context.fill();
      if (aiming) {
        context.shadowBlur = 0;
        context.fillStyle = '#fff3c4';
        context.beginPath();
        context.arc(0, 0, 5, 0, Math.PI * 2);
        context.fill();
      }
    } else if (enemy.kind === 'splitter') {
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(-7, -6, 12, 0, Math.PI * 2);
      context.arc(8, 7, 12, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = '#06231f';
      context.beginPath();
      context.arc(-7, -6, 4, 0, Math.PI * 2);
      context.arc(8, 7, 4, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'mini') {
      context.fillStyle = def.color;
      context.beginPath();
      context.moveTo(enemy.radius, 0);
      context.lineTo(-enemy.radius, -enemy.radius * 0.7);
      context.lineTo(-enemy.radius * 0.4, 0);
      context.lineTo(-enemy.radius, enemy.radius * 0.7);
      context.closePath();
      context.fill();
    } else if (enemy.kind === 'boss') {
      const pulse = 1 + Math.sin(time * 2.4) * 0.04;
      context.scale(pulse, pulse);
      context.fillStyle = def.color;
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? enemy.radius + 14 : enemy.radius - 10;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = '#3d0213';
      context.beginPath();
      context.arc(0, 0, 26, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ff8fa3';
      context.beginPath();
      context.arc(-10, -6, 6, 0, Math.PI * 2);
      context.arc(10, -6, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(0, 12, 8, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (enemy.kind === 'boss') {
      const width = 170;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 26, width, 9);
      context.fillStyle = '#ff2e63';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 26, width * ratio, 9);
    }
  }

  function drawHud(state, best) {
    context.fillStyle = 'rgba(5, 8, 24, 0.55)';
    context.fillRect(0, 0, FIELD.width, 54);
    text(`SCORE ${state.score.toLocaleString('en-US')}`, 20, 36, 26, PALETTE.text, 'left', 700);
    text(`WAVE ${state.wave}/${WAVES}`, 330, 36, 22, PALETTE.gold, 'left', 700);
    if (state.multiplier > 1) text(`COMBO x${state.multiplier}`, 480, 36, 22, '#ff9f1c', 'left', 700);
    if (state.player && state.player.weapon !== 'single') {
      text(state.player.weapon.toUpperCase(), 640, 36, 20, POWERUP_COLOR[state.player.weapon] || PALETTE.gold, 'left', 700);
    }
    text(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, FIELD.width - 20, 36, 20, PALETTE.muted, 'right', 600);
    for (let i = 0; i < Math.max(0, state.lives); i += 1) {
      const x = 24 + i * 30;
      context.save();
      context.translate(x, 74);
      context.fillStyle = '#ff5d8f';
      context.shadowColor = '#ff5d8f';
      context.shadowBlur = 10;
      context.beginPath();
      context.moveTo(0, 7);
      context.bezierCurveTo(-11, -4, -6, -12, 0, -5);
      context.bezierCurveTo(6, -12, 11, -4, 0, 7);
      context.fill();
      context.restore();
    }
    if (state.boss) {
      const width = 460;
      const x = (FIELD.width - width) / 2;
      const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
      text(state.wave >= 10 ? 'VOID LEVIATHAN — FINAL BOSS' : 'VOID LEVIATHAN', FIELD.width / 2, 84, 18, '#ff8fa3', 'center', 700);
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x, 92, width, 12);
      context.fillStyle = '#ff2e63';
      context.fillRect(x, 92, width * ratio, 12);
    } else if (state.betweenTimer > 0) {
      text(`WAVE ${state.wave + 1} INCOMING`, FIELD.width / 2, 96, 22, PALETTE.gold, 'center', 700);
    }
  }

  function panel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 36;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2 - 20;
    context.save();
    context.shadowColor = accent || PALETTE.player;
    context.shadowBlur = 30;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, width, height, 18);
    context.fill();
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, width, height, 18);
    context.stroke();
    text(title, FIELD.width / 2, y + 62, 44, accent || PALETTE.player, 'center', 800);
    lines.forEach((line, i) => {
      text(line.text, FIELD.width / 2, y + 112 + i * 36, line.size || 21, line.color || PALETTE.text, 'center', line.weight || 600);
    });
    if (prompt) text(prompt, FIELD.width / 2, y + height - 26, 20, PALETTE.muted, 'center', 600);
  }

  function draw(state, screen, best, muted) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state);
    for (const bullet of state.bullets) {
      glowCircle(bullet.x, bullet.y, 4, PALETTE.bullet, 0.95);
      context.strokeStyle = 'rgba(255, 230, 109, 0.6)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    for (const bullet of state.enemyBullets) glowCircle(bullet.x, bullet.y, bullet.radius, '#ff5d73', 0.9);
    for (const shard of state.shards) {
      const pulse = 1 + Math.sin(shard.t * 6) * 0.18;
      context.save();
      context.translate(shard.x, shard.y);
      context.rotate(shard.t * 2);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.shard;
      context.shadowColor = PALETTE.shard;
      context.shadowBlur = 14;
      context.beginPath();
      context.moveTo(0, -SHARD.radius);
      context.lineTo(SHARD.radius * 0.7, 0);
      context.lineTo(0, SHARD.radius);
      context.lineTo(-SHARD.radius * 0.7, 0);
      context.closePath();
      context.fill();
      context.restore();
    }
    for (const powerup of state.powerups) {
      const color = POWERUP_COLOR[powerup.kind];
      glowCircle(powerup.x, powerup.y, POWERUP.radius, color, 0.95);
      context.fillStyle = '#0b1030';
      context.font = font(11, 800);
      context.textAlign = 'center';
      context.fillText(POWERUP_LABEL[powerup.kind].slice(0, 2), powerup.x, powerup.y + 4);
    }
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawPlayer(state);
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const t of state.texts) {
      context.globalAlpha = Math.max(0, t.life);
      text(t.value, t.x, t.y, 19, t.color, 'center', 800);
    }
    context.globalAlpha = 1;
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      panel('AURORA DRIFT', [
        { text: 'Fly the last light-ship through the neon nebula.', size: 22 },
        { text: 'Collect star shards · dodge the swarm · break the Void Leviathan', size: 20, color: PALETTE.muted },
        { text: 'WASD / arrows or mouse to fly · hold click to burst · Shift to dash', size: 20, color: PALETTE.muted },
        { text: '10 waves. Two bosses. One way home.', size: 20, color: PALETTE.gold },
      ], 'Press Space or click to launch  ·  P pauses  ·  M mutes');
    } else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', [
        { text: `Score ${state.score.toLocaleString('en-US')} · Wave ${state.wave}/${WAVES}`, size: 21 },
        { text: 'The nebula waits for no one. Except now.', size: 20, color: PALETTE.muted },
      ], 'Press P or Space to resume');
    } else if (screen === SCREEN_OVER) {
      panel('SIGNAL LOST', [
        { text: `Score ${state.score.toLocaleString('en-US')}  ·  Best ${Math.max(best, state.score).toLocaleString('en-US')}`, size: 22 },
        { text: `Waves cleared ${state.wave - 1} · Kills ${state.kills} · Best combo x${Math.max(1, state.bestCombo)}`, size: 20, color: PALETTE.muted },
      ], 'Press R or Space to fly again', '#ff5d73');
    } else if (screen === SCREEN_WIN) {
      const stats = state.victoryStats || { score: state.score, kills: state.kills, bestCombo: state.bestCombo, shards: state.shardsCollected, accuracy: 0 };
      panel('THE AURORA IS YOURS', [
        { text: `Final score ${stats.score.toLocaleString('en-US')}  ·  Best ${Math.max(best, stats.score).toLocaleString('en-US')}`, size: 22, color: PALETTE.gold },
        { text: `Kills ${stats.kills} · Star shards ${stats.shards} · Best combo ${stats.bestCombo}`, size: 20 },
        { text: `Accuracy ${stats.accuracy}% · The Void Leviathan is stardust.`, size: 20, color: PALETTE.muted },
      ], 'Press R or Space to fly again', '#ffd166');
    }
    if (muted) text('MUTED', FIELD.width - 20, FIELD.height - 16, 16, PALETTE.muted, 'right', 600);
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 240, 200, ${state.flash * 0.5})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, setView: () => {} };
}
