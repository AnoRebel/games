/**
 * Per-game, per-variant learnability content (rules + tutorial steps).
 *
 * Every game ships English and Swahili content. Lookups use the active locale
 * only: a locale without content for a game or variant reports it as missing
 * rather than silently showing the other language.
 */
import {
  lastCardRules,
  lastCardTutorial,
  lastCardRulesSw,
  lastCardTutorialSw,
  type RulesSection,
  type TutorialStep,
} from "@card-games/game-last-card";
import {
  albastiniRules,
  albastiniTutorial,
  albastiniRulesSw,
  albastiniTutorialSw,
} from "@card-games/game-albastini";
import { baoContent, baoContentSw } from "@card-games/game-bao";
import { checkersContent, checkersContentSw } from "@card-games/game-checkers";

export type { RulesSection, TutorialStep };

export interface GameContent {
  rules: RulesSection[];
  tutorial: TutorialStep[];
}

/** Content for one game: a single entry, or one entry per rule variant. */
type GameEntry = GameContent | { byVariant: Record<string, GameContent> };

const CONTENT: Record<string, Record<string, GameEntry>> = {
  en: {
    "last-card": { rules: lastCardRules, tutorial: lastCardTutorial },
    albastini: { rules: albastiniRules, tutorial: albastiniTutorial },
    bao: { byVariant: baoContent },
    checkers: { byVariant: checkersContent },
  },
  sw: {
    "last-card": { rules: lastCardRulesSw, tutorial: lastCardTutorialSw },
    albastini: { rules: albastiniRulesSw, tutorial: albastiniTutorialSw },
    bao: { byVariant: baoContentSw },
    checkers: { byVariant: checkersContentSw },
  },
};

export const CONTENT_LOCALES = Object.keys(CONTENT);

export interface ContentLookup extends GameContent {
  /** True when the active locale has no content for this game/variant. */
  missing: boolean;
}

const EMPTY: GameContent = { rules: [], tutorial: [] };

/**
 * Rules and tutorial for a game in a locale. `variant` selects a rule
 * variant's content; when omitted the game's first declared variant is used.
 */
export function lookupGameContent(
  gameId: string,
  variant: string | null | undefined,
  locale: string,
): ContentLookup {
  const entry = CONTENT[locale]?.[gameId];
  if (!entry) return { ...EMPTY, missing: true };
  if (!("byVariant" in entry)) return { ...entry, missing: false };
  const key = variant ?? Object.keys(entry.byVariant)[0]!;
  const content = entry.byVariant[key];
  return content ? { ...content, missing: false } : { ...EMPTY, missing: true };
}

/** The variant ids a game has content for (empty for single-ruleset games). */
export function contentVariants(gameId: string, locale = "en"): string[] {
  const entry = CONTENT[locale]?.[gameId];
  return entry && "byVariant" in entry ? Object.keys(entry.byVariant) : [];
}
