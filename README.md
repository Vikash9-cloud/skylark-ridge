# Skylark Ridge

A 3D chase-view flight game built for the make.fun bounty **“Make the best flight game”**. Fly a valley, thread golden rings, manage fuel, and chase a high score — all offline, in a desktop browser, with no build step and no network requests.

## Gameplay

You fly a light aircraft over a seeded valley of farms, river, road, trees, a town and snow-capped mountains. Golden rings appear ahead; fly through them to score, gain fuel and build a combo. Fuel burns continuously, faster at full throttle, so ring-chasing is a real decision. Hit the ground or a mountain and you lose a life — you have three. Speed and difficulty rise with each level.

### Controls

- **Arrow keys / WASD** — roll, climb and dive
- **Shift / Ctrl** — throttle up / down
- **Mouse** — steer
- **Space / click** — start / restart
- **P** — pause, **M** — mute

### Scoring and unique features

- **Rings:** +100 points, +4 fuel each; combo multiplier grows with consecutive rings
- **Golden Rings:** every 5th ring, +250 points, brighter and pulsing so you can spot them early
- **Near Miss:** +150 points for threading a ring near its edge instead of its centre
- **Ridge Runner:** +25 points per 2 seconds of continuous low skimming below 5 m clearance at high speed — risk versus reward
- **Fuel and lives:** fuel, three lives, level progression with tighter rings, wider spread, faster speed and higher fuel burn in later levels
- **HUD:** altitude, speed, heading compass, artificial horizon, throttle and fuel bars, score, rings, combo, level, time and best score
- **Presentation:** atmospheric fog, cloud shadows, plane shadow, banking and throttle-linked engine glow, contrails, ring-collection flash and particles, synthesised WebAudio engine hum, ring chime and crash sound — no audio files

## Installation and launch

No installation, no dependencies, no build step.

```bash
git clone https://github.com/Vikash9-cloud/skylark-ridge.git
cd skylark-ridge
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or serve `game/` with any static HTTP server and open `game/index.html`.

Requires Node.js 22.18 or later for `serve.ts` / `main.ts`; the game itself is plain static files under `game/`.

## Technology stack

- Pure Canvas 2D pseudo-3D rendering — no game engine, no libraries, no network
- Vanilla JavaScript (ES modules), split by job: `config`, `world`, `render`, `main`, `input`, `shots`, `sound`, `random`
- Procedurally generated art and sound — all terrain, aircraft and audio are generated in code
- `main.ts` (Node 22) hands the game in via `vendor/makefun-game.ts`, copying `game/` and `screenshots/` and writing `dossier.json`

## Verified performance and browser compatibility

- **60.0 FPS** in live play-testing in Firefox at 1280×720 on a shared 1.5-CPU machine, with zero console or page errors
- Fast static load; the whole `game/` folder is 59,875 bytes in 9 files
- Screenshots in `screenshots/` are genuine renders of the game running in Firefox (1280×720 JPEG, 92 / 90 / 86 KB)
- The game is built to run in a desktop browser using only plain Canvas 2D and WebAudio, with no browser-specific APIs. Chrome compatibility as a desktop browser target was **not** play-tested here — testing was completed only in Firefox

## License

MIT — see [LICENSE](LICENSE).
