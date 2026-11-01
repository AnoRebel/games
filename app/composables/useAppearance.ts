/**
 * Appearance: the Crystal Neuo material, layout (platform style and density),
 * contrast and glass settings, as one shared reactive state.
 *
 * Each setting is an attribute on <html> written by the Crystal Neuo runtime,
 * which also persists it (localStorage, `crystal-neuo:*`). A pre-paint script
 * in app.vue applies the stored values before first paint.
 *
 * Light/dark stays with Nuxt color mode (the header toggle and its animated
 * transition); the contrast setting picks the high-contrast palette on top.
 * Together they set `data-theme` to light, dark or high-contrast.
 */
import {
  DENSITIES,
  GLASS_MATERIALS,
  MATERIALS,
  PLATFORMS,
  detectPlatform,
  getDensity,
  getGlassFrost,
  getGlassRim,
  getMaterial,
  getPlatform,
  getRefraction,
  getTransparency,
  refractionSupported,
  setDensity,
  setGlassFrost,
  setGlassRim,
  setMaterial,
  setPlatform,
  setRefraction,
  setTransparency,
  startRefraction,
  type Density,
  type Material,
  type Platform,
} from "~/vendor/crystal-neuo/runtime";
import { CONTRAST_KEY, themeFor, type Contrast } from "~/utils/appearance";

export type { Density, Material, Platform };
export { MATERIALS, PLATFORMS, DENSITIES, GLASS_MATERIALS };

interface AppearanceState {
  material: Material;
  platform: Platform;
  density: Density;
  contrast: Contrast;
  frost: boolean;
  rim: boolean;
  refraction: boolean;
  reducedTransparency: boolean;
}

const DEFAULTS: AppearanceState = {
  material: "refraction",
  platform: "web",
  density: "comfortable",
  contrast: "standard",
  frost: true,
  rim: true,
  refraction: false,
  reducedTransparency: false,
};

const state = reactive<AppearanceState>({ ...DEFAULTS });
let loaded = false;
let stopRefraction: (() => void) | null = null;

function readContrast(): Contrast {
  try {
    return localStorage.getItem(CONTRAST_KEY) === "high" ? "high" : "standard";
  } catch {
    return "standard";
  }
}

/** Tint the browser and installed-app chrome to the material's page colour. */
function syncThemeColor() {
  if (!import.meta.client) return;
  requestAnimationFrame(() => {
    // The token, not body's background, which may be mid-transition.
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--surface-app")
      .trim();
    if (!bg) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = bg;
  });
}

function syncRefractionEngine() {
  const wanted =
    state.refraction &&
    !state.reducedTransparency &&
    GLASS_MATERIALS.includes(state.material) &&
    refractionSupported();
  if (wanted && !stopRefraction) stopRefraction = startRefraction();
  if (!wanted && stopRefraction) {
    stopRefraction();
    stopRefraction = null;
  }
}

export function useAppearance() {
  const colorMode = useColorMode();

  function applyTheme() {
    if (!import.meta.client) return;
    document.documentElement.dataset.theme = themeFor(
      colorMode.value === "dark",
      state.contrast,
    );
    syncThemeColor();
  }

  /** Read stored settings once on the client (the pre-paint script already applied them). */
  function load() {
    if (!import.meta.client || loaded) return;
    loaded = true;
    state.material = getMaterial();
    state.platform = getPlatform();
    state.density = getDensity();
    state.contrast = readContrast();
    state.frost = getGlassFrost() === "on";
    state.rim = getGlassRim() === "on";
    state.refraction = getRefraction() === "on";
    state.reducedTransparency = getTransparency() === "reduced";
    applyTheme();
    syncRefractionEngine();
  }

  function setMaterialTo(m: Material) {
    state.material = m;
    setMaterial(m);
    syncRefractionEngine();
    syncThemeColor();
  }
  function setPlatformTo(p: Platform) {
    state.platform = p;
    setPlatform(p);
  }
  function setDensityTo(d: Density) {
    state.density = d;
    setDensity(d);
  }
  function setContrast(c: Contrast) {
    state.contrast = c;
    try {
      localStorage.setItem(CONTRAST_KEY, c);
    } catch {
      /* storage blocked: the attribute still applies */
    }
    applyTheme();
  }
  function setFrost(on: boolean) {
    state.frost = on;
    setGlassFrost(on ? "on" : "off");
  }
  function setRim(on: boolean) {
    state.rim = on;
    setGlassRim(on ? "on" : "off");
  }
  function setRefractionOn(on: boolean) {
    state.refraction = on;
    setRefraction(on ? "on" : "off");
    syncRefractionEngine();
  }
  function setReducedTransparency(on: boolean) {
    state.reducedTransparency = on;
    setTransparency(on ? "reduced" : "normal");
    syncRefractionEngine();
  }

  return {
    state: readonly(state),
    load,
    applyTheme,
    /** Live refraction renders only in Chromium; elsewhere glass stays frosted. */
    refractionAvailable: computed(() => import.meta.client && refractionSupported()),
    /** Whether the current material has translucent glass to tune. */
    hasGlass: computed(() => GLASS_MATERIALS.includes(state.material)),
    setMaterial: setMaterialTo,
    setPlatform: setPlatformTo,
    /** Pick the platform style that matches this device. Returns it. */
    matchDevice(): Platform {
      const p = detectPlatform();
      setPlatformTo(p);
      return p;
    },
    setDensity: setDensityTo,
    setContrast,
    setFrost,
    setRim,
    setRefraction: setRefractionOn,
    setReducedTransparency,
    /** Back to the defaults (keeps light/dark). */
    reset() {
      setMaterialTo(DEFAULTS.material);
      setPlatformTo(DEFAULTS.platform);
      setDensityTo(DEFAULTS.density);
      setContrast(DEFAULTS.contrast);
      setFrost(DEFAULTS.frost);
      setRim(DEFAULTS.rim);
      setRefractionOn(DEFAULTS.refraction);
      setReducedTransparency(DEFAULTS.reducedTransparency);
    },
  };
}
