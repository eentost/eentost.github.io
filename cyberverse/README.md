# CyberVerse — 3D virtual cybersecurity experience

Public front end: https://eentost.github.io/cyberverse/

This directory contains the **independent, static CyberVerse front end**. It does not replace the existing practical tools on the main site.

## Features

- 3D city with six districts and five enterable buildings.
- Third-person avatar with a GLTF animation path (Idle/Walk/Run) and a procedural humanoid fallback.
- Indoor investigation points, WASD/arrows, Shift sprint, E interact, mouse drag camera, mobile D-pad.
- Animated defensive shield and synthetic attack flows for phishing, ransomware and DDoS.
- Existing three four-step scenarios and personal notes remain unchanged.
- Optional WebSocket cooperation: room membership, avatar movement, chat, vote counts and authoritative joint resolution.

## How to use

Browse the cyber city and approach a building entrance, then press E or the interaction button. Inside, approach a console and press E again. Select a scenario and respond to the incident.

For real-time play, configure and deploy the separately delivered FastAPI companion server **outside GitHub Pages**. In the “실시간 공동 사고 대응” panel, enter the WSS address ending in `/ws`, e.g. `wss://your-domain.example/ws`, select a room, and invite a teammate. Both visitors must use the same server and room. Public GitHub Pages itself cannot host an active WebSocket/Python server. You can use solo training without it.

The server must set `ALLOWED_ORIGINS=https://eentost.github.io` (in the supplied Docker Compose bundle use `CYBERVERSE_ALLOWED_ORIGINS`) and must sit behind an HTTPS/TLS reverse proxy. The companion backend uses `COOPERATIVE_ONLY=1` to prevent a legacy direct-choice message from bypassing the vote. Majority vote resolves each incident stage; an unanswered vote window expires after 20 seconds.

## Assets and fallbacks

- Three.js 0.180.0 is loaded through jsDelivr via an import map; the sample animated character model is fetched from `threejs.org` as GLTF. These external asset origins require connectivity and successful CORS; no asset download or model integrity check has been completed in a deployed browser.
- If 3D cannot load, the original Canvas city and scenario UI remain available.
- Motion-reduction preference and a manual motion toggle are provided.
- The multiplayer backend does not run until an external server is actually deployed.

## Evidence, status and limitations

The underlying Python server's tests passed **11/11** locally, and the original live two-client HTTP/WebSocket smoke test passed. The updated public frontend has been committed to GitHub. A real GPU browser/production WSS/load/mobile test is not yet complete, so this is a **functionally implemented public beta**, not a certified production multi-user service.

Public launch still requires TLS, authenticated users, moderation/reporting, abuse controls, logging, room state durability/redistribution, capacity/load testing, privacy policy updates, and verified frontend telemetry.

This training environment simulates decisions and their impact; no live intrusion, harmful traffic or malware is executed.
