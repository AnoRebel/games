/**
 * Rooms validate and keep the rule variant and bot difficulty: defaults,
 * rejections naming the bad value, lobby visibility, rehydration, rematch,
 * no mid-game changes, seat limits, and difficulty applying to bots only.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GameConfigError,
  requireGame,
  type BaseGameState,
  type BaseMove,
} from "@games/engine-core";

const snapshots: { roomId: string; data: unknown }[] = [];
vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => snapshots,
  saveRoomSnapshot: async (roomId: string, data: unknown) => {
    const i = snapshots.findIndex((s) => s.roomId === roomId);
    const entry = { roomId, data: JSON.parse(JSON.stringify(data)) };
    if (i >= 0) snapshots[i] = entry;
    else snapshots.push(entry);
  },
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));

const { RoomHub } = await import("../server/utils/roomHub");
const { buildRoomConfig } = await import("../server/utils/roomConfig");

/** The parts of server messages these tests read. */
interface Msg {
  t: string;
  room: Record<string, unknown>;
  state: BaseGameState & { version: number };
  legalMoves: BaseMove[];
  message: string;
  youAre: { seat: number | null; spectator: boolean };
}

class Peer {
  sent: Msg[] = [];
  constructor(public id: string) {}
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  subscribe() {}
  unsubscribe() {}
  publish() {}
  last(t: string): Msg {
    return [...this.sent].reverse().find((m) => m.t === t)!;
  }
}

type VariantState = BaseGameState & { variant: string };

const config = (gameId: string, body: Record<string, unknown> = {}) =>
  buildRoomConfig(requireGame(gameId), { gameId, playerCount: 2, ...body }, "");

function join(hub: InstanceType<typeof RoomHub>, roomId: string, id: string) {
  const p = new Peer(id);
  hub.onMessage(p, JSON.stringify({ t: "join", roomId, playerId: `p-${id}`, name: id }));
  return p;
}

describe("room config — variant and difficulty validation", () => {
  beforeEach(() => {
    new RoomHub().dispose(); // registers the games
  });

  it("stores a valid Bao variant and difficulty", () => {
    const c = config("bao", { variant: "bao-la-kujifunza", difficulty: "hard" });
    expect((c.gameConfig as { variant: string }).variant).toBe("bao-la-kujifunza");
    expect(c.difficulty).toBe("hard");
  });

  it("applies the defaults when none are chosen", () => {
    const c = config("checkers");
    expect((c.gameConfig as { variant: string }).variant).toBe("drafti");
    expect(c.difficulty).toBe("normal");
  });

  it("accepts the variant on the engine config too", () => {
    const c = config("checkers", { gameConfig: { variant: "english" } });
    expect((c.gameConfig as { variant: string }).variant).toBe("english");
  });

  it("rejects an unsupported variant by name", () => {
    expect(() => config("checkers", { variant: "pool" })).toThrow(GameConfigError);
    expect(() => config("checkers", { variant: "pool" })).toThrow(/pool/);
  });

  it("rejects an unsupported difficulty by name", () => {
    expect(() => config("bao", { difficulty: "brutal" })).toThrow(/brutal/);
  });

  it("caps rooms at the game's two seats and bots below that", () => {
    const c = config("bao", { playerCount: 6, botSeats: 5 });
    expect(c.maxPlayers).toBe(2);
    expect(c.minPlayers).toBe(2);
    expect(c.botSeats).toBe(1);
  });
});

describe("room — variant visibility and immutability", () => {
  beforeEach(() => {
    snapshots.length = 0;
  });

  it("shows the game and variant in the lobby and uses it for the match", () => {
    const hub = new RoomHub();
    const roomId = hub.createRoom(config("bao", { variant: "bao-la-kujifunza" }));
    const a = join(hub, roomId, "A");
    expect(a.last("room").room).toMatchObject({
      gameId: "bao",
      variant: "bao-la-kujifunza",
      difficulty: "normal",
      botSeats: 0,
    });
    expect(hub.listPublicRooms()[0]).toMatchObject({
      gameId: "bao",
      variant: "bao-la-kujifunza",
    });
    join(hub, roomId, "B");
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect((a.last("state").state as VariantState).variant).toBe("bao-la-kujifunza");
    hub.dispose();
  });

  it("refuses a variant change mid-game and keeps the current variant", () => {
    const hub = new RoomHub();
    const roomId = hub.createRoom(config("checkers", { variant: "english" }));
    const a = join(hub, roomId, "A");
    join(hub, roomId, "B");
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    hub.onMessage(
      a,
      JSON.stringify({ t: "configure", roomId, variant: "international" }),
    );
    expect(a.last("error").message).toMatch(/can't change during a game/);
    expect(a.last("room").room.variant).toBe("english");
    expect((a.last("state").state as VariantState).variant).toBe("english");
    hub.dispose();
  });

  it("lets the host change the variant in the lobby, rejecting unknown ones", () => {
    const hub = new RoomHub();
    const roomId = hub.createRoom(config("checkers"));
    const a = join(hub, roomId, "A");
    const b = join(hub, roomId, "B");
    hub.onMessage(b, JSON.stringify({ t: "configure", roomId, variant: "english" }));
    expect(a.last("room").room.variant).toBe("drafti"); // not the host
    hub.onMessage(
      a,
      JSON.stringify({ t: "configure", roomId, variant: "international" }),
    );
    expect(a.last("room").room.variant).toBe("international");
    hub.onMessage(a, JSON.stringify({ t: "configure", roomId, variant: "pool" }));
    expect(a.last("error").message).toMatch(/pool/);
    expect(a.last("room").room.variant).toBe("international");
    hub.dispose();
  });

  it("keeps variant and difficulty for a rematch", () => {
    const hub = new RoomHub();
    const roomId = hub.createRoom(
      config("bao", { variant: "bao-la-kujifunza", difficulty: "hard" }),
    );
    const a = join(hub, roomId, "A");
    const b = join(hub, roomId, "B");
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    hub.onMessage(a, JSON.stringify({ t: "end", roomId }));
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    expect(a.last("room").room).toMatchObject({
      variant: "bao-la-kujifunza",
      difficulty: "hard",
    });
    expect((b.last("state").state as VariantState).variant).toBe("bao-la-kujifunza");
    hub.dispose();
  });

  it("resumes a rehydrated room with the same variant and difficulty", async () => {
    vi.useFakeTimers();
    const hub = new RoomHub();
    const roomId = hub.createRoom(
      config("checkers", { variant: "international", difficulty: "easy" }),
    );
    const a = join(hub, roomId, "A");
    join(hub, roomId, "B");
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    const move = a.last("state").legalMoves[0];
    hub.onMessage(a, JSON.stringify({ t: "move", roomId, move }));
    await vi.advanceTimersByTimeAsync(1_100); // debounced snapshot
    hub.dispose();
    vi.useRealTimers();

    const restarted = new RoomHub();
    await restarted.rehydrate();
    const back = new Peer("A2");
    restarted.onMessage(
      back,
      JSON.stringify({ t: "join", roomId, playerId: "p-A", name: "A" }),
    );
    expect(back.last("room").room).toMatchObject({
      variant: "international",
      difficulty: "easy",
    });
    const state = back.last("state").state as VariantState & { size: number };
    expect(state.variant).toBe("international");
    expect(state.size).toBe(10);
    restarted.dispose();
  });
});

describe("room — seats and difficulty", () => {
  it("a third player in a full two-seat room becomes a spectator", () => {
    for (const gameId of ["bao", "checkers"]) {
      const hub = new RoomHub();
      const roomId = hub.createRoom(config(gameId));
      join(hub, roomId, "A");
      join(hub, roomId, "B");
      const c = join(hub, roomId, "C");
      expect(c.last("joined").youAre).toMatchObject({ seat: null, spectator: true });
      hub.dispose();
    }
  });

  it("refuses to start without both seats filled", () => {
    for (const gameId of ["bao", "checkers"]) {
      const hub = new RoomHub();
      const roomId = hub.createRoom(config(gameId));
      const a = join(hub, roomId, "A");
      hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
      expect(a.last("error").message).toMatch(/at least 2/);
      expect(a.last("state")).toBeUndefined();
      hub.dispose();
    }
  });

  it("two humans at easy play unassisted: every move is exactly theirs", async () => {
    const hub = new RoomHub({ botDelayMs: 0 });
    const roomId = hub.createRoom(config("checkers", { difficulty: "easy" }));
    const a = join(hub, roomId, "A");
    const b = join(hub, roomId, "B");
    hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
    const players = (a.last("state").state as BaseGameState).players;
    expect(players.some((p) => p.bot)).toBe(false);

    for (let i = 0; i < 6; i++) {
      const mover = i % 2 === 0 ? a : b;
      const view = mover.last("state");
      // Pick the LAST legal move — never what a bot would prefer by default.
      const move = view.legalMoves.at(-1) as BaseMove;
      const before = view.state.version;
      hub.onMessage(mover, JSON.stringify({ t: "move", roomId, move }));
      const after = a.last("state").state as BaseGameState & { lastMove: BaseMove };
      expect(after.version).toBe(before + 1);
      expect(after.lastMove).toEqual(move);
    }
    // Nothing moves on its own.
    const settled = a.last("state").state.version;
    await new Promise((r) => setTimeout(r, 30));
    expect(a.last("state").state.version).toBe(settled);
    hub.dispose();
  });
});
