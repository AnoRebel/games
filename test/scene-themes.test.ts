/**
 * Scene themes: complete built-in palettes, WCAG contrast validation, local
 * persistence with global/per-game selection and robust fallbacks.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_CUSTOM_SCENE_THEMES,
  SCENE_ROLES,
  SCENE_STORAGE_KEYS,
  sceneVar,
} from "../app/utils/sceneRoles";
import {
  BUILTIN_SCENE_THEMES,
  contrastFailures,
  contrastRatio,
  draftFrom,
  resolveScene,
  sceneStyle,
  validateSceneTheme,
  type SceneSelection,
} from "../app/utils/sceneThemes";
import { MemoryStorage, SceneThemeStore } from "../app/utils/sceneThemeStore";

const felt = BUILTIN_SCENE_THEMES.felt;

describe("built-in scene themes", () => {
  it("define every role in both colour modes", () => {
    expect(Object.keys(BUILTIN_SCENE_THEMES)).toEqual(["felt", "arcade", "neon"]);
    for (const theme of Object.values(BUILTIN_SCENE_THEMES)) {
      for (const mode of ["light", "dark"] as const) {
        expect(Object.keys(theme.colors[mode]).sort()).toEqual([...SCENE_ROLES].sort());
      }
    }
  });

  it("meet WCAG AA for text, pieces and hints in both modes", () => {
    for (const theme of Object.values(BUILTIN_SCENE_THEMES)) {
      expect(contrastFailures(theme.colors)).toEqual([]);
    }
  });

  it("map roles to CSS variables", () => {
    expect(sceneVar("boardDark")).toBe("--games-scene-board-dark");
    expect(Object.keys(sceneStyle(felt.colors.dark))).toHaveLength(SCENE_ROLES.length);
  });

  it("default to Felt for new users", () => {
    const r = resolveScene({ mode: "light", custom: [], global: null, byGame: {} });
    expect(r.id).toBe("felt");
  });
});

describe("contrast validation", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("accepts passing pairs and names failing ones per mode", () => {
    const good = draftFrom(felt, "Good");
    expect(validateSceneTheme(good, [])).toEqual([]);

    const faint = draftFrom(felt, "Faint");
    faint.colors.dark.text = faint.colors.dark.surface; // text invisible in dark mode
    faint.colors.light.legal = faint.colors.light.boardDark; // hint invisible in light mode
    const errors = validateSceneTheme(faint, []);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "contrast",
          mode: "dark",
          fg: "text",
          bg: "surface",
          min: 4.5,
        }),
        expect.objectContaining({
          kind: "contrast",
          mode: "light",
          fg: "legal",
          bg: "boardDark",
          min: 3,
        }),
      ]),
    );
  });

  it("rejects invalid colours, empty and duplicate names, and the 21st theme", () => {
    const bad = draftFrom(felt, "  ");
    (bad.colors.light as Record<string, string>).accent = "not-a-colour";
    const kinds = validateSceneTheme(bad, []).map((e) => e.kind);
    expect(kinds).toContain("name-empty");
    expect(kinds).toContain("invalid-color");
    expect(validateSceneTheme(draftFrom(felt, "neon"), []).map((e) => e.kind)).toContain(
      "name-taken",
    );
    const many = Array.from({ length: MAX_CUSTOM_SCENE_THEMES }, (_, i) => ({
      id: `custom:${i}`,
      ...draftFrom(felt, `T${i}`),
    }));
    expect(
      validateSceneTheme(draftFrom(felt, "One more"), many).map((e) => e.kind),
    ).toContain("limit");
  });
});

describe("scene theme store", () => {
  let storage: MemoryStorage;
  let store: SceneThemeStore;
  const resolve = (gameId: string | null, extra: Partial<SceneSelection> = {}) => {
    const s = store.load();
    return resolveScene({
      gameId,
      mode: "dark",
      custom: s.custom,
      global: s.global,
      byGame: s.byGame,
      corrupt: s.corrupt,
      ...extra,
    });
  };
  beforeEach(() => {
    storage = new MemoryStorage();
    store = new SceneThemeStore(storage);
  });

  it("restores different selections per game, unassigned games using the global default", () => {
    store.setGlobal("arcade");
    store.assign("bao", "neon");
    store.assign("checkers", "felt");
    const reopened = new SceneThemeStore(storage); // a returning user
    const s = reopened.load();
    const pick = (g: string) =>
      resolveScene({
        gameId: g,
        mode: "light",
        custom: s.custom,
        global: s.global,
        byGame: s.byGame,
      }).id;
    expect(pick("bao")).toBe("neon");
    expect(pick("checkers")).toBe("felt");
    expect(pick("last-card")).toBe("arcade");
  });

  it("follows the app theme until a global default is chosen", () => {
    expect(resolve(null, { appTheme: "neon" }).id).toBe("neon");
    store.setGlobal("arcade");
    expect(resolve(null, { appTheme: "neon" }).id).toBe("arcade");
  });

  it("saves, edits and deletes custom themes, falling back when one is deleted", () => {
    const saved = store.save(draftFrom(felt, "Sunset"));
    expect(saved.ok).toBe(true);
    const id = saved.ok ? saved.theme.id : "";
    store.setGlobal(id);
    store.assign("bao", id);
    expect(resolve("bao").id).toBe(id);

    const edited = store.save({ ...draftFrom(felt, "Sunset 2") }, id);
    expect(edited.ok).toBe(true);
    expect(store.load().custom.map((t) => t.name)).toEqual(["Sunset 2"]);

    store.remove(id);
    expect(store.load().custom).toEqual([]);
    expect(store.load().byGame.bao).toBeUndefined(); // assignment cleared
    expect(resolve("bao").id).toBe("felt"); // global fell back to Felt
  });

  it("clearing a game's assignment restores the global default", () => {
    store.setGlobal("neon");
    store.assign("bao", "arcade");
    store.assign("bao", null);
    expect(resolve("bao").id).toBe("neon");
  });

  it("a game assigned to a missing theme uses the global default, else Felt", () => {
    storage.setItem(SCENE_STORAGE_KEYS.perGame, JSON.stringify({ bao: "custom:gone" }));
    store.setGlobal("arcade");
    expect(resolve("bao")).toMatchObject({ id: "arcade", unavailable: true });
    storage.setItem(SCENE_STORAGE_KEYS.globalSelection, "custom:also-gone");
    expect(resolve("bao").id).toBe("felt");
  });

  it("recovers from corrupt storage with the default palette, reporting it unavailable", () => {
    storage.setItem(SCENE_STORAGE_KEYS.customThemes, "{not json");
    storage.setItem(SCENE_STORAGE_KEYS.globalSelection, "custom:x");
    const r = resolve("bao");
    expect(r.id).toBe("felt");
    expect(r.unavailable).toBe(true);
    expect(Object.keys(r.palette)).toHaveLength(SCENE_ROLES.length);
    // Saving a new theme rewrites the store cleanly.
    expect(store.save(draftFrom(felt, "Fresh")).ok).toBe(true);
    expect(store.load().corrupt).toBe(false);
  });

  it("fills a missing role from the default while keeping the theme's other roles", () => {
    const partial = draftFrom(BUILTIN_SCENE_THEMES.arcade, "Partial");
    const record = { id: "custom:p", name: "Partial", colors: partial.colors };
    delete (record.colors.dark as Partial<typeof record.colors.dark>).legal;
    storage.setItem(SCENE_STORAGE_KEYS.customThemes, JSON.stringify([record]));
    store.setGlobal("custom:p");
    const r = resolve(null);
    expect(r.id).toBe("custom:p");
    expect(r.fallbackRoles).toEqual(["legal"]);
    expect(r.palette.legal).toBe(felt.colors.dark.legal);
    expect(r.palette.accent).toBe(BUILTIN_SCENE_THEMES.arcade.colors.dark.accent);
  });

  it("refuses more than 20 custom themes", () => {
    for (let i = 0; i < MAX_CUSTOM_SCENE_THEMES; i++) {
      expect(store.save(draftFrom(felt, `Theme ${i}`)).ok).toBe(true);
    }
    const r = store.save(draftFrom(felt, "Too many"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.map((e) => e.kind)).toContain("limit");
    expect(store.load().custom).toHaveLength(MAX_CUSTOM_SCENE_THEMES);
  });

  it("a rejected save leaves the previously active theme in effect", () => {
    const first = store.save(draftFrom(BUILTIN_SCENE_THEMES.neon, "Mine"));
    const id = first.ok ? first.theme.id : "";
    store.setGlobal(id);
    const before = resolve(null);
    const broken = draftFrom(BUILTIN_SCENE_THEMES.neon, "Mine");
    broken.colors.dark.ownPiece = broken.colors.dark.boardDark;
    const r = store.save(broken, id);
    expect(r.ok).toBe(false);
    expect(resolve(null)).toEqual(before);
  });
});
