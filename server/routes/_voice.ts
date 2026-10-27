/**
 * Nitro native WebSocket endpoint (crossws) — WebRTC voice signalling relay.
 *
 * SEPARATE from the game socket (`_ws.ts`): voice must never touch the game
 * transport, which is shared with offline play. This route is a DUMB relay for a
 * WebRTC mesh — it carries no audio, only SDP/ICE. Media flows peer-to-peer.
 *
 * NAT note: this is SIGNALLING ONLY + a public STUN server (in the client), so
 * audio is DIRECT P2P. Peers behind symmetric NAT / restrictive firewalls may
 * fail to connect (they'll be in-voice but silent). Adding a TURN server, or
 * switching to Conduit's relay-capable media API (@conduit/client `.call()`),
 * would give a fallback path — deferred until it's actually needed.
 *
 * Protocol (client → server):
 *   { t: 'join',   roomId, peerId, name }   → join a voice room
 *   { t: 'signal', to, from, data }          → forward SDP/ICE to one peer
 *
 * Protocol (server → client):
 *   { t: 'peers',  peers: [{peerId,name}] }  → existing peers (to the joiner)
 *   { t: 'joined', peerId, name }            → a new peer joined (to the room)
 *   { t: 'left',   peerId }                  → a peer left (to the room)
 *   { t: 'signal', to, from, data }          → forwarded signalling
 */

import { defineWebSocketHandler } from "h3";

// --- abuse guards ----------------------------------------------------------
// Signalling (SDP/ICE) is larger than a game move — allow up to 64KB.
const MAX_MESSAGE_BYTES = 64 * 1024;
// Token bucket per peer: ~30 msgs/sec burst, refilling 20/sec. Trickle ICE can
// fan out a handful of candidates per new peer, so this is looser than the game
// socket but still bites floods.
const BUCKET_CAP = 30;
const BUCKET_REFILL_PER_MS = 20 / 1000;
interface Bucket {
  tokens: number;
  last: number;
}
const buckets = new Map<string, Bucket>();

function allow(peerId: string, now: number): boolean {
  let b = buckets.get(peerId);
  if (!b) {
    b = { tokens: BUCKET_CAP, last: now };
    buckets.set(peerId, b);
  }
  b.tokens = Math.min(BUCKET_CAP, b.tokens + (now - b.last) * BUCKET_REFILL_PER_MS);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// --- minimal peer surface --------------------------------------------------
// crossws Peer → the subset we use. Keeping our own surface (like _ws.ts's
// WsPeer) makes the relay unit-testable with a mock peer.
export interface VoicePeer {
  id: string;
  send: (data: string) => void;
}

interface VoiceMember {
  peer: VoicePeer;
  peerId: string;
  name: string;
}

/** roomId → (voicePeerId → member). Module-level, survives across connections. */
const rooms = new Map<string, Map<string, VoiceMember>>();
/** connection id → { roomId, peerId } so we can clean up on close. */
const bySocket = new Map<string, { roomId: string; peerId: string }>();

function send(peer: VoicePeer, msg: Record<string, unknown>): void {
  try {
    peer.send(JSON.stringify(msg));
  } catch {
    // A dead socket throws; the close handler will reap it.
  }
}

/**
 * The relay core, split out so tests can drive it with a mock peer. Returns
 * nothing; all effects are messages sent to peers.
 */
export function handleVoiceMessage(peer: VoicePeer, raw: string): void {
  let msg: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    msg = parsed as Record<string, unknown>;
  } catch {
    return;
  }

  const t = msg.t;
  if (t === "join") {
    const roomId = msg.roomId;
    const peerId = msg.peerId;
    const name = typeof msg.name === "string" ? msg.name : "";
    if (typeof roomId !== "string" || typeof peerId !== "string") return;
    if (!roomId || !peerId) return;

    let room = rooms.get(roomId);
    if (!room) {
      room = new Map();
      rooms.set(roomId, room);
    }

    // Tell the joiner who is already here (before adding itself).
    const existing = [...room.values()].map((m) => ({ peerId: m.peerId, name: m.name }));
    send(peer, { t: "peers", peers: existing });

    // Add the joiner and remember the mapping for cleanup.
    room.set(peerId, { peer, peerId, name });
    bySocket.set(peer.id, { roomId, peerId });

    // Announce the new peer to everyone else in the room.
    for (const m of room.values()) {
      if (m.peerId === peerId) continue;
      send(m.peer, { t: "joined", peerId, name });
    }
    return;
  }

  if (t === "signal") {
    const to = msg.to;
    const from = msg.from;
    if (typeof to !== "string" || typeof from !== "string") return;
    const loc = bySocket.get(peer.id);
    if (!loc) return; // must have joined a room first
    const room = rooms.get(loc.roomId);
    const target = room?.get(to);
    if (!target) return;
    // Forward verbatim to the single target peer.
    send(target.peer, { t: "signal", to, from, data: msg.data });
    return;
  }
}

/** Remove a peer (on socket close) and broadcast `left` to its room. */
export function handleVoiceClose(peer: VoicePeer): void {
  buckets.delete(peer.id);
  const loc = bySocket.get(peer.id);
  if (!loc) return;
  bySocket.delete(peer.id);
  const room = rooms.get(loc.roomId);
  if (!room) return;
  room.delete(loc.peerId);
  if (room.size === 0) {
    rooms.delete(loc.roomId);
    return;
  }
  for (const m of room.values()) {
    send(m.peer, { t: "left", peerId: loc.peerId });
  }
}

export default defineWebSocketHandler({
  open() {
    // Membership is established by the client's `join` message.
  },

  message(peer, message) {
    const text = message.text();
    if (text.length > MAX_MESSAGE_BYTES) return;
    // Date.now() is fine here — transport layer, not the deterministic engine.
    if (!allow(peer.id, Date.now())) return;
    handleVoiceMessage(peer as never, text);
  },

  close(peer) {
    handleVoiceClose(peer as never);
  },

  error(peer) {
    handleVoiceClose(peer as never);
  },
});
