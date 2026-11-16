# Aurora Drift

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mellow-comet-91/aurora-drift/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mellow-comet-91/aurora-drift/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Fly the last light-ship through the neon nebula. Collect star shards, dodge the swarm, and break the Void Leviathan across 10 waves — two bosses, one way home.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network: the game is plain static files under `game/` (canvas 2D, ES modules, WebAudio synth for sound).

## How to play

- **Move** — WASD / arrow keys, or steer with the mouse
- **Fire** — automatic; hold Space or click for a 5-way burst
- **Dash** — Shift (short burst of speed, 1.6 s cooldown)
- **Pause** — P or Esc · **Mute** — M · **Restart** — R

## The game

- **10 waves** of enemies: drones, sine-weaving weavers, telegraphing chargers, splitters that break into minis — and the **Void Leviathan** boss on waves 5 and 10. Beat the wave-10 boss to win.
- **Star shards** build a combo multiplier (up to x5) and pull toward the ship with a magnet radius.
- **Power-ups**: spread shot, rapid fire, shield, nova bomb, extra life.
- **Feedback everywhere**: particles, screen shake, hit flash, floating score text, a boss health bar, wave banners, and a live HUD (score, wave, combo, lives, best).
- **Sound**: everything is synthesised live with WebAudio — lasers, explosions, pickups, a boss alarm and a quiet bass-and-pad loop. No audio files.
- **Screens**: title, play, paused, game over and victory, each with its stats; the best score is kept in localStorage.
- **Deterministic screenshots**: `?seed=N` fixes the sky, and `?shot=start|play|boss|win` stages a real scene of the game (see `shots.json`).

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- `game/index.html` — the page; `game/src/` — `config.js` (tuning), `random.js` (seeded RNG), `input.js`, `audio.js`, `world.js` (simulation), `render.js` (drawing), `shots.js` (staged scenes), `main.js` (game loop).
- `screenshots/` — 1-start, 2-play, 3-boss, 4-victory, real renders of the game's own code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=j755r6jc&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
