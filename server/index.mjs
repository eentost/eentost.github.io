import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://eentost.github.io,http://localhost:5173').split(',').map(x => x.trim());
const rooms = new Map();
const server = createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  if (origin && !ORIGINS.includes(origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
const send = (ws, value) => { if (ws.readyState === 1) ws.send(JSON.stringify(value)); };
wss.on('connection', ws => {
  ws.room = null; ws.side = null; ws.lastMessageAt = 0; ws.messageCount = 0;
  ws.on('message', raw => {
    const now = Date.now();
    if (now - ws.lastMessageAt > 1000) { ws.lastMessageAt = now; ws.messageCount = 0; }
    if (++ws.messageCount > 40) return send(ws, { type: 'error', message: 'Rate limit exceeded' });
    let m; try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Invalid JSON' }); }
    if (!ws.room) {
      if (m.type !== 'join' || !/^[A-Z0-9]{4,8}$/.test(String(m.room || '').toUpperCase()) || !['home','away'].includes(m.side)) return send(ws, { type: 'error', message: 'Invalid room or side' });
      const roomId = String(m.room).toUpperCase();
      let room = rooms.get(roomId); if (!room) { room = new Map(); rooms.set(roomId, room); }
      if (room.has(m.side)) return send(ws, { type: 'error', message: 'That team already has a player' });
      if (room.size >= 2) return send(ws, { type: 'error', message: 'Room is full' });
      ws.room = roomId; ws.side = m.side; room.set(m.side, ws);
      send(ws, { type: 'joined', room: roomId, side: m.side, peerConnected: room.size === 2 });
      for (const [side, peer] of room) if (peer !== ws) send(peer, { type: 'peer_joined', side: ws.side });
      return;
    }
    if (m.type !== 'input' || !m.payload || !['pitch','swing'].includes(m.payload.type)) return;
    const p = m.payload;
    if (p.type === 'pitch') {
      const d = p.decision;
      if (!d || typeof d.pitchType !== 'string' || !Number.isFinite(d.targetX) || !Number.isFinite(d.targetY) || (d.execution !== undefined && !Number.isFinite(d.execution))) return;
    } else if (![p.x,p.y,p.effort,p.elapsed].every(Number.isFinite) || Math.abs(p.x) > 2 || p.y < -1 || p.y > 3 || p.effort < 0 || p.effort > 2 || p.elapsed < 0 || p.elapsed > 10) return;
    const room = rooms.get(ws.room); const peer = room && [...room.entries()].find(([side]) => side !== ws.side)?.[1];
    if (peer) send(peer, p);
  });
  ws.on('close', () => {
    const room = rooms.get(ws.room); if (!room) return;
    room.delete(ws.side);
    for (const peer of room.values()) send(peer, { type: 'peer_left', side: ws.side });
    if (!room.size) rooms.delete(ws.room);
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Claudeball relay listening on ${PORT}`));
