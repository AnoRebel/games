/**
 * Nitro native WebSocket endpoint (crossws) — carries the room/game protocol.
 *
 * Enabled by `nitro.experimental.websocket` in nuxt.config. Each connected peer
 * is bridged into the RoomHub, which enforces server-authoritative play,
 * per-viewer state redaction, host controls and spectator access control.
 *
 * Conduit (WebRTC P2P + relay) remains an optional enhancement behind the same
 * client-side GameTransport seam; this WS path is the reliable default carrier.
 */
import { defineWebSocketHandler } from "h3";
import { getRoomHub, type WsPeer } from "../utils/roomHub";

// --- abuse guards ----------------------------------------------------------
// A single move/chat/join message is tiny; anything large is abuse.
const MAX_MESSAGE_BYTES = 16 * 1024;
// Token bucket per peer: ~20 msgs/sec burst, refilling 10/sec. Normal play is
// a handful of messages per turn, so this only bites floods.
const BUCKET_CAP = 20;
const BUCKET_REFILL_PER_MS = 10 / 1000;
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

// crossws Peer → our minimal WsPeer surface.
function asWsPeer(peer: {
  id: string;
  send: (d: string) => void;
  subscribe: (t: string) => void;
  unsubscribe: (t: string) => void;
  publish: (t: string, d: string) => void;
}): WsPeer {
  return {
    id: peer.id,
    send: (d) => peer.send(d),
    subscribe: (t) => peer.subscribe(t),
    unsubscribe: (t) => peer.unsubscribe(t),
    publish: (t, d) => peer.publish(t, d),
  };
}

export default defineWebSocketHandler({
  open() {
    // Membership is established by the client's `join` message.
  },

  message(peer, message) {
    const text = message.text();
    // Drop oversized or flooding messages before they reach the hub.
    if (text.length > MAX_MESSAGE_BYTES) return;
    // Date.now() is fine here — server transport layer, not the deterministic engine.
    if (!allow(peer.id, Date.now())) return;
    getRoomHub().onMessage(asWsPeer(peer as never), text);
  },

  close(peer) {
    buckets.delete(peer.id);
    getRoomHub().onClose(asWsPeer(peer as never));
  },

  error(peer) {
    buckets.delete(peer.id);
    getRoomHub().onClose(asWsPeer(peer as never));
  },
});
