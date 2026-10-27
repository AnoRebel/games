/**
 * RoomHub tests — server-authoritative online logic, exercised with a mock
 * crossws peer (no real socket). Covers: seating, start gate, hidden-hand
 * redaction, illegal/out-of-turn rejection, and spectator access control.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RoomHub, type WsPeer } from "../server/utils/roomHub";
import type { RoomConfig } from "../server/utils/roomTypes";
import { defaultLastCardConfig } from "@games/game-last-card";

/** A mock peer that records everything sent to it. */
class MockPeer implements WsPeer {
  sent: Array<Record<string, unknown>> = [];
  subscriptions = new Set<string>();
  constructor(public id: string) {}
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  subscribe(t: string) {
    this.subscriptions.add(t);
  }
  unsubscribe(t: string) {
    this.subscriptions.delete(t);
  }
  publish() {
    /* not used by tests */
  }
  last(type: string) {
    return [...this.sent].reverse().find((m) => m.t === type);
  }
}

function lastCardConfig(over: Partial<RoomConfig> = {}): RoomConfig {
  return {
    gameId: "last-card",
    gameConfig: defaultLastCardConfig(),
    maxPlayers: 4,
    minPlayers: 2,
    spectatorVisibility: "public",
    spectatorPasscode: "",
    ...over,
  };
}

describe("RoomHub — reconnection", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
  });

  it("a player who reconnects (new clientId, same playerId) reclaims their seat", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect(a.last("joined").youAre.seat).toBe(0);

    // A's tab closes (disconnect, seat kept), then reopens with a NEW clientId.
    hub.onClose(a);
    const a2 = new MockPeer("A2"); // new connection, same stable playerId 'pa'
    hub.onMessage(a2, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));

    // Reclaims seat 0 — NOT a fresh spectator (this was the screenshot bug).
    expect(a2.last("joined").youAre.seat).toBe(0);
    expect(a2.last("joined").youAre.spectator).toBe(false);
    // The room shows exactly 2 seated, both connected (no orphaned ghost member).
    const room = a2.last("room").room;
    const seated = room.members.filter((m: { seat: number | null }) => m.seat !== null);
    expect(seated.length).toBe(2);
    expect(room.members.every((m: { connected: boolean }) => m.connected)).toBe(true);
    // A2 receives game state with its own hand visible.
    expect(a2.last("state").state.hands["0"].length).toBeGreaterThan(0);
  });

  it("sets a reconnect grace deadline when a seated player drops mid-game", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    hub.onClose(b);
    const room = a.last("room").room;
    expect(room.disconnectGraceUntil).toBeTruthy();
    expect(room.phase).toBe("in-progress"); // not ended yet — grace window open

    // Reconnect clears the countdown.
    const b2 = new MockPeer("B2");
    hub.onMessage(b2, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    expect(a.last("room").room.disconnectGraceUntil).toBeNull();
  });
});

describe("RoomHub — seating & start", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
  });

  it("seats joiners, gates start on min players, then deals", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");

    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    // A is host, seated at 0.
    expect(a.last("joined").isHost).toBe(true);
    expect(a.last("joined").youAre.seat).toBe(0);

    // Start with only 1 player → rejected.
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect(a.last("error")?.message).toMatch(/at least/i);

    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    // Both now receive state.
    expect(a.last("state")).toBeTruthy();
    expect(b.last("state")).toBeTruthy();
  });

  it("redacts hidden hands per viewer", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    const aState = a.last("state").state;
    const bState = b.last("state").state;
    // A sees its own real hand (seat 0). B's hand count is preserved (for backs
    // + animations) but the identities are hidden (face-down placeholders), and
    // A's view of B must NOT match B's view of B.
    expect(aState.hands["0"].length).toBe(7);
    expect(aState.hands["1"].length).toBe(7);
    expect(aState.hands["1"]).not.toEqual(bState.hands["1"]);
    // B sees the mirror.
    expect(bState.hands["1"].length).toBe(7);
    expect(bState.hands["0"].length).toBe(7);
    expect(bState.hands["0"]).not.toEqual(aState.hands["0"]);
  });

  it("rejects an out-of-turn / illegal move", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    // B (seat 1) tries to move when it's seat 0's turn.
    hub.onMessage(
      b,
      JSON.stringify({ t: "move", roomId, move: { type: "draw", seat: 1 } }),
    );
    expect(b.last("error")).toBeTruthy();
  });
});

describe("RoomHub — spectator access control", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
  });

  it("public room admits a spectator", () => {
    const roomId = hub.createRoom(lastCardConfig({ spectatorVisibility: "public" }));
    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({ t: "join", roomId, playerId: "ps", name: "S", asSpectator: true }),
    );
    expect(s.last("joined")?.youAre.spectator).toBe(true);
    expect(s.last("denied")).toBeUndefined();
  });

  it("locked room rejects a spectator without the passcode and sends no state", () => {
    const roomId = hub.createRoom(
      lastCardConfig({ spectatorVisibility: "locked", spectatorPasscode: "1234" }),
    );
    // seat a player and start so there IS state to (not) leak
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({
        t: "join",
        roomId,
        playerId: "ps",
        name: "S",
        asSpectator: true,
        spectatorPasscode: "wrong",
      }),
    );
    expect(s.last("denied")).toBeTruthy();
    expect(s.last("state")).toBeUndefined(); // no game state leaked
  });

  it("locked room admits a spectator with the correct passcode", () => {
    const roomId = hub.createRoom(
      lastCardConfig({ spectatorVisibility: "locked", spectatorPasscode: "1234" }),
    );
    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({
        t: "join",
        roomId,
        playerId: "ps",
        name: "S",
        asSpectator: true,
        spectatorPasscode: "1234",
      }),
    );
    expect(s.last("joined")?.youAre.spectator).toBe(true);
  });

  it("host can lock a previously-public room", () => {
    const roomId = hub.createRoom(lastCardConfig({ spectatorVisibility: "public" }));
    const a = new MockPeer("A");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(
      a,
      JSON.stringify({
        t: "set-visibility",
        roomId,
        visibility: "locked",
        passcode: "9999",
      }),
    );
    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({ t: "join", roomId, playerId: "ps", name: "S", asSpectator: true }),
    );
    expect(s.last("denied")).toBeTruthy();
  });

  it("enforces the spectator cap: admits up to the limit, denies past it", () => {
    const roomId = hub.createRoom(lastCardConfig({ maxSpectators: 1 }));
    const s1 = new MockPeer("S1");
    const s2 = new MockPeer("S2");
    hub.onMessage(
      s1,
      JSON.stringify({
        t: "join",
        roomId,
        playerId: "ps1",
        name: "S1",
        asSpectator: true,
      }),
    );
    hub.onMessage(
      s2,
      JSON.stringify({
        t: "join",
        roomId,
        playerId: "ps2",
        name: "S2",
        asSpectator: true,
      }),
    );
    expect(s1.last("joined")?.youAre.spectator).toBe(true);
    expect(s2.last("joined")).toBeUndefined();
    expect(s2.last("denied")).toBeTruthy();
  });

  it("maxSpectators: 0 forbids spectators entirely", () => {
    const roomId = hub.createRoom(lastCardConfig({ maxSpectators: 0 }));
    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({ t: "join", roomId, playerId: "ps", name: "S", asSpectator: true }),
    );
    expect(s.last("joined")).toBeUndefined();
    expect(s.last("denied")).toBeTruthy();
  });

  it("the cap also applies to a player who arrives to a full room (becomes a spectator)", () => {
    // 2-seat room, no spectators allowed. Two players fill it; a third joiner
    // who wanted to PLAY would fall back to spectator — and must be denied.
    const roomId = hub.createRoom(lastCardConfig({ maxPlayers: 2, maxSpectators: 0 }));
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    const c = new MockPeer("C");
    hub.onMessage(c, JSON.stringify({ t: "join", roomId, playerId: "pc", name: "C" }));
    expect(c.last("joined")).toBeUndefined();
    expect(c.last("denied")).toBeTruthy();
  });

  it("a reconnecting spectator is not double-counted against the cap", () => {
    const roomId = hub.createRoom(lastCardConfig({ maxSpectators: 1 }));
    const s = new MockPeer("S");
    hub.onMessage(
      s,
      JSON.stringify({ t: "join", roomId, playerId: "ps", name: "S", asSpectator: true }),
    );
    // Same playerId rejoins on a new connection — reclaims the spectator slot,
    // must not be rejected as "over the cap".
    const s2 = new MockPeer("S-again");
    hub.onMessage(
      s2,
      JSON.stringify({ t: "join", roomId, playerId: "ps", name: "S", asSpectator: true }),
    );
    expect(s2.last("joined")?.youAre.spectator).toBe(true);
    expect(s2.last("denied")).toBeUndefined();
  });
});

describe("RoomHub — manual end", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
  });

  it("the host ending the game broadcasts endedBy with their name", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(
      a,
      JSON.stringify({ t: "join", roomId, playerId: "pa", name: "Alice" }),
    );
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "Bob" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect(a.last("room").room.endedBy).toBeNull();

    // Host (A) ends the game.
    hub.onMessage(a, JSON.stringify({ t: "end", roomId }));
    // Everyone gets a room snapshot: finished + endedBy = the host's name.
    expect(b.last("room").room.phase).toBe("finished");
    expect(b.last("room").room.endedBy).toBe("Alice");
  });

  it("a NON-host cannot end the game", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(
      a,
      JSON.stringify({ t: "join", roomId, playerId: "pa", name: "Alice" }),
    );
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "Bob" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    // B (not host) tries to end — ignored.
    hub.onMessage(b, JSON.stringify({ t: "end", roomId }));
    expect(a.last("room").room.phase).toBe("in-progress");
    expect(a.last("room").room.endedBy).toBeNull();
  });

  it("a rematch (start) after a manual end clears endedBy", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(
      a,
      JSON.stringify({ t: "join", roomId, playerId: "pa", name: "Alice" }),
    );
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "Bob" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    hub.onMessage(a, JSON.stringify({ t: "end", roomId }));
    expect(a.last("room").room.endedBy).toBe("Alice");
    // Host restarts → fresh game, endedBy cleared, phase back to in-progress.
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect(a.last("room").room.phase).toBe("in-progress");
    expect(a.last("room").room.endedBy).toBeNull();
  });
});

describe("RoomHub — custom ids & public listing", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
  });

  it("honors a sanitized custom id and falls back when it collides", () => {
    const id = hub.createRoom(lastCardConfig(), "Friday Night!");
    expect(id).toBe("friday-night");
    // Same requested id again → must not collide, so a generated id is used.
    const id2 = hub.createRoom(lastCardConfig(), "friday-night");
    expect(id2).not.toBe("friday-night");
  });

  it("deletes a room immediately when the last member explicitly leaves", () => {
    const roomId = hub.createRoom(lastCardConfig(), "leavers");
    const a = new MockPeer("A");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    expect(hub.getRoom(roomId)).toBeTruthy();
    hub.onMessage(a, JSON.stringify({ t: "leave", roomId }));
    expect(hub.getRoom(roomId)).toBeUndefined();
  });

  it("lists public, non-finished rooms but hides locked ones", () => {
    const pub = hub.createRoom(
      lastCardConfig({ spectatorVisibility: "public" }),
      "open-table",
    );
    hub.createRoom(
      lastCardConfig({ spectatorVisibility: "locked", spectatorPasscode: "1234" }),
      "secret",
    );
    const a = new MockPeer("A");
    hub.onMessage(
      a,
      JSON.stringify({ t: "join", roomId: pub, playerId: "pa", name: "A" }),
    );

    const list = hub.listPublicRooms();
    expect(list.map((r) => r.id)).toEqual(["open-table"]);
    expect(list[0]!.seated).toBe(1);
    expect(list[0]!.maxPlayers).toBe(4);
  });
});

describe("RoomHub — turn timer", () => {
  let hub: RoomHub;
  beforeEach(() => {
    hub = new RoomHub();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("auto-plays for a seat that lets its turn time out", () => {
    const roomId = hub.createRoom(lastCardConfig({ turnTimeoutMs: 10_000 }));
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));

    const before = a.last("state")?.state?.version ?? 0;
    // Nobody moves → the active seat's turn times out.
    vi.advanceTimersByTime(10_050);
    const after = a.last("state")?.state?.version ?? 0;
    // A move was auto-applied, which is what the timeout guarantees: the state
    // advanced. We deliberately do NOT assert the turn passed to the other
    // seat — the room is dealt from a random seed, and in a 2-player game an
    // auto-played reverse acts as a skip, so the turn legitimately comes back
    // to the same seat. Asserting otherwise made this test fail whenever the
    // deal happened to put an 8 in the timing-out player's hand.
    expect(after).toBeGreaterThan(before);
  });

  it("does NOT auto-play when no turn limit is configured", () => {
    const roomId = hub.createRoom(lastCardConfig()); // no turnTimeoutMs
    const a = new MockPeer("A");
    const b = new MockPeer("B");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "pb", name: "B" }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    const before = a.last("state")?.state?.version ?? 0;
    vi.advanceTimersByTime(120_000);
    expect(a.last("state")?.state?.version ?? 0).toBe(before); // unchanged
  });
});

describe("RoomHub — empty-room reaping", () => {
  let hub: RoomHub;
  beforeEach(() => {
    vi.useFakeTimers();
    hub = new RoomHub();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reaps a room that is created but never joined", () => {
    hub.createRoom(lastCardConfig());
    expect(hub.roomCount()).toBe(1);
    // Nobody ever joins — after the empty-room grace it must be cleaned up.
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(0);
  });

  it("keeps a never-joined room alive when it opts into persist", () => {
    hub.createRoom(lastCardConfig({ persist: true }));
    expect(hub.roomCount()).toBe(1);
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(1);
  });

  it("a join cancels the pending reap, and the room survives past the grace", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(1); // still occupied
  });

  it("reaps once the last member disconnects", () => {
    const roomId = hub.createRoom(lastCardConfig());
    const a = new MockPeer("A");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onClose(a);
    expect(hub.roomCount()).toBe(1); // grace period still running
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(0);
  });

  it("does not reap an emptied room that opted into persist", () => {
    const roomId = hub.createRoom(lastCardConfig({ persist: true }));
    const a = new MockPeer("A");
    hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "pa", name: "A" }));
    hub.onClose(a);
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(1);
  });
});
