import { describe, it, expect } from "vitest";
import {
  GameConfigError,
  defaultDifficulty,
  defaultVariant,
  resolveDifficulty,
  resolveSetup,
  resolveVariant,
  supportedDifficulties,
  variantName,
  type GameMeta,
} from "../src/index";
import { lastCardGame } from "../../game-last-card/src/index";
import { albastiniGame } from "../../game-albastini/src/index";

const base: GameMeta = {
  id: "demo",
  name: "Demo",
  tagline: "",
  minPlayers: 2,
  maxPlayers: 2,
  supportedPlayerCounts: [2],
};

const withVariants: GameMeta = {
  ...base,
  variants: [
    { id: "classic", name: "Classic" },
    { id: "fast", name: "Fast" },
  ],
  defaultVariant: "fast",
  difficulties: ["easy", "normal", "hard"],
  defaultDifficulty: "normal",
};

const demoGame = {
  meta: withVariants,
  defaultConfig: () => ({ variant: "fast", size: 8 }),
};

describe("variant metadata — defaults", () => {
  it("resolves the declared default variant and difficulty for an empty config", () => {
    const r = resolveSetup(demoGame, {});
    expect(r.variant).toBe("fast");
    expect(r.difficulty).toBe("normal");
    expect(r.config).toEqual({ variant: "fast", size: 8 });
  });

  it("falls back to the first variant when no default is declared", () => {
    expect(defaultVariant({ ...withVariants, defaultVariant: undefined })).toBe(
      "classic",
    );
  });

  it("falls back to normal when a game declares no tiers", () => {
    expect(supportedDifficulties(base)).toEqual(["easy", "normal", "hard"]);
    expect(defaultDifficulty(base)).toBe("normal");
  });

  it("merges a partial config over the defaults and strips difficulty", () => {
    const r = resolveSetup(demoGame, { variant: "classic", difficulty: "hard" });
    expect(r.config).toEqual({ variant: "classic", size: 8 });
    expect(r.difficulty).toBe("hard");
    expect("difficulty" in (r.config as object)).toBe(false);
  });

  it("names variants by id", () => {
    expect(variantName(withVariants, "classic")).toBe("Classic");
    expect(variantName(withVariants, "nope")).toBeUndefined();
    expect(variantName(withVariants, null)).toBeUndefined();
  });
});

describe("variant metadata — unknown values are rejected", () => {
  it("rejects an unknown variant with an error naming it", () => {
    expect(() => resolveSetup(demoGame, { variant: "turbo" })).toThrow(GameConfigError);
    expect(() => resolveVariant(withVariants, "turbo")).toThrow(/turbo/);
  });

  it("rejects an unknown difficulty instead of substituting a tier", () => {
    expect(() => resolveDifficulty(withVariants, "impossible")).toThrow(/impossible/);
    try {
      resolveSetup(demoGame, { difficulty: "impossible" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(GameConfigError);
      expect((e as GameConfigError).field).toBe("difficulty");
    }
  });

  it("rejects a tier the game does not declare", () => {
    const easyOnly = { ...base, difficulties: ["easy" as const] };
    expect(resolveDifficulty(easyOnly)).toBe("easy");
    expect(() => resolveDifficulty(easyOnly, "hard")).toThrow(GameConfigError);
  });
});

describe("variant metadata — games without variants are unchanged", () => {
  for (const game of [lastCardGame, albastiniGame]) {
    it(`${game.meta.name} resolves to its plain default config`, () => {
      const r = resolveSetup(game, null);
      expect(r.variant).toBeUndefined();
      expect(r.config).toEqual(game.defaultConfig());
      expect("variant" in (r.config as object)).toBe(false);
      expect(r.difficulty).toBe("normal");
    });

    it(`${game.meta.name} rejects a variant request`, () => {
      expect(() => resolveSetup(game, { variant: "anything" })).toThrow(GameConfigError);
    });

    it(`${game.meta.name} keeps partial-config merge semantics`, () => {
      const key = Object.keys(game.defaultConfig() as object)[0]!;
      const r = resolveSetup(game, { [key]: "x", difficulty: "easy" });
      expect((r.config as Record<string, unknown>)[key]).toBe("x");
      expect(r.difficulty).toBe("easy");
    });
  }
});
