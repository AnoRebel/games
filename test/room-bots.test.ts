/**
 * Server bot seats use the same shared policy as offline play: from the same
 * state and difficulty, the room's bot plays exactly the move an offline bot
 * would choose.
 */
import { describe, it, expect, vi } from "vitest";
import type { BaseGameState, BaseMove, Difficulty } from "@games/engine-core";
import { requireGame } from "@games/engine-core";
import { chooseBotMove, chooseBotMoveAsync } from "@games/game-ai";
import { LocalTransport } from "../app/transports/LocalTransport";

vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => [],
  saveRoomSnapshot: async () => {},
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));

const { RoomHub } = await import("../server/utils/roomHub");

class Peer {
  sent: Array<Record<string, unknown>> = [];
  constructor(public id: string) {}
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  subscribe() {}
  unsubscribe() {}
  publish() {}
  states() {
    return this.sent.filter((m) => m.t === "state") as {
      state: BaseGameState & { lastMove: BaseMove | null };
      legalMoves: BaseMove[];
    }[];
  }
}

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 2000 && !cond(); i++) await new Promise((r) => setTimeout(r, 1));
  expect(cond()).toBe(true);
};

function startBotRoom(gameId: string, variant: string, difficulty: Difficulty) {
  const hub = new RoomHub({ botDelayMs: 0 });
  const game = requireGame(gameId);
  const roomId = hub.createRoom({
    gameId,
    gameConfig: { ...(game.defaultConfig() as object), variant },
    maxPlayers: 2,
    minPlayers: 2,
    spectatorVisibility: "public",
    spectatorPasscode: "",
    botSeats: 1,
    difficulty,
  });
  const human = new Peer("H");
  hub.onMessage(human, JSON.stringify({ t: "join", roomId, playerId: "ph", name: "H" }));
  hub.onMessage(human, JSON.stringify({ t: "start", roomId }));
  return { hub, roomId, human, game };
}

describe("server bot seats", () => {
  for (const [gameId, variant] of [
    ["bao", "bao-la-kiswahili"],
    ["checkers", "international"],
  ] as const) {
    for (const difficulty of ["easy", "hard"] as const) {
      it(`${gameId} @ ${difficulty}: the room bot plays the offline policy's move`, async () => {
        const { hub, roomId, human } = startBotRoom(gameId, variant, difficulty);
        const first = human.states().at(-1)!;
        expect(first.state.players.map((p) => !!p.bot)).toEqual([false, true]);

        // The human moves; the bot (seat 1) answers on its own.
        hub.onMessage(
          human,
          JSON.stringify({ t: "move", roomId, move: first.legalMoves[0] }),
        );
        const afterHuman = human.states().at(-1)!.state;
        expect(afterHuman.activeSeat).toBe(1);
        await until(() => human.states().at(-1)!.state.version > afterHuman.version);
        const botMove = human.states().at(-1)!.state.lastMove;

        // Same state and difficulty, offline: identical decision, sync or sliced.
        const game = requireGame(gameId);
        expect(chooseBotMove(game, afterHuman, 1, difficulty)).toEqual(botMove);
        expect(await chooseBotMoveAsync(game, afterHuman, 1, difficulty)).toEqual(
          botMove,
        );
        hub.dispose();
      });
    }
  }

  it("an offline LocalTransport bot and a room bot agree from the same seed", async () => {
    const game = requireGame("checkers");
    const config = { variant: "drafti" };
    const players = [
      { id: "ph", name: "H", seat: 0 },
      { id: "bot-1", name: "Bot 2", seat: 1, bot: true },
    ];
    const local = new LocalTransport({
      game,
      players,
      config,
      seed: "parity",
      humanSeats: [0],
      botDelayMs: 0,
      difficulty: "hard",
    });
    const opening = local.getView().legalMoves[0]!;
    await local.submitMove(opening);
    await until(() => local.getView().state.activeSeat === 0);
    const offlineReply = (local.getView().state as unknown as { lastMove: BaseMove })
      .lastMove;
    local.destroy();

    const room = startBotRoom("checkers", "drafti", "hard");
    // Rooms seed games themselves, but checkers has no randomness, so the
    // room's starting position is the offline one.
    const roomState = room.human.states().at(-1)!.state;
    expect((roomState as unknown as { board: number[] }).board).toEqual(
      (
        game.createInitialState(config, players, "parity") as unknown as {
          board: number[];
        }
      ).board,
    );
    room.hub.onMessage(
      room.human,
      JSON.stringify({ t: "move", roomId: room.roomId, move: opening }),
    );
    const v = room.human.states().at(-1)!.state.version;
    await until(() => room.human.states().at(-1)!.state.version > v);
    expect(room.human.states().at(-1)!.state.lastMove).toEqual(offlineReply);
    room.hub.dispose();
  });

  it("requires enough seats including bots, and bots never get a member seat", () => {
    const { hub, human } = startBotRoom("bao", "bao-la-kujifunza", "normal");
    const room = human.sent.filter((m) => m.t === "room").at(-1) as {
      room: { members: { seat: number | null }[] };
    };
    expect(room.room.members).toHaveLength(1);
    expect(human.states().at(-1)!.state.players).toHaveLength(2);
    hub.dispose();
  });
});
