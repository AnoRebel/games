/**
 * Appearance helpers shared by the composable, the app shell's pre-paint
 * script and tests: how light/dark mode and the contrast choice combine into
 * Crystal Neuo's data-theme.
 */
export type Contrast = "standard" | "high";

/** Where the contrast choice is stored (the other axes use the runtime's keys). */
export const CONTRAST_KEY = "games:contrast";

/** The data-theme value for a color mode and contrast. */
export function themeFor(dark: boolean, contrast: Contrast) {
  if (contrast === "high") return "high-contrast" as const;
  return dark ? ("dark" as const) : ("light" as const);
}

/**
 * Inline script for <head>: applies the stored contrast and color mode to
 * data-theme before first paint, next to the runtime's own pre-paint script.
 */
export function themePrePaintScript(colorModeKey: string): string {
  return (
    `(()=>{try{var d=document.documentElement,s=localStorage;` +
    `if(s.getItem(${JSON.stringify(CONTRAST_KEY)})==="high"){d.dataset.theme="high-contrast";return}` +
    `var m=s.getItem(${JSON.stringify(colorModeKey)})||"system";` +
    `var dark=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);` +
    `d.dataset.theme=dark?"dark":"light"}catch(e){}})();`
  );
}
