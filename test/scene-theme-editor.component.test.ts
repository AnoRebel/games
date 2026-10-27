// @vitest-environment happy-dom
/**
 * The scene theme editor creates, edits and deletes custom themes, previews
 * them live, and rejects duplicates and unreadable colour pairings.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import SceneThemeEditor from "../app/components/SceneThemeEditor.vue";
import { BUILTIN_SCENE_THEMES, resolveScene } from "../app/utils/sceneThemes";
import { MemoryStorage, SceneThemeStore } from "../app/utils/sceneThemeStore";

let store: SceneThemeStore;

/** Mount the editor bound to the store, re-rendering after each change. */
function mountEditor(gameId: string | null = null) {
  const props = () => {
    const s = store.load();
    const r = resolveScene({
      gameId,
      mode: "dark",
      custom: s.custom,
      global: s.global,
      byGame: s.byGame,
    });
    return {
      themes: [...Object.values(BUILTIN_SCENE_THEMES), ...s.custom],
      activeId: r.id,
      globalId: s.global,
      gameId,
      gameName: gameId ? "Bao" : null,
      assignedId: gameId ? (s.byGame[gameId] ?? null) : null,
      mode: "dark" as const,
    };
  };
  const wrapper = mount(SceneThemeEditor, {
    props: {
      ...props(),
      t: (k: string) => k,
      onSave: (d, id) => {
        const r = store.save(d, id);
        void wrapper.setProps(props());
        return r;
      },
      onRemove: (id) => {
        store.remove(id);
        void wrapper.setProps(props());
      },
      onSelectGlobal: (id) => {
        store.setGlobal(id);
        void wrapper.setProps(props());
      },
      onAssign: (g, id) => {
        store.assign(g, id);
        void wrapper.setProps(props());
      },
    },
  });
  return wrapper;
}

beforeEach(() => {
  store = new SceneThemeStore(new MemoryStorage());
});

describe("SceneThemeEditor", () => {
  it("creates a theme with a live preview and makes it selectable", async () => {
    const w = mountEditor();
    await w.get('[data-testid="new-theme"]').trigger("click");
    await w.get('[data-testid="theme-name"]').setValue("Sunset");
    await w.get('[data-testid="mode-dark"]').trigger("click");
    // Changing a role updates the preview immediately.
    await w.get('[data-testid="hex-surface"]').setValue("#203040");
    await w.get('[data-testid="hex-surface"]').trigger("change");
    expect(w.get('[data-testid="theme-preview"]').attributes("style")).toContain(
      "--games-scene-surface: #203040",
    );
    await w.get('[data-testid="theme-form"]').trigger("submit");
    await nextTick();
    const custom = store.load().custom;
    expect(custom.map((t) => t.name)).toEqual(["Sunset"]);
    expect(custom[0]!.colors.dark.surface).toBe("#203040");
    expect(w.find('[data-testid="theme-form"]').exists()).toBe(false);
    await w.get(`[data-testid="theme-${custom[0]!.id}"]`).trigger("click");
    expect(store.load().global).toBe(custom[0]!.id);
  });

  it("edits an existing theme", async () => {
    const saved = store.save({
      name: "Mine",
      colors: structuredClone(BUILTIN_SCENE_THEMES.neon.colors),
    });
    const id = saved.ok ? saved.theme.id : "";
    const w = mountEditor();
    await w.get('button[aria-label="theme.edit"]').trigger("click");
    await w.get('[data-testid="theme-name"]').setValue("Mine, renamed");
    await w.get('[data-testid="theme-form"]').trigger("submit");
    expect(store.load().custom).toEqual([
      expect.objectContaining({ id, name: "Mine, renamed" }),
    ]);
  });

  it("deletes a theme, falling back to Felt when it was active", async () => {
    const saved = store.save({
      name: "Gone",
      colors: structuredClone(BUILTIN_SCENE_THEMES.arcade.colors),
    });
    const id = saved.ok ? saved.theme.id : "";
    store.setGlobal(id);
    const w = mountEditor();
    await w.get(`[data-testid="delete-${id}"]`).trigger("click");
    expect(store.load().custom).toEqual([]);
    expect(store.load().global).toBe("felt");
    expect(w.find(`[data-testid="theme-${id}"]`).exists()).toBe(false);
  });

  it("rejects a duplicate name and keeps the existing theme unchanged", async () => {
    store.save({
      name: "Twin",
      colors: structuredClone(BUILTIN_SCENE_THEMES.felt.colors),
    });
    const before = store.load().custom;
    const w = mountEditor();
    await w.get('[data-testid="new-theme"]').trigger("click");
    await w.get('[data-testid="theme-name"]').setValue("twin");
    await w.get('[data-testid="theme-form"]').trigger("submit");
    expect(w.get('[data-testid="theme-errors"]').text()).toContain(
      "theme.errors.nameTaken",
    );
    expect(store.load().custom).toEqual(before);
  });

  it("rejects an invalid colour without replacing the role", async () => {
    const w = mountEditor();
    await w.get('[data-testid="new-theme"]').trigger("click");
    const swatch = w.get('[data-testid="color-text"]').element as HTMLInputElement;
    const previous = swatch.value;
    await w.get('[data-testid="hex-text"]').setValue("banana");
    await w.get('[data-testid="hex-text"]').trigger("change");
    expect(w.get('[data-testid="theme-errors"]').text()).toContain(
      "theme.errors.invalidColor",
    );
    expect((w.get('[data-testid="color-text"]').element as HTMLInputElement).value).toBe(
      previous,
    );
  });

  it("rejects a palette with an unreadable pairing, naming it", async () => {
    const w = mountEditor();
    await w.get('[data-testid="new-theme"]').trigger("click");
    await w.get('[data-testid="theme-name"]').setValue("Faint");
    await w.get('[data-testid="mode-light"]').trigger("click");
    const surface = BUILTIN_SCENE_THEMES.felt.colors.light.surface;
    await w.get('[data-testid="hex-text"]').setValue(surface);
    await w.get('[data-testid="hex-text"]').trigger("change");
    await w.get('[data-testid="theme-form"]').trigger("submit");
    expect(w.get('[data-testid="theme-errors"]').text()).toContain(
      "theme.errors.contrast",
    );
    expect(store.load().custom).toEqual([]);
  });

  it("assigns a theme to just this game", async () => {
    const w = mountEditor("bao");
    await w.get('[data-testid="scope-game"]').trigger("click");
    await w.get('[data-testid="theme-neon"]').trigger("click");
    expect(store.load().byGame).toEqual({ bao: "neon" });
    expect(store.load().global).toBeNull();
    await w.get('[data-testid="scope-global"]').trigger("click");
    expect(store.load().byGame).toEqual({});
  });
});
