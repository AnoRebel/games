// The axis positions and defaults. tokens.test.ts asserts these match
// src/tokens.json, so the runtime cannot drift from the emitted CSS.

export type Theme = "light" | "dark" | "high-contrast";
export type ThemePreference = Theme | "system";
export type Density = "compact" | "comfortable" | "spacious";
export type Material = "refraction" | "tactile" | "signal" | "folio" | "bloom" | "hybrid";
export type Platform = "web" | "ios" | "android" | "windows" | "macos";
export type Transparency = "normal" | "reduced";

export const THEMES: readonly Theme[] = ["light", "dark", "high-contrast"];
export const DENSITIES: readonly Density[] = ["compact", "comfortable", "spacious"];
export const MATERIALS: readonly Material[] = ["refraction", "tactile", "signal", "folio", "bloom", "hybrid"];
export const PLATFORMS: readonly Platform[] = ["web", "ios", "android", "windows", "macos"];

export const DEFAULT_THEME: Theme = "light";
export const DEFAULT_DENSITY: Density = "comfortable";
export const DEFAULT_MATERIAL: Material = "refraction";
export const DEFAULT_PLATFORM: Platform = "web";

/** Materials that render translucent glass, and so offer refraction controls. */
export const GLASS_MATERIALS: readonly Material[] = ["refraction", "bloom", "hybrid"];
