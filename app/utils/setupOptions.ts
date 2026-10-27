/**
 * Setup choices read from a game's declared metadata — rule variants and bot
 * difficulty tiers — so offline and online setup offer identical choices with
 * identical defaults, and no per-game switches are needed.
 */
import {
  type Difficulty,
  type GameMeta,
  defaultDifficulty,
  defaultVariant,
  supportedDifficulties,
} from "@card-games/engine-core";

export interface SetupItem<T> {
  label: string;
  value: T;
}

/** Locale keys for each tier's label and its one-line explanation. */
export const DIFFICULTY_KEYS: Record<Difficulty, { label: string; help: string }> = {
  easy: { label: "setup.diffEasy", help: "setup.diffEasyHelp" },
  normal: { label: "setup.diffNormal", help: "setup.diffNormalHelp" },
  hard: { label: "setup.diffHard", help: "setup.diffHardHelp" },
};

export function variantItems(meta: GameMeta | null): SetupItem<string>[] {
  return (meta?.variants ?? []).map((v) => ({ label: v.name, value: v.id }));
}

export function difficultyItems(
  meta: GameMeta | null,
  t: (key: string) => string,
): SetupItem<Difficulty>[] {
  if (!meta) return [];
  return supportedDifficulties(meta).map((d) => ({
    label: t(DIFFICULTY_KEYS[d].label),
    value: d,
  }));
}

export interface SetupSelection {
  /** Chosen rule variant (null for games without variants). */
  variant: string | null;
  difficulty: Difficulty;
}

export function setupDefaults(meta: GameMeta | null): SetupSelection {
  return {
    variant: meta ? (defaultVariant(meta) ?? null) : null,
    difficulty: meta ? defaultDifficulty(meta) : "normal",
  };
}

/** Bots only exist where seats are left to them; difficulty is shown only then. */
export function hasBots(
  mode: "offline" | "online",
  seats: { totalPlayers: number; humanCount: number; botSeats: number },
): boolean {
  return mode === "offline" ? seats.humanCount < seats.totalPlayers : seats.botSeats > 0;
}

export interface OfflineStart {
  totalPlayers: number;
  humanCount: number;
  /** Engine config overrides plus `variant` and `difficulty`. */
  config: Record<string, unknown>;
}

export interface OnlineStart {
  totalPlayers: number;
  visibility: "public" | "locked";
  customId?: string;
  /** Engine config overrides including `variant`. */
  config: Record<string, unknown> | null;
  difficulty: Difficulty;
  botSeats: number;
  turnTimeoutMs?: number;
  persist?: boolean;
  maxSpectators?: number;
}

/** Merge the variant into a game's option overrides (variant games only). */
export function withVariant(
  options: Record<string, unknown> | null,
  selection: SetupSelection,
): Record<string, unknown> | null {
  if (!selection.variant) return options;
  return { ...(options ?? {}), variant: selection.variant };
}

export function offlineStart(
  seats: { totalPlayers: number; humanCount: number },
  options: Record<string, unknown> | null,
  selection: SetupSelection,
): OfflineStart {
  return {
    ...seats,
    config: {
      ...(withVariant(options, selection) ?? {}),
      difficulty: selection.difficulty,
    },
  };
}

export function onlineStart(
  room: Omit<OnlineStart, "config" | "difficulty">,
  options: Record<string, unknown> | null,
  selection: SetupSelection,
): OnlineStart {
  return {
    ...room,
    config: withVariant(options, selection),
    difficulty: selection.difficulty,
  };
}
