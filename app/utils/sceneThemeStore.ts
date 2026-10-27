/**
 * Viewer-local persistence for scene themes: the custom themes, the global
 * default, and per-game assignments, under `games:*` keys. Nothing here is
 * ever sent to a room or the server.
 */
import { SCENE_STORAGE_KEYS } from "./sceneRoles";
import {
  BUILTIN_SCENE_THEMES,
  DEFAULT_SCENE_THEME,
  parseCustomThemes,
  validateSceneTheme,
  type CustomSceneTheme,
  type SceneTheme,
  type SceneThemeError,
} from "./sceneThemes";
import type { SceneColors } from "./sceneRoles";

/** The subset of `Storage` the store needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SceneThemeState {
  custom: CustomSceneTheme[];
  /** Stored custom themes could not be read. */
  corrupt: boolean;
  /** Global default theme id; null follows the app theme. */
  global: string | null;
  byGame: Record<string, string>;
}

export type SaveResult =
  { ok: true; theme: CustomSceneTheme } | { ok: false; errors: SceneThemeError[] };

let idCounter = 0;

export class SceneThemeStore {
  constructor(private readonly storage: KeyValueStorage) {}

  load(): SceneThemeState {
    const { themes, corrupt } = parseCustomThemes(
      this.storage.getItem(SCENE_STORAGE_KEYS.customThemes),
    );
    let byGame: Record<string, string> = {};
    try {
      const raw = JSON.parse(this.storage.getItem(SCENE_STORAGE_KEYS.perGame) ?? "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        byGame = Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        );
      }
    } catch {
      byGame = {};
    }
    const global = this.storage.getItem(SCENE_STORAGE_KEYS.globalSelection);
    return { custom: themes, corrupt, global: global || null, byGame };
  }

  private writeThemes(themes: CustomSceneTheme[]) {
    this.storage.setItem(SCENE_STORAGE_KEYS.customThemes, JSON.stringify(themes));
  }

  /**
   * Validate and save a theme (new, or an edit of `editId`). A rejected save
   * writes nothing, so the previously active theme stays in effect.
   */
  save(draft: { name: string; colors: SceneColors }, editId?: string): SaveResult {
    const { custom } = this.load();
    const others = custom.filter((t) => t.id !== editId);
    const errors = validateSceneTheme(draft, others, { editing: !!editId });
    if (errors.length) return { ok: false, errors };
    const theme: CustomSceneTheme = {
      id:
        (editId as CustomSceneTheme["id"]) ??
        `custom:${Date.now().toString(36)}-${idCounter++}`,
      name: draft.name.trim(),
      colors: {
        light: { ...draft.colors.light },
        dark: { ...draft.colors.dark },
      },
    };
    const next = editId
      ? custom.map((t) => (t.id === editId ? theme : t))
      : [...custom, theme];
    this.writeThemes(next);
    return { ok: true, theme };
  }

  /**
   * Delete a custom theme. If it was the global default the scene falls back
   * to Felt; games assigned to it fall back to the global default.
   */
  remove(id: string) {
    const state = this.load();
    this.writeThemes(state.custom.filter((t) => t.id !== id));
    if (state.global === id) this.setGlobal(DEFAULT_SCENE_THEME);
    const byGame = Object.fromEntries(
      Object.entries(state.byGame).filter(([, v]) => v !== id),
    );
    this.storage.setItem(SCENE_STORAGE_KEYS.perGame, JSON.stringify(byGame));
  }

  /** Set the global default (null follows the app theme). */
  setGlobal(id: string | null) {
    if (id === null) this.storage.removeItem(SCENE_STORAGE_KEYS.globalSelection);
    else this.storage.setItem(SCENE_STORAGE_KEYS.globalSelection, id);
  }

  /** Assign a theme to one game (null clears the assignment). */
  assign(gameId: string, id: string | null) {
    const { byGame } = this.load();
    const next = Object.fromEntries(Object.entries(byGame).filter(([g]) => g !== gameId));
    if (id !== null) next[gameId] = id;
    this.storage.setItem(SCENE_STORAGE_KEYS.perGame, JSON.stringify(next));
  }

  /** Every theme a player can pick: built-ins first, then their own. */
  all(): SceneTheme[] {
    return [...Object.values(BUILTIN_SCENE_THEMES), ...this.load().custom];
  }
}

/** An in-memory storage (tests, and SSR where there is no localStorage). */
export class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
