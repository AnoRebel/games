/**
 * Scene themes: complete light/dark palettes for every scene role, built-in
 * and user-made. Pure functions — validation (WCAG contrast), parsing stored
 * records, and resolving which palette a game shows — so the rules are
 * testable and the UI only renders the result.
 */
import {
  MAX_CUSTOM_SCENE_THEMES,
  SCENE_CONTRAST_PAIRS,
  SCENE_ROLES,
  sceneVar,
  type SceneColors,
  type ScenePalette,
  type SceneRole,
} from "./sceneRoles";

export type ColorMode = "light" | "dark";
export type BuiltinSceneId = "felt" | "arcade" | "neon";

export interface SceneTheme {
  id: string;
  name: string;
  colors: SceneColors;
}

/** A user-made theme. Ids are prefixed so they never collide with built-ins. */
export interface CustomSceneTheme extends SceneTheme {
  id: `custom:${string}`;
}

// ---- built-in palettes ---------------------------------------------------------

export const BUILTIN_SCENE_THEMES: Record<BuiltinSceneId, SceneTheme> = {
  felt: {
    id: "felt",
    name: "Felt",
    colors: {
      light: {
        surface: "#2c6a48",
        boardLight: "#e8dcc0",
        boardDark: "#3c7a56",
        cellBorder: "#173a28",
        ownPiece: "#fbf7ec",
        opponentPiece: "#1c1410",
        accent: "#f2c14e",
        legal: "#c6f36b",
        capture: "#ffb4a6",
        lastMove: "#ffe08a",
        text: "#fbfbf6",
      },
      dark: {
        surface: "#173d2a",
        boardLight: "#cdbf9c",
        boardDark: "#3b7553",
        cellBorder: "#0b2016",
        ownPiece: "#f4efe2",
        opponentPiece: "#120d0a",
        accent: "#f2c14e",
        legal: "#b7f04f",
        capture: "#ffc4b8",
        lastMove: "#ffd76a",
        text: "#eef4ea",
      },
    },
  },
  arcade: {
    id: "arcade",
    name: "Arcade",
    colors: {
      light: {
        surface: "#3b1f6e",
        boardLight: "#f3e9ff",
        boardDark: "#5b2fa6",
        cellBorder: "#24124a",
        ownPiece: "#ffffff",
        opponentPiece: "#ffd23f",
        accent: "#ff5fae",
        legal: "#3df5d0",
        capture: "#ff9d5c",
        lastMove: "#fff27a",
        text: "#fff8ff",
      },
      dark: {
        surface: "#1d1240",
        boardLight: "#d9c6ff",
        boardDark: "#432388",
        cellBorder: "#120a2c",
        ownPiece: "#ffffff",
        opponentPiece: "#ffd23f",
        accent: "#ff6fb7",
        legal: "#3df5d0",
        capture: "#ff9d5c",
        lastMove: "#fff27a",
        text: "#fbf2ff",
      },
    },
  },
  neon: {
    id: "neon",
    name: "Neon",
    colors: {
      light: {
        surface: "#16324f",
        boardLight: "#dbeefa",
        boardDark: "#1f4a6e",
        cellBorder: "#0b1d30",
        ownPiece: "#e9fbff",
        opponentPiece: "#ff4fd8",
        accent: "#2fe6d6",
        legal: "#7dff6a",
        capture: "#ffae57",
        lastMove: "#fff36b",
        text: "#f2fbff",
      },
      dark: {
        surface: "#0b1424",
        boardLight: "#2a3a55",
        boardDark: "#121f36",
        cellBorder: "#04080f",
        ownPiece: "#dffbff",
        opponentPiece: "#ff5fdc",
        accent: "#36f1e0",
        legal: "#8aff73",
        capture: "#ffb35f",
        lastMove: "#fff36b",
        text: "#eaf6ff",
      },
    },
  },
};

export const DEFAULT_SCENE_THEME: BuiltinSceneId = "felt";

// ---- colours and contrast ----------------------------------------------------------

/** Normalise `#rgb` / `#rrggbb` (any case) to `#rrggbb`, or null if invalid. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  return null;
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Not a colour: ${hex}`);
  const channel = (i: number) => {
    const c = parseInt(n.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A pairing that falls below its required ratio. */
export interface ContrastFailure {
  mode: ColorMode;
  fg: SceneRole;
  bg: SceneRole;
  ratio: number;
  min: number;
}

/** Every role pairing below WCAG AA in either mode. */
export function contrastFailures(colors: SceneColors): ContrastFailure[] {
  const out: ContrastFailure[] = [];
  for (const mode of ["light", "dark"] as const) {
    for (const { fg, bg, min } of SCENE_CONTRAST_PAIRS) {
      const ratio = contrastRatio(colors[mode][fg], colors[mode][bg]);
      if (ratio < min)
        out.push({ mode, fg, bg, ratio: Math.round(ratio * 100) / 100, min });
    }
  }
  return out;
}

// ---- validation -------------------------------------------------------------------

export type SceneThemeError =
  | { kind: "name-empty" }
  | { kind: "name-taken" }
  | { kind: "limit" }
  | { kind: "invalid-color"; mode: ColorMode; role: SceneRole }
  | ({ kind: "contrast" } & ContrastFailure);

/**
 * Check a theme before saving. `others` are the saved custom themes, without
 * the one being edited.
 */
export function validateSceneTheme(
  draft: { name: string; colors: SceneColors },
  others: readonly SceneTheme[],
  { editing = false }: { editing?: boolean } = {},
): SceneThemeError[] {
  const errors: SceneThemeError[] = [];
  const name = draft.name.trim();
  if (!name) errors.push({ kind: "name-empty" });
  const taken = [...others, ...Object.values(BUILTIN_SCENE_THEMES)].some(
    (t) => t.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (name && taken) errors.push({ kind: "name-taken" });
  if (!editing && others.length >= MAX_CUSTOM_SCENE_THEMES)
    errors.push({ kind: "limit" });
  let colorsValid = true;
  for (const mode of ["light", "dark"] as const) {
    for (const role of SCENE_ROLES) {
      if (!normalizeHex(draft.colors[mode]?.[role])) {
        errors.push({ kind: "invalid-color", mode, role });
        colorsValid = false;
      }
    }
  }
  if (colorsValid) {
    for (const f of contrastFailures(draft.colors))
      errors.push({ kind: "contrast", ...f });
  }
  return errors;
}

// ---- stored records ----------------------------------------------------------------

/**
 * Parse stored custom themes. Unreadable storage yields no themes and
 * `corrupt: true`; a record with bad or missing colours keeps its valid roles
 * (the rest fall back per role when resolved).
 */
export function parseCustomThemes(raw: string | null): {
  themes: CustomSceneTheme[];
  corrupt: boolean;
} {
  if (raw === null || raw === "") return { themes: [], corrupt: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { themes: [], corrupt: true };
  }
  if (!Array.isArray(data)) return { themes: [], corrupt: true };
  let corrupt = false;
  const themes: CustomSceneTheme[] = [];
  for (const item of data) {
    const rec = item as Partial<SceneTheme> | null;
    if (
      !rec ||
      typeof rec.id !== "string" ||
      !rec.id.startsWith("custom:") ||
      typeof rec.name !== "string"
    ) {
      corrupt = true;
      continue;
    }
    const colors = {} as SceneColors;
    for (const mode of ["light", "dark"] as const) {
      const src = (rec.colors as Partial<SceneColors> | undefined)?.[mode] ?? {};
      const palette = {} as ScenePalette;
      for (const role of SCENE_ROLES) {
        const hex = normalizeHex((src as Partial<ScenePalette>)[role]);
        if (hex) palette[role] = hex;
      }
      colors[mode] = palette;
    }
    themes.push({ id: rec.id as CustomSceneTheme["id"], name: rec.name, colors });
  }
  return { themes: themes.slice(0, MAX_CUSTOM_SCENE_THEMES), corrupt };
}

// ---- resolution --------------------------------------------------------------------

export interface ResolvedScene {
  /** Id of the theme in use (after fallbacks). */
  id: string;
  name: string;
  /** Complete palette for the mode — every role filled. */
  palette: ScenePalette;
  /** Roles the theme lacked, filled from the built-in default. */
  fallbackRoles: SceneRole[];
  /** The chosen theme could not be found or read. */
  unavailable: boolean;
  builtin: boolean;
}

export interface SceneSelection {
  gameId?: string | null;
  mode: ColorMode;
  /** App visual theme; the matching built-in scene is the global default. */
  appTheme?: BuiltinSceneId;
  custom: readonly SceneTheme[];
  /** Global default theme id (null = follow the app theme). */
  global: string | null;
  /** Per-game assignments. */
  byGame: Readonly<Record<string, string>>;
  /** Stored themes could not be read. */
  corrupt?: boolean;
}

function findTheme(id: string | null | undefined, custom: readonly SceneTheme[]) {
  if (!id) return null;
  if (id in BUILTIN_SCENE_THEMES) return BUILTIN_SCENE_THEMES[id as BuiltinSceneId];
  return custom.find((t) => t.id === id) ?? null;
}

/**
 * Which palette a game shows: its own assignment, else the global default,
 * else the built-in matching the app theme (Felt for new users). A missing or
 * unreadable choice falls back to Felt; missing roles fall back per role.
 */
export function resolveScene(sel: SceneSelection): ResolvedScene {
  const assigned = sel.gameId ? sel.byGame[sel.gameId] : undefined;
  const wanted = assigned ?? sel.global ?? null;
  let theme = findTheme(wanted, sel.custom);
  let unavailable = (wanted !== null && !theme) || !!sel.corrupt;
  if (!theme && assigned) {
    // A game's missing assignment falls back to the global default first.
    theme = findTheme(sel.global, sel.custom);
  }
  if (!theme)
    theme =
      BUILTIN_SCENE_THEMES[
        wanted ? DEFAULT_SCENE_THEME : (sel.appTheme ?? DEFAULT_SCENE_THEME)
      ];
  const base = BUILTIN_SCENE_THEMES[DEFAULT_SCENE_THEME].colors[sel.mode];
  const own = theme.colors?.[sel.mode] ?? ({} as Partial<ScenePalette>);
  const palette = {} as ScenePalette;
  const fallbackRoles: SceneRole[] = [];
  for (const role of SCENE_ROLES) {
    const hex = normalizeHex(own[role]);
    palette[role] = hex ?? base[role];
    if (!hex) fallbackRoles.push(role);
  }
  if (fallbackRoles.length === SCENE_ROLES.length) unavailable = true;
  return {
    id: theme.id,
    name: theme.name,
    palette,
    fallbackRoles,
    unavailable,
    builtin: theme.id in BUILTIN_SCENE_THEMES,
  };
}

/** CSS custom properties for a palette. */
export function sceneStyle(palette: ScenePalette): Record<string, string> {
  const style: Record<string, string> = {};
  for (const role of SCENE_ROLES) style[sceneVar(role)] = palette[role];
  return style;
}

/** A new custom theme, starting from a built-in palette. */
export function draftFrom(
  base: SceneTheme,
  name = "",
): { name: string; colors: SceneColors } {
  return {
    name,
    colors: { light: { ...base.colors.light }, dark: { ...base.colors.dark } },
  };
}
