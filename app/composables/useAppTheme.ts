/**
 * App-wide visual theme (Felt / Arcade / Neon) + motion intensity preference.
 *
 * Sets `data-game-theme` on <html> (drives themes.css tokens) and persists the
 * choice. Motion intensity ('rich' | 'subtle') gates the gamier animations.
 */
export type AppTheme = "felt" | "arcade" | "neon";
export type MotionLevel = "rich" | "subtle";

export const APP_THEMES: { id: AppTheme; name: string; swatch: string }[] = [
  { id: "felt", name: "Felt", swatch: "linear-gradient(135deg,#2f7a4d,#b58a3a)" },
  { id: "arcade", name: "Arcade", swatch: "linear-gradient(135deg,#3fc7d6,#e25bb0)" },
  { id: "neon", name: "Neon", swatch: "linear-gradient(135deg,#1a2740,#3ee0d0)" },
];

export function useAppTheme() {
  const theme = useLocalStorage<AppTheme>("games:app-theme", "felt");
  const motion = useLocalStorage<MotionLevel>("games:motion", "rich");

  // Reflect onto <html> so CSS tokens apply globally.
  if (import.meta.client) {
    watchEffect(() => {
      document.documentElement.dataset.gameTheme = theme.value;
    });
  }

  return { theme, motion, themes: APP_THEMES };
}

/** Shared helper: is rich motion active (and motion not reduced)? */
export function useRichMotion() {
  const { motion } = useAppTheme();
  const reduced = usePreferredReducedMotion();
  return computed(() => motion.value === "rich" && reduced.value !== "reduce");
}
