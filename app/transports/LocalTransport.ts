/**
 * LocalTransport — offline play. Runs the engine in-memory with no network.
 *
 * Supports hotseat (the human viewer follows the active human seat) and
 * bot-filled seats. Same `GameTransport` surface as the online transport, so
 * the UI is identical for both (design D3 / transport parity).
 */
import {
  type BaseGameState,
  type BaseMove,
  type GameModule,
  type Player,
  type Seat,
  applyMove,
} from "@games/engine-core";
import { chooseBotMoveAsync, type BotDifficulty } from "@games/game-ai";
import type { ChatMessage, GameTransport, PresenceInfo, TransportView } from "./types";

export interface LocalTransportOptions<S extends BaseGameState, M extends BaseMove, C> {
  game: GameModule<S, M, C>;
  players: Player[];
  config: C;
  seed: string | number;
  /** Human-controlled seats (others are bots). Hotseat = all humans. */
  humanSeats: Seat[];
  /** ms delay before a bot acts, for watchability. */
  botDelayMs?: number;
  /** Bot skill (default 'normal'). Drives the heuristic strength. */
  difficulty?: BotDifficulty;
  /** Stamp messages without engine Date use (injected by the caller). */
  now?: () => string;
}

export class LocalTransport<
  S extends BaseGameState,
  M extends BaseMove,
  C,
> implements GameTransport<S, M> {
  readonly mode = "local" as const;

  private game: GameModule<S, M, C>;
  private state: S;
  private humanSeats: Set<Seat>;
  private players: Player[];
  private botDelayMs: number;
  private difficulty: BotDifficulty;
  private now: () => string;

  private changeCbs = new Set<(v: TransportView<S, M>) => void>();
  private chatCbs = new Set<(m: ChatMessage[]) => void>();
  private chat: ChatMessage[] = [];
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumps on every scheduled bot turn so a stale decision is dropped. */
  private botTicket = 0;
  private destroyed = false;

  constructor(opts: LocalTransportOptions<S, M, C>) {
    this.game = opts.game;
    this.players = opts.players;
    this.humanSeats = new Set(opts.humanSeats);
    this.botDelayMs = opts.botDelayMs ?? 600;
    this.difficulty = opts.difficulty ?? "normal";
    this.now = opts.now ?? (() => new Date().toISOString());
    this.state = opts.game.createInitialState(opts.config, opts.players, opts.seed);
    this.scheduleBotIfNeeded();
  }

  /** Strength the bot seats play at. */
  get botDifficulty(): BotDifficulty {
    return this.difficulty;
  }

  /** In hotseat, the viewer IS whoever's turn it is (among humans). */
  get viewerSeat(): Seat | null {
    const active = this.state.activeSeat;
    if (active !== null && this.humanSeats.has(active)) return active;
    // Default to the first human seat when it's a bot's turn (read-only view).
    return this.humanSeats.size ? [...this.humanSeats][0]! : null;
  }

  getView(): TransportView<S, M> {
    const viewer = this.viewerSeat;
    const redacted = this.game.redactFor(this.state, viewer);
    const active = this.state.activeSeat;
    const isMyTurn = active !== null && active === viewer;
    // Fetch legal moves for the viewer whenever they have ANY — including
    // off-turn moves like an out-of-turn "Last Card" declaration. The engine
    // returns [] when there's genuinely nothing to do.
    return {
      ready: true,
      state: redacted,
      legalMoves: viewer !== null ? this.game.getLegalMoves(this.state, viewer) : [],
      scores: this.game.isTerminal(this.state) ? this.game.getScores(this.state) : null,
      isMyTurn,
    };
  }

  async submitMove(move: M): Promise<{ ok: boolean; error?: string }> {
    if (this.destroyed) return { ok: false, error: "destroyed" };
    const result = applyMove(this.game, this.state, move);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.emitChange();
    this.scheduleBotIfNeeded();
    return { ok: true };
  }

  private scheduleBotIfNeeded() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.botTicket++;
    const active = this.state.activeSeat;
    if (active === null || this.game.isTerminal(this.state)) return;
    if (this.humanSeats.has(active)) return; // human's turn

    // Difficulty tunes pace as well as play: easy bots are slow & deliberate,
    // hard bots are snappy. (A hard bot that plays worse would just feel random.)
    const paceFactor =
      this.difficulty === "easy" ? 1.4 : this.difficulty === "hard" ? 0.55 : 1;
    const delay = Math.round(this.botDelayMs * paceFactor);
    // Think while the pacing delay runs: the move lands after the delay, not
    // after delay + search. The search yields between slices so the page stays
    // responsive, and a newer turn (or teardown) discards this decision.
    const ticket = ++this.botTicket;
    const state = this.state;
    const paced = new Promise<void>((resolve) => {
      this.botTimer = setTimeout(resolve, delay);
    });
    const decided = chooseBotMoveAsync(
      this.game,
      state,
      active,
      this.difficulty,
      undefined,
      () => performance.now(),
    );
    void Promise.all([decided, paced]).then(([move]) => {
      if (this.destroyed || ticket !== this.botTicket || this.state !== state) return;
      if (move) void this.submitMove(move);
    });
  }

  onChange(cb: (v: TransportView<S, M>) => void): () => void {
    this.changeCbs.add(cb);
    cb(this.getView());
    return () => this.changeCbs.delete(cb);
  }

  private emitChange() {
    const view = this.getView();
    for (const cb of this.changeCbs) cb(view);
  }

  getPresence(): PresenceInfo[] {
    return this.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      seat: p.seat,
      connected: true,
      spectator: false,
    }));
  }

  async sendChat(
    body: string,
    sender?: { id: string; name: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, error: "empty" };
    if (trimmed.length > 500) return { ok: false, error: "too-long" };
    // Prefer the explicit sender (the device owner). Only fall back to the
    // active-seat player when no identity was supplied.
    const fallback = this.players.find((p) => p.seat === this.viewerSeat);
    this.chat = [
      ...this.chat,
      {
        id: `${this.chat.length}-${this.state.version}`,
        senderId: sender?.id ?? fallback?.id ?? "local",
        senderName: sender?.name ?? fallback?.name ?? "You",
        body: trimmed,
        at: this.now(),
      },
    ];
    for (const cb of this.chatCbs) cb(this.chat);
    return { ok: true };
  }

  onChat(cb: (m: ChatMessage[]) => void): () => void {
    this.chatCbs.add(cb);
    cb(this.chat);
    return () => this.chatCbs.delete(cb);
  }

  getChat(): ChatMessage[] {
    return this.chat;
  }

  getPlayers(): Player[] {
    return this.players;
  }

  destroy() {
    this.destroyed = true;
    if (this.botTimer) clearTimeout(this.botTimer);
    this.changeCbs.clear();
    this.chatCbs.clear();
  }
}
