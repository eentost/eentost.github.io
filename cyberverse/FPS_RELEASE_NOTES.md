# CyberVerse FPS v2 — implementation evidence & deployment

## Scope and compatibility

- Existing CyberVerse 3D city, incident workflows, optional cooperative room, third-person combat mode, layout, and routes remain available.
- FPS is an opt-in independent arena within the same page, not a replacement for incident training.
- Product is an **original browser FPS prototype**, not a reproduction of another game's proprietary maps, art, characters, sounds or naming.

## Implemented source code

| File | Responsibility |
|---|---|
| `scene-fps.js` | First-person movement, cover collisions, AI bots, eight local weapons, loadouts, aiming, reload and view animations, client prediction, mobile controls |
| `fps-effects.js` | Web Audio synthetic gunfire, impacts, footsteps, reload, ambient wind and rain; textured overlays, rain, day/night/desert presets |
| `fps-online.js` | Browser WSS lobby, nickname and room, remote player proxies, snapshot interpolation and server-authoritative responses |
| `fps.css` | Responsive FPS HUD, scope, weapon selection, server lobby, joystick |
| `fps-config.js` | Site-wide configured server endpoint (empty until actually deployed) |
| `fps-server/server.mjs` | Server-authoritative 25-tick simulation, 10Hz room snapshots, movement, collision, ammo, cooldown, line of sight, damage, respawn, team score |
| `fps-server/compose.public.yaml` | Node server and Caddy TLS/WSS deployment |
| `fps-server/tests/smoke.test.mjs` | Health, two player join, origin security and authoritative movement tests |
| `.github/workflows/cyberverse-fps.yml` | Node syntax QA and server smoke test workflow |

### Weapons

Keyboard slots (1–8): CV-47 assault rifle, Viper-9 SMG, Kestrel-C carbine, Breach-8 shotgun, Sentinel-D DMR, SV-8 sniper, Guardian-65 LMG, Pulse-15 pistol. Each weapon uses a distinct clip size, fire interval, reload time, spread and visual proportions. Damage values are **fictional game balance constants**, not real-world weapon characteristics.

### Visuals and sound

- OPS ZERO original container-yard map with lightmapped-style geometry, concrete textures, skyline buildings and cover.
- Industrial dusk, harbor night, rain and desert sky presets with visibility changes. Rain produces rendered particle strokes and puddle reflection surfaces.
- GLTF animated humanoids from the Three.js Soldier sample when public asset loading works. Procedural character model remains as a fallback.
- Procedural first-person weapon components, glove, magazine dip, muzzle flash, ejected brass, simulated hit trails and optic.
- Web Audio procedural sound (gunfire, reload, hit, footsteps, ambient noise). Not studio-recorded sound assets or photo-realistic textures.
- On touchscreen: analog move pad, drag-to-look, aim/fire buttons. Device/browser compatibility still requires hardware QA.

## Public multiplayer — IMPORTANT

GitHub Pages hosts **static files only**. Public internet matchmaking cannot run on GitHub Pages. A **public HTTPS server + WSS reverse proxy + DNS** must be deployed separately, and `fps-config.js` must point to it. Merely committing server code does not activate multiplayer.

Server supports configurable rooms (default maximum 8), up to 12 clients in each room, anonymous nicknames, balanced BLUE/RED teams, 5-minute/30-point game rounds, health/armor, death/respawn and authoritative hits. These are *configuration limits*, not proven production concurrency benchmarks.

### Deployment: Linux host with a public domain

1. Create DNS A/AAAA pointing `fps.yourdomain.example` to your own server.
2. Open TCP 80 and 443 on the host, and install Docker + Compose.
3. In `cyberverse/fps-server`, copy `.env.example` to `.env`. Set `FPS_DOMAIN=fps.yourdomain.example` and `TLS_EMAIL=your-real-email@example.com`.
4. Start using:

```bash
docker compose -f compose.public.yaml up -d --build
```

5. Verify service:

```bash
curl -fsS https://fps.yourdomain.example/health
```

6. Set `window.CV_FPS_SERVER_URL = "wss://fps.yourdomain.example/fps";` in `cyberverse/fps-config.js`. Commit this single change, then wait for GitHub Pages deployment.
7. Two or more browsers: open `https://eentost.github.io/cyberverse/` -> FPS entry -> choose the same server/room -> online join -> click **온라인 전투 참가**. The round is synchronized by the WSS server.

If you have no domain/TLS server, visitors can still run the **offline AI FPS**, but they cannot meet over the internet.

### Reproducible QA commands

Run from `cyberverse/fps-server`:

```bash
npm install --no-audit --no-fund && npm test
```

```bash
node --check server.mjs && node --check ../scene-fps.js && node --check ../fps-online.js && node --check ../fps-effects.js
```

```bash
docker compose -f compose.public.yaml ps
```

Verify manually with two independently launched browsers: room join/leave, cross-browser movement, shot/armor/health, ammo/reload, respawn, team score, disconnection, cross-origin refusal, refresh, mobile controls, and original city/incident UI regression.

## QA status (do not confuse source review with execution)

| Gate | Status |
|---|---|
| GitHub source files created and connected | Implemented, fetch verified |
| JavaScript parse checks through isolated source parsing | Verified during authoring |
| Source contract and integration static checks | Verified during authoring |
| Node server running on an externally accessible VPS | **Not done** |
| WSS domain/DNS/TLS for external users | **Not done** |
| CI workflow code and smoke test source | Implemented, execution not independently confirmed |
| Two real browsers battling via the deployed server | **Not verified** |
| Browser graphics, FPS/frame time, GPU and mobile QA | **Not verified** |
| Commercial-grade character, sound and collision quality | **Not achieved** |

### Known limitations and production work

- Client-side interpolation and authoritative server movement are basic; latency compensation, lag compensation, bullet rollback, full anti-cheat, packet loss recovery and server reconciliation require further tests.
- Server supports single-process, in-memory rooms. Restart resets matches. Distributed scale and persistence need shared room state/Redis or sharding.
- No actual payment, ranking database, account system, anti-abuse reporting, moderation, matchmaking service, spectators, reconnect tokens, voice chat or dedicated lobbies.
- Audio uses generated WebAudio, not recorded professional weapon/environment assets.
- No audited externally licensed high-fidelity weapon art assets. Procedural models and an externally fetched Three.js sample soldier are not photorealism.
- Large-scale load tests and platform/browser security reviews are outstanding. Do not market this as a commercial-ready competitive shooter yet.

## FPS v3 — grenade, melee, rewards and variety (2026-11-05)

### Changes applied
- New `fps-gameplay.js`: opt-in **offline AI mode** grenades (G), knife strike (V), dropped-weapon pickup (Alt+E), upgrade (H), visual headshots, persistent XP/rank/credits (localStorage).
- New `fps-scenery.js`: theme-specific industrial stacks, night high-rises/cranes, storm port structures, desert rocks/dunes. These are **visual backdrops**, not four unique collidable maps.
- `scene-fps.js`: minimum-diff integration and independent damage/rank callbacks, 2x/4x/8x sniper scope (Z), simple raycast range label.
- `fps.css`: rank/XP/grenade/loot HUD.
- Existing E-key tactical decoy remains unchanged; use Alt+E for weapon pickups.
- Scoring: headshot elimination awards 150 XP and 60 credits, regular elimination 100 XP and 35 credits. Credits may upgrade each offline weapon to level +5, at a 4% per-level game damage boost.
- Rank and upgrade data is local to the browser. **Not cross-device, account-backed or synchronized.**

### Important limitations
- New grenade and knife combat, loot and upgraded damage work **against local AI bots only**; public multiplayer authoritative backend does **not** support these mechanics. Disabling them online prevents client-side spoofing.
- Headshot visual effects use stylized short-lived red particle bursts, not cinematic fluid/blood-splat simulation. The source explicitly separates visual effects from server hit confirmation.
- Grenade bounce and explosion use lightweight approximations; there is no rigid-body physics engine or advanced destructible cover.
- Rank does not persist through cleared browser data or across devices. Competitive online rank is not deployed.
- Source syntax and static integration checks performed; browser GPU rendering and CI execution still unverified. Do not mark release production-ready.

### Offline controls
`WASD` movement; `1–8` firearm; `R` reload; `G` grenade; `V` melee; `Alt+E` pickup; `H` upgrade; `Z` sniper scope 2x/4x/8x; `Q` EMP and `E` decoy in tactical mode.

