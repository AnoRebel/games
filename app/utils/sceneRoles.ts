/**
 * Scene theme contract — the color roles every game scene (card tables and
 * 4×8 / 8×8 / 10×10 boards) reads, so a new game inherits theming from the
 * shared roles instead of needing its own palette in every theme.
 *
 * Roles are applied as `--games-scene-<role>` CSS variables on a scene wrapper;
 * global chrome keeps the app theme tokens.
 */

/** Every scene color role. */
export const SCENE_ROLES = [
  "surface",
  "boardLight",
  "boardDark",
  "cellBorder",
  "ownPiece",
  "opponentPiece",
  "accent",
  "legal",
  "capture",
  "lastMove",
  "text",
] as const;

export type SceneRole = (typeof SCENE_ROLES)[number];

/** A complete palette for one color mode (hex colors). */
export type ScenePalette = Record<SceneRole, string>;

/** A scene theme covers both color modes. */
export interface SceneColors {
  light: ScenePalette;
  dark: ScenePalette;
}

/** CSS custom property carrying a role, e.g. `--games-scene-board-dark`. */
export function sceneVar(role: SceneRole): string {
  return `--games-scene-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * Pairings that must stay legible, checked per color mode: `min` is the WCAG
 * AA ratio — 4.5:1 for text, 3:1 for graphical objects.
 */
export const SCENE_CONTRAST_PAIRS: {
  fg: SceneRole;
  bg: SceneRole;
  min: number;
}[] = [
  { fg: "text", bg: "surface", min: 4.5 },
  { fg: "ownPiece", bg: "boardDark", min: 3 },
  { fg: "opponentPiece", bg: "boardDark", min: 3 },
  { fg: "legal", bg: "boardDark", min: 3 },
  { fg: "capture", bg: "boardDark", min: 3 },
  { fg: "lastMove", bg: "boardDark", min: 3 },
  { fg: "accent", bg: "surface", min: 3 },
];

/** Upper bound on saved custom scene themes. */
export const MAX_CUSTOM_SCENE_THEMES = 20;

/** Local storage keys for scene theming (viewer-local, never sent to rooms). */
export const SCENE_STORAGE_KEYS = {
  customThemes: "games:scene-themes",
  globalSelection: "games:scene-theme",
  perGame: "games:scene-theme-by-game",
} as const;
