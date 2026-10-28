// @vitest-environment happy-dom
/**
 * The rules panel body renders the selected variant's rules, and a notice
 * (not another language) when the locale has no content.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RulesContent from "../app/components/RulesContent.vue";
import { lookupGameContent } from "../app/utils/gameContent";

const mountFor = (variant: string, locale: string, gameId = "bao") => {
  const c = lookupGameContent(gameId, variant, locale);
  return mount(RulesContent, {
    props: {
      rules: c.rules,
      missing: c.missing,
      variantName: variant,
      missingText: "missing",
      emptyText: "empty",
    },
  });
};

describe("RulesContent", () => {
  it("renders every section of the selected Bao variant", () => {
    const w = mountFor("bao-la-kujifunza", "en");
    const c = lookupGameContent("bao", "bao-la-kujifunza", "en");
    expect(w.findAll("section")).toHaveLength(c.rules.length);
    expect(w.text()).toContain("Every one of the 32 pits starts with 2 seeds");
    expect(w.get('[data-testid="rules-variant"]').text()).toBe("bao-la-kujifunza");
  });

  it("renders Swahili rules for the Swahili locale", () => {
    const w = mountFor("bao-la-kiswahili", "sw");
    expect(w.text()).toContain("Nyumba");
    expect(w.text()).toContain("na 22 mkononi kama akiba");
  });

  it("shows the missing-content notice rather than another language", () => {
    const w = mountFor("bao-la-kiswahili", "fr");
    expect(w.get('[data-testid="rules-missing"]').text()).toBe("missing");
    expect(w.findAll("section")).toHaveLength(0);
  });

  it.each(["drafti", "english", "international"])(
    "renders the %s checkers rules in both languages",
    (variant) => {
      for (const locale of ["en", "sw"]) {
        const c = lookupGameContent("checkers", variant, locale);
        const w = mountFor(variant, locale, "checkers");
        expect(w.findAll("section")).toHaveLength(c.rules.length);
        expect(w.findAll("li")).toHaveLength(c.rules.flatMap((r) => r.body).length);
      }
    },
  );
});
