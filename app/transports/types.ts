/**
 * GameTransport — the seam the UI binds to, regardless of offline vs online.
 *
 * The UI never talks to the engine or the network directly: it submits moves
 * and subscribes to redacted state through a transport. LocalTransport runs the
 * engine in-memory (offline); ConduitTransport (Group 6) relays to the
 * server-authoritative state. Same interface ⇒ identical UI for both.
 */
import type {
  BaseGameState,
  BaseMove,
  Player,
  ScoreResult,
  Seat,
} from "@games/engine-core";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  /** ISO timestamp (date-fns formatted at render). */
  at: string;
}

export interface PresenceInfo {
  playerId: string;
  name: string;
  seat: Seat | null;
  connected: boolean;
  spectator: boolean;
}

/** A redacted view of state plus derived helpers the UI needs. */
export interface TransportView<S extends BaseGameState, M extends BaseMove> {
  /**
   * True once real game state exists. Online transports start `false` (lobby /
   * before the host starts); the table must not render game state until ready.
   */
  ready: boolean;
  /** State as this viewer is entitled to see it (hands redacted). */
  state: S;
  /** Legal moves for the local viewer's seat (empty for spectators). */
  legalMoves: M[];
  /** Final scores, when terminal. */
  scores: ScoreResult | null;
  /** Whose turn it is from the viewer's perspective. */
  isMyTurn: boolean;
}

export interface GameTransport<
  S extends BaseGameState = BaseGameState,
  M extends BaseMove = BaseMove,
> {
  readonly mode: "local" | "online";
  /** The seat this client controls (null = spectator). */
  readonly viewerSeat: Seat | null;

  /** Current redacted view (reactive source lives in the implementation). */
  getView(): TransportView<S, M>;

  /** Submit a move; resolves with whether it was accepted. */
  submitMove(move: M): Promise<{ ok: boolean; error?: string }>;

  /** Subscribe to view changes; returns an unsubscribe fn. */
  onChange(cb: (view: TransportView<S, M>) => void): () => void;

  /** Presence of all participants. */
  getPresence(): PresenceInfo[];

  /**
   * Chat: send + subscribe. `sender` overrides the attributed identity — used by
   * local hotseat where multiple humans share one device, so the message is
   * stamped with the actual device owner rather than the rotating active seat.
   * Online ignores `sender` (the server attributes by the connection's member).
   */
  sendChat(
    body: string,
    sender?: { id: string; name: string },
  ): Promise<{ ok: boolean; error?: string }>;
  onChat(cb: (messages: ChatMessage[]) => void): () => void;
  getChat(): ChatMessage[];

  /** Players at the table. */
  getPlayers(): Player[];

  /** Tear down (unsubscribe, close connections). */
  destroy(): void;
}
