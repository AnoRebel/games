/**
 * Learnability content resolves per game, rule variant and locale, never
 * mixing languages, and every variant ships English and Swahili rules.
 */
import { describe, it, expect } from "vitest";
import { baoGame } from "@card-games/game-bao";
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

describe("game content — locale handling", () => {
  it("keeps Swahili and English structurally aligned for every game and variant", () => {
    for (const gameId of ["last-card", "albastini", "bao"]) {
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
