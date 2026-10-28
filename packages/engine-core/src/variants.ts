/**
 * Declared rule variants and bot difficulty tiers.
 *
 * A game module may declare its selectable rule variants and the difficulty
 * tiers its bots support on `meta`. Setup, rooms, rules content and the
 * leaderboard all read that one declaration instead of per-game switches.
 * Games that declare no variants keep their single-config behaviour.
 */

import type { GameMeta } from "./types";

/** Bot strength tiers, weakest first. */
export type Difficulty = "easy" | "normal" | "hard";

/** Every tier, weakest first. */
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** The tier used when nothing is chosen. */
export const DEFAULT_DIFFICULTY: Difficulty = "normal";

/** One selectable rule variant. */
export interface VariantMeta {
  /** Stable id stored in config, state, rooms and results. */
  id: string;
  /** Display name (game-specific proper noun, not translated). */
  name: string;
}

/** Raised when a setup asks for a variant or difficulty a game does not declare. */
export class GameConfigError extends Error {
  constructor(
    message: string,
    /** Which setting was invalid. */
    readonly field: "variant" | "difficulty",
    /** The rejected value. */
    readonly value: unknown,
  ) {
    super(message);
    this.name = "GameConfigError";
  }
}

/** The tiers a game supports (all tiers when it declares none). */
export function supportedDifficulties(meta: GameMeta): readonly Difficulty[] {
  return meta.difficulties?.length ? meta.difficulties : DIFFICULTIES;
}

/** The game's default tier. */
export function defaultDifficulty(meta: GameMeta): Difficulty {
  const tiers = supportedDifficulties(meta);
  const declared = meta.defaultDifficulty;
  if (declared && tiers.includes(declared)) return declared;
  return tiers.includes(DEFAULT_DIFFICULTY) ? DEFAULT_DIFFICULTY : tiers[0]!;
}

/** The game's default variant id, or undefined when it declares none. */
export function defaultVariant(meta: GameMeta): string | undefined {
  if (!meta.variants?.length) return undefined;
  const declared = meta.defaultVariant;
  if (declared && meta.variants.some((v) => v.id === declared)) return declared;
  return meta.variants[0]!.id;
}

/**
 * Resolve a requested difficulty against the declared tiers. Missing values
 * fall back to the default; unknown values throw rather than silently picking
 * another tier.
 */
export function resolveDifficulty(meta: GameMeta, requested?: unknown): Difficulty {
  if (requested === undefined || requested === null || requested === "") {
    return defaultDifficulty(meta);
  }
  const tiers = supportedDifficulties(meta);
  if (typeof requested !== "string" || !tiers.includes(requested as Difficulty)) {
    throw new GameConfigError(
      `Unsupported difficulty "${String(requested)}" for ${meta.name}`,
      "difficulty",
      requested,
    );
  }
  return requested as Difficulty;
}

/**
 * Resolve a requested variant id. Missing values fall back to the default;
 * unknown ids throw. Returns undefined for games without variants (a variant
 * request for such a game is rejected).
 */
export function resolveVariant(meta: GameMeta, requested?: unknown): string | undefined {
  const missing = requested === undefined || requested === null || requested === "";
  if (!meta.variants?.length) {
    if (missing) return undefined;
    throw new GameConfigError(
      `${meta.name} has no rule variants (got "${String(requested)}")`,
      "variant",
      requested,
    );
  }
  if (missing) return defaultVariant(meta);
  if (typeof requested !== "string" || !meta.variants.some((v) => v.id === requested)) {
    throw new GameConfigError(
      `Unsupported variant "${String(requested)}" for ${meta.name}`,
      "variant",
      requested,
    );
  }
  return requested;
}

/** Display name of a variant id, or undefined when unknown. */
export function variantName(
  meta: GameMeta,
  id: string | null | undefined,
): string | undefined {
  if (!id) return undefined;
  return meta.variants?.find((v) => v.id === id)?.name;
}

/** A fully resolved setup: engine config plus the bot difficulty. */
export interface ResolvedSetup<C> {
  config: C;
  variant: string | undefined;
  difficulty: Difficulty;
}

/**
 * Merge a (possibly partial) setup over the game's default config and validate
 * the variant and difficulty. `difficulty` is a setup concern, not an engine
 * config field, so it is stripped from the returned config. For variant games
 * the resolved id is written back as `config.variant`.
 */
export function resolveSetup<C = Record<string, unknown>>(
  game: { readonly meta: GameMeta; defaultConfig(): unknown },
  partial?: Record<string, unknown> | null,
): ResolvedSetup<C> {
  const overrides: Record<string, unknown> = { ...(partial ?? {}) };
  const difficulty = resolveDifficulty(game.meta, overrides.difficulty);
  delete overrides.difficulty;
  const variant = resolveVariant(game.meta, overrides.variant);
  if (variant === undefined) delete overrides.variant;
  const config = {
    ...(game.defaultConfig() as object),
    ...overrides,
    ...(variant !== undefined ? { variant } : {}),
  } as C;
  return { config, variant, difficulty };
}
