/**
 * Crystal Neuo runtime: read and set every configuration axis on the page.
 *
 * Each setting is an attribute on the root element (or any ancestor, for a
 * scoped subtree) and is persisted to localStorage. Setting one never touches
 * another. Framework-free and safe to import during SSR: nothing touches the
 * DOM until a function is called.
 *
 *   data-theme         light | dark | high-contrast   (preference may be "system")
 *   data-density       compact | comfortable | spacious
 *   data-material      refraction | tactile | signal | folio | bloom | hybrid
 *   data-platform      web | ios | android | windows | macos
 *   data-transparency  reduced (absent = normal)
 *   data-refraction    on | off            (glass bends light at the rim)
 *   data-glass-frost   off (absent = on)   (glass blurs what is behind it)
 *   data-glass-rim     off (absent = on)   (specular rim light)
 */
import {
  DEFAULT_DENSITY,
  DEFAULT_MATERIAL,
  DEFAULT_PLATFORM,
  DENSITIES,
  MATERIALS,
  PLATFORMS,
  THEMES,
  type Density,
  type Material,
  type Platform,
  type Theme,
  type ThemePreference,
  type Transparency,
} from "./axes";

export * from "./axes";
export { detectPlatform } from "./platform";
export {
  GLASS_SELECTOR,
  refractionSupported,
  startRefraction,
  type RefractionOptions,
} from "./refraction";

/** localStorage keys, shared with the pre-paint script. */
export const STORAGE_KEYS = {
  theme: "crystal-neuo:theme",
  density: "crystal-neuo:density",
  material: "crystal-neuo:material",
  platform: "crystal-neuo:platform",
  transparency: "crystal-neuo:transparency",
  refraction: "crystal-neuo:refraction",
  frost: "crystal-neuo:glass-frost",
  rim: "crystal-neuo:glass-rim",
} as const;

export type Toggle = "on" | "off";
const TOGGLES: readonly Toggle[] = ["on", "off"];

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage blocked (private mode, sandbox): the attribute still applies. */
  }
}

const rootEl = (root?: HTMLElement) => root ?? document.documentElement;

/** The OS colour scheme, for the "system" theme preference. */
export function systemTheme(): Theme {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemePreference(): ThemePreference {
  return read<ThemePreference>(STORAGE_KEYS.theme, [...THEMES, "system"], "system");
}

export function setTheme(pref: ThemePreference, root?: HTMLElement): void {
  write(STORAGE_KEYS.theme, pref);
  rootEl(root).dataset.theme = pref === "system" ? systemTheme() : pref;
}

export function getDensity(): Density {
  return read(STORAGE_KEYS.density, DENSITIES, DEFAULT_DENSITY);
}

export function setDensity(density: Density, root?: HTMLElement): void {
  write(STORAGE_KEYS.density, density);
  rootEl(root).dataset.density = density;
}

export function getMaterial(): Material {
  return read(STORAGE_KEYS.material, MATERIALS, DEFAULT_MATERIAL);
}

export function setMaterial(material: Material, root?: HTMLElement): void {
  write(STORAGE_KEYS.material, material);
  rootEl(root).dataset.material = material;
}

export function getPlatform(): Platform {
  return read(STORAGE_KEYS.platform, PLATFORMS, DEFAULT_PLATFORM);
}

export function setPlatform(platform: Platform, root?: HTMLElement): void {
  write(STORAGE_KEYS.platform, platform);
  rootEl(root).dataset.platform = platform;
}

export function getTransparency(): Transparency {
  return read<Transparency>(STORAGE_KEYS.transparency, ["normal", "reduced"], "normal");
}

/** Explicit reduced transparency, for browsers (Safari) that never report the OS setting. */
export function setTransparency(value: Transparency, root?: HTMLElement): void {
  write(STORAGE_KEYS.transparency, value);
  if (value === "reduced") rootEl(root).dataset.transparency = "reduced";
  else delete rootEl(root).dataset.transparency;
}

export function getRefraction(): Toggle {
  return read(STORAGE_KEYS.refraction, TOGGLES, "off");
}

/** Turn live refraction on or off. It renders only where `startRefraction()` found a capable engine. */
export function setRefraction(value: Toggle, root?: HTMLElement): void {
  write(STORAGE_KEYS.refraction, value);
  rootEl(root).dataset.refraction = value;
}

export function getGlassFrost(): Toggle {
  return read(STORAGE_KEYS.frost, TOGGLES, "on");
}

export function setGlassFrost(value: Toggle, root?: HTMLElement): void {
  write(STORAGE_KEYS.frost, value);
  if (value === "off") rootEl(root).dataset.glassFrost = "off";
  else delete rootEl(root).dataset.glassFrost;
}

export function getGlassRim(): Toggle {
  return read(STORAGE_KEYS.rim, TOGGLES, "on");
}

export function setGlassRim(value: Toggle, root?: HTMLElement): void {
  write(STORAGE_KEYS.rim, value);
  if (value === "off") rootEl(root).dataset.glassRim = "off";
  else delete rootEl(root).dataset.glassRim;
}

/** Re-apply the "system" theme whenever the OS scheme changes. Returns an unsubscribe function. */
export function watchSystemTheme(root?: HTMLElement): () => void {
  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const onChange = () => {
    if (getThemePreference() === "system") rootEl(root).dataset.theme = systemTheme();
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * An inline script for `<head>` that applies stored settings before first
 * paint, validating every value so a stale or hand-edited entry can never
 * produce an attribute nothing styles. Values outside the allowed lists fall
 * back to the defaults already on the element.
 */
export const prePaintScript =
  `(()=>{try{var d=document.documentElement,s=localStorage,` +
  `g=function(k,a){var v=s.getItem(k);return v!==null&&a.indexOf(v)>=0?v:null};` +
  `var t=g(${JSON.stringify(STORAGE_KEYS.theme)},${JSON.stringify([...THEMES, "system"])});` +
  `if(t)d.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;` +
  `var x=g(${JSON.stringify(STORAGE_KEYS.density)},${JSON.stringify(DENSITIES)});if(x)d.dataset.density=x;` +
  `x=g(${JSON.stringify(STORAGE_KEYS.material)},${JSON.stringify(MATERIALS)});if(x)d.dataset.material=x;` +
  `x=g(${JSON.stringify(STORAGE_KEYS.platform)},${JSON.stringify(PLATFORMS)});if(x)d.dataset.platform=x;` +
  `if(g(${JSON.stringify(STORAGE_KEYS.transparency)},["reduced"]))d.dataset.transparency="reduced";` +
  `x=g(${JSON.stringify(STORAGE_KEYS.refraction)},["on","off"]);if(x)d.dataset.refraction=x;` +
  `if(g(${JSON.stringify(STORAGE_KEYS.frost)},["off"]))d.dataset.glassFrost="off";` +
  `if(g(${JSON.stringify(STORAGE_KEYS.rim)},["off"]))d.dataset.glassRim="off"` +
  `}catch(e){}})();`;
