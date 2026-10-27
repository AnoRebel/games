/**
 * Learnability content resolves per game, rule variant and locale, never
 * mixing languages, and every variant ships English and Swahili rules.
 */
import { describe, it, expect } from "vitest";
import { baoGame } from "@card-games/game-bao";
import { checkersGame } from "@card-games/game-checkers";
import { contentVariants, lookupGameContent } from "../app/utils/gameContent";

const text = (sections: { heading: string; body: string[] }[]) =>
  sections.map((s) => [s.heading, ...s.body].join("\n")).join("\n");

describe("game content — Bao variants", () => {
  it("has content for every declared Bao variant in both locales", () => {
    const declared = baoGame.meta.variants!.map((v) => v.id);
    expect(contentVariants("bao", "en")).toEqual(declared);
    expect(contentVariants("bao", "sw")).toEqual(declared);
  });

  it("describes the Bao la Kiswahili board, reserves, phases, nyumba and wins", () => {
    const { rules, missing } = lookupGameContent("bao", "bao-la-kiswahili", "en");
    expect(missing).toBe(false);
    const all = text(rules);
    for (const term of [
      "4 rows of 8 pits",
      "22 held in reserve",
      "Namua",
      "Mtaji",
      "compulsory",
      "nyumba",
      "front row is empty",
      "no legal move",
    ]) {
      expect(all.toLowerCase()).toContain(term.toLowerCase());
    }
    // The documented scope note: disputed optional rules are omitted.
    expect(all).toMatch(/kutakatia/);
    expect(all).toMatch(/tax/);
  });

  it("states the Bao la Kujifunza setup: two seeds per pit, no reserve, no nyumba, no namua", () => {
    const all = text(lookupGameContent("bao", "bao-la-kujifunza", "en").rules);
    expect(all).toContain("Every one of the 32 pits starts with 2 seeds");
    expect(all).toMatch(/no reserve seeds, no nyumba and no namua/i);
  });

  it("switches content when the variant changes", () => {
    const a = lookupGameContent("bao", "bao-la-kiswahili", "en");
    const b = lookupGameContent("bao", "bao-la-kujifunza", "en");
    expect(text(a.rules)).not.toEqual(text(b.rules));
    expect(a.tutorial.length).toBeGreaterThan(b.tutorial.length);
  });

  it("serves Swahili rules in the Swahili locale", () => {
    const sw = lookupGameContent("bao", "bao-la-kiswahili", "sw");
    expect(sw.missing).toBe(false);
    expect(text(sw.rules)).toContain("Maandalizi");
    expect(text(sw.rules)).not.toContain("Setup");
  });

  it("explains every difficulty tier in player terms", () => {
    for (const locale of ["en", "sw"]) {
      const all = text(lookupGameContent("bao", "bao-la-kiswahili", locale).rules);
      const tiers =
        locale === "en" ? ["Easy", "Normal", "Hard"] : ["Rahisi", "Kawaida", "Ngumu"];
      for (const t of tiers) expect(all).toContain(t);
    }
  });
});

describe("game content — Checkers variants", () => {
  it("has content for every declared Checkers variant in both locales", () => {
    const declared = checkersGame.meta.variants!.map((v) => v.id);
    expect(contentVariants("checkers", "en")).toEqual(declared);
    expect(contentVariants("checkers", "sw")).toEqual(declared);
  });

  it.each([
    [
      "drafti",
      [
        "8×8",
        "flying",
        "forward only",
        "any capture",
        "ends there",
        "One king each",
        "12",
      ],
    ],
    [
      "english",
      [
        "8×8",
        "exactly one square",
        "forward and backward",
        "any capture",
        "ends the move",
        "Forty moves",
      ],
    ],
    [
      "international",
      [
        "10×10",
        "flying",
        "forward and backward",
        "maximum number",
        "stops on the far row",
        "Twenty-five",
        "16 moves",
      ],
    ],
  ])(
    "states %s's board, kings, captures, maximal rule, promotion and draws",
    (variant, terms) => {
      const all = text(lookupGameContent("checkers", variant, "en").rules);
      for (const term of terms) expect(all).toContain(term);
    },
  );

  it("restarts the tutorial with the new variant's steps", () => {
    const d = lookupGameContent("checkers", "drafti", "en").tutorial;
    const i = lookupGameContent("checkers", "international", "en").tutorial;
    expect(d[0]!.content).toContain("8×8");
    expect(i[0]!.content).toContain("10×10");
    const topics = text(
      d.map((s) => ({ heading: s.title, body: [s.content] })),
    ).toLowerCase();
    for (const t of ["forward", "capture", "jump", "king"]) expect(topics).toContain(t);
  });

  it("serves Swahili checkers rules in the Swahili locale", () => {
    const all = text(lookupGameContent("checkers", "international", "sw").rules);
    expect(all).toContain("10×10");
    expect(all).toContain("Sare");
  });
});

describe("game content — locale handling", () => {
  it("keeps Swahili and English structurally aligned for every game and variant", () => {
    for (const gameId of ["last-card", "albastini", "bao", "checkers"]) {
      const variants = contentVariants(gameId);
      for (const v of variants.length ? variants : [undefined]) {
        const en = lookupGameContent(gameId, v, "en");
        const sw = lookupGameContent(gameId, v, "sw");
        expect(sw.missing).toBe(false);
        expect(sw.rules.map((s) => s.body.length)).toEqual(
          en.rules.map((s) => s.body.length),
        );
        expect(sw.tutorial.map((s) => s.target)).toEqual(
          en.tutorial.map((s) => s.target),
        );
      }
    }
  });

  it("reports missing content instead of falling back to another language", () => {
    expect(lookupGameContent("bao", "bao-la-kiswahili", "fr")).toMatchObject({
      missing: true,
      rules: [],
    });
    expect(lookupGameContent("bao", "unknown-variant", "en").missing).toBe(true);
  });

  it("keeps single-ruleset games working without a variant", () => {
    const lc = lookupGameContent("last-card", null, "en");
    expect(lc.missing).toBe(false);
    expect(lc.rules.length).toBeGreaterThan(0);
  });
});
