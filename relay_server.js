// Minimal WebSocket relay server with rooms.
// Run: node relay_server.js

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

console.log('🚀 Starting relay server...');
console.log(`📡 Port: ${PORT}`);
console.log(`📁 Working directory: ${process.cwd()}`);

/** @type {Map<string, {hostId: string|null, peers: Map<string, any>}>} */
const rooms = new Map();

function roomCode() {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000));
}

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (_) {}
}

function broadcast(room, fromPeerId, obj) {
  for (const [peerId, peer] of room.peers.entries()) {
    if (peerId === fromPeerId) continue;
    send(peer.ws, obj);
  }
}

function cleanupRoomIfEmpty(code) {
  const r = rooms.get(code);
  if (!r) return;
  if (r.peers.size === 0) rooms.delete(code);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Relay server is running.\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log('🔌 New WebSocket connection');
  const peerId = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  ws._peerId = peerId;
  ws._room = null;

  console.log(`👤 Peer connected: ${peerId}`);
  send(ws, { type: "hello", peer_id: peerId });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }

    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "create_room") {
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();

      const room = { hostId: peerId, peers: new Map() };
      rooms.set(code, room);
      room.peers.set(peerId, { ws });
      ws._room = code;

      send(ws, { type: "room_created", room: code, host: true });
      return;
    }

    if (msg.type === "join_room") {
      const code = String(msg.room || "");
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", code: "ROOM_NOT_FOUND" });
        return;
      }
      room.peers.set(peerId, { ws });
      ws._room = code;

      // Inform joiner + host/others
      send(ws, { type: "room_joined", room: code, host: false, peers: Array.from(room.peers.keys()) });
      broadcast(room, peerId, { type: "peer_joined", peer_id: peerId });
      return;
    }

    if (msg.type === "relay") {
      const code = ws._room;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      // Forward payload as-is to everyone else in room.
      broadcast(room, peerId, { type: "relay", from: peerId, payload: msg.payload ?? null });
      return;
    }
  });

  ws.on("close", () => {
    console.log(`👋 Peer disconnected: ${ws._peerId}`);
    const code = ws._room;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.peers.delete(ws._peerId);
    broadcast(room, ws._peerId, { type: "peer_left", peer_id: ws._peerId });
    if (room.hostId === ws._peerId) room.hostId = null;
    cleanupRoomIfEmpty(code);
  });

  ws.on("error", (error) => {
    console.error(`❌ WebSocket error for peer ${ws._peerId}:`, error);
  });
});

server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('ERROR: Failed to start server!');
    console.error('Error details:', err.message);
    console.error('Port:', PORT);
    console.error('Try:');
    console.error('1. Check if port is already in use');
    console.error('2. Run as administrator');
    console.error('3. Use different port: set PORT=8081 && node relay_server.js');
    process.exit(1);
  }
  console.log(`✅ Relay server listening on :${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in browser`);
});

