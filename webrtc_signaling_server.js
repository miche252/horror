// Minimal WebSocket relay server with WebRTC signaling support
// Run: node relay_server.js
// Supports: Room management + WebRTC signaling (offer/answer/ICE)

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const ROOM_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

console.log('🚀 Starting WebRTC Signaling Server...');
console.log(`📡 Port: ${PORT}`);
console.log(`📁 Working directory: ${process.cwd()}`);
console.log(`🧹 Room cleanup: every ${CLEANUP_INTERVAL_MS/60000}min, max age ${ROOM_MAX_AGE_MS/60000}min`);

/** @type {Map<string, {hostId: string|null, peers: Map<string, any>, lastActivity: number}>} */
const rooms = new Map();

// Periodic cleanup of inactive rooms
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [code, room] of rooms.entries()) {
    // Delete if room is empty or inactive for too long
    if (room.peers.size === 0 || (now - room.lastActivity) > ROOM_MAX_AGE_MS) {
      rooms.delete(code);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} inactive rooms. Active rooms: ${rooms.size}`);
  }
  
  // Log memory usage
  const memUsage = process.memoryUsage();
  console.log(`💾 Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${rooms.size} rooms`);
}, CLEANUP_INTERVAL_MS);

function generateRoomCode() {
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

function sendToPeer(room, targetPeerId, obj) {
  const peer = room.peers.get(targetPeerId);
  if (peer && peer.ws) {
    send(peer.ws, obj);
  }
}

function cleanupRoomIfEmpty(code) {
  const r = rooms.get(code);
  if (!r) return;
  if (r.peers.size === 0) {
    rooms.delete(code);
    console.log(`🗑️ Room ${code} deleted (empty)`);
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebRTC Signaling Server is running.\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log('🔌 New WebSocket connection from:', req.socket.remoteAddress);
  console.log('   Headers:', req.headers);
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

    const currentRoomCode = ws._room;
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null;

    // Room management
    if (msg.type === "create_room") {
      let newCode = generateRoomCode();
      while (rooms.has(newCode)) newCode = generateRoomCode();

      const newRoom = { hostId: peerId, peers: new Map(), lastActivity: Date.now() };
      rooms.set(newCode, newRoom);
      newRoom.peers.set(peerId, { ws });
      ws._room = newCode;

      send(ws, { type: "room_created", room: newCode, host: true });
      console.log(`🏠 Room created: ${newCode} by ${peerId}`);
      return;
    }

    if (msg.type === "join_room") {
      const code = String(msg.room || "");
      const targetRoom = rooms.get(code);
      if (!targetRoom) {
        send(ws, { type: "error", code: "ROOM_NOT_FOUND" });
        return;
      }
      
      // Check room capacity (max 4 players for horror game)
      if (targetRoom.peers.size >= 4) {
        send(ws, { type: "error", code: "ROOM_FULL" });
        return;
      }
      
      targetRoom.peers.set(peerId, { ws });
      targetRoom.lastActivity = Date.now(); // Update activity timestamp
      ws._room = code;

      // Inform joiner with existing peers list
      const peerList = Array.from(targetRoom.peers.keys());
      send(ws, { 
        type: "room_joined", 
        room: code, 
        host: false, 
        peers: peerList 
      });
      
      // Notify others
      broadcast(targetRoom, peerId, { type: "peer_joined", peer_id: peerId });
      console.log(`👋 Peer ${peerId} joined room: ${code}`);
      return;
    }

    // WebRTC Signaling
    if (msg.type === "webrtc_offer") {
      const target = String(msg.target || "");
      if (room) {
        sendToPeer(room, target, {
          type: "webrtc_offer",
          from: peerId,
          sdp: msg.sdp,
          sdp_type: msg.sdp_type
        });
        console.log(`📤 OFFER from ${peerId} to ${target}`);
      }
      return;
    }

    if (msg.type === "webrtc_answer") {
      const target = String(msg.target || "");
      if (room) {
        sendToPeer(room, target, {
          type: "webrtc_answer",
          from: peerId,
          sdp: msg.sdp,
          sdp_type: msg.sdp_type
        });
        console.log(`📤 ANSWER from ${peerId} to ${target}`);
      }
      return;
    }

    if (msg.type === "webrtc_ice") {
      const target = String(msg.target || "");
      if (room) {
        sendToPeer(room, target, {
          type: "webrtc_ice",
          from: peerId,
          media: msg.media,
          index: msg.index,
          name: msg.name
        });
      }
      return;
    }

    // Legacy relay (fallback - not used with WebRTC)
    if (msg.type === "relay") {
      if (!currentRoomCode) return;
      if (!room) return;

      // Update activity timestamp on relay messages
      room.lastActivity = Date.now();

      // Forward payload as-is to everyone else in room.
      broadcast(room, peerId, { 
        type: "relay", 
        from: peerId, 
        payload: msg.payload ?? null 
      });
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
    
    // If host left, assign new host
    if (room.hostId === ws._peerId && room.peers.size > 0) {
      const newHost = room.peers.keys().next().value;
      room.hostId = newHost;
      console.log(`👑 New host assigned: ${newHost}`);
    }
    
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
  console.log(`✅ WebRTC Signaling Server listening on :${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in browser`);
  console.log(`📋 Supports: create_room, join_room, webrtc_offer, webrtc_answer, webrtc_ice`);
});
