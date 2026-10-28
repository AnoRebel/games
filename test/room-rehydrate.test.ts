/**
 * Rehydrated rooms (restart-survival) must still be reaped if nobody comes
 * back. A rehydrated room has no connected peers by definition, so nothing in
 * the normal disconnect path would ever arm the reaper for it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const snapshots: { roomId: string; data: unknown }[] = [];

vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => snapshots,
  saveRoomSnapshot: async () => {},
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));

const { RoomHub } = await import("../server/utils/roomHub");
const { defaultLastCardConfig, lastCardGame } = await import("@games/game-last-card");

function inProgressSnapshot(id: string, persist = false) {
  const gameConfig = defaultLastCardConfig();
  // A real engine state — a rejoining player triggers redactFor, which needs
  // the genuine shape (players/hands/drawPile).
  const state = lastCardGame.createInitialState(
    gameConfig,
    [
      { id: "pa", name: "A", seat: 0 },
      { id: "pb", name: "B", seat: 1 },
    ],
    `seed-${id}`,
  );
  return {
    roomId: id,
    data: {
      id,
      config: {
        gameId: "last-card",
        gameConfig,
        maxPlayers: 2,
        minPlayers: 2,
        spectatorVisibility: "public",
        spectatorPasscode: "",
        ...(persist ? { persist: true } : {}),
      },
      phase: "in-progress",
      hostClientId: "gone",
      members: [
        {
          clientId: "gone",
          playerId: "pa",
          name: "A",
          seat: 0,
          spectator: false,
          connected: true,
        },
      ],
      state,
      startedAt: new Date(0).toISOString(),
      endedAt: null,
      endedBy: null,
    },
  };
}

describe("RoomHub — rehydrated rooms are reaped when nobody returns", () => {
  beforeEach(() => {
    snapshots.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reaps a rehydrated room after the (longer) rehydrate grace", async () => {
    snapshots.push(inProgressSnapshot("r1"));
    const hub = new RoomHub();
    await hub.rehydrate();
    expect(hub.roomCount()).toBe(1);

    // Still alive well past the normal 60s empty-room grace...
    vi.advanceTimersByTime(60_050);
    expect(hub.roomCount()).toBe(1);

    // ...but reaped once the 10-minute rehydrate window elapses.
    vi.advanceTimersByTime(10 * 60_000);
    expect(hub.roomCount()).toBe(0);
  });

  it("a returning player cancels the reap", async () => {
    snapshots.push(inProgressSnapshot("r2"));
    const hub = new RoomHub();
    await hub.rehydrate();

    const sent: unknown[] = [];
    const peer = {
      id: "back",
      send: (d: string) => sent.push(JSON.parse(d)),
      subscribe: () => {},
      unsubscribe: () => {},
      publish: () => {},
    };
    // Same playerId reclaims the seat, which cancels the pending reap.
    hub.onMessage(
      peer,
      JSON.stringify({ t: "join", roomId: "r2", playerId: "pa", name: "A" }),
    );

    vi.advanceTimersByTime(20 * 60_000);
    expect(hub.roomCount()).toBe(1);
  });

  it("never reaps a rehydrated room that opted into persist", async () => {
    snapshots.push(inProgressSnapshot("r3", true));
    const hub = new RoomHub();
    await hub.rehydrate();

    vi.advanceTimersByTime(60 * 60_000);
    expect(hub.roomCount()).toBe(1);
  });
});
