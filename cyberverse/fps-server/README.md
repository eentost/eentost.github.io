# CyberVerse FPS Multiplayer Server

A dedicated Node.js 22+ WebSocket game server. It is separate from the existing incident-cooperation server and serves FPS rooms at `/fps`.

## Local run

```sh
npm install
ALLOWED_ORIGINS=http://localhost:8000 PORT=8787 npm start
```

Run a local static web server for the frontend (for example `python3 -m http.server 8000` in the site root) and enter `ws://localhost:8787/fps` in the FPS menu. Health endpoint: `http://localhost:8787/health`.

## Internet deployment

For public GitHub Pages visitors you MUST run this backend on a separate reachable host with HTTPS/WSS. Use the included Docker Compose and Caddy example, replace `fps.example.com` with your actual domain, route `/fps` WebSocket to port 8787, and allow origin `https://eentost.github.io`. Then configure `wss://your-real-domain/fps` in the FPS menu. The example hostname is not a live service.

## Protocol

Clients: `join` (room/name), `input` (keys/yaw/pitch), `equip` (gun), `reload`, `shoot`. Server: `welcome`, `state`, `shot`, `hit`, `damage`, `kill`, `round_end`, `round_start`, `leave`, `error`.

The server updates movement at 25 Hz, broadcasts state at 10 Hz, validates firing cadence/ammo and simple cover line of sight, and owns health/score. Limits: 12 players/room, 80 rooms, 16 connections/IP and 70 messages/second.

## Launch gate

This is a prototype service. Public deployment is NOT included merely by committing these files. Before launch, test real remote pairs, network lag, room isolation, rate limiting, reconnect, abuse reporting, chat safety, privacy policy, load and operations. Scaling across multiple server instances needs shared room state or sticky routing.
