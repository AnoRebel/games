/**
 * Appearance: the data-theme resolution and its pre-paint script, and the
 * contract between the app and its copy of the Crystal Neuo design system —
 * every design token the app references exists in the vendored tokens, and
 * the runtime's axis values match the styled attributes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CONTRAST_KEY, themeFor, themePrePaintScript } from "../app/utils/appearance";
import {
  DENSITIES,
  MATERIALS,
  PLATFORMS,
  prePaintScript,
} from "../app/vendor/crystal-neuo/runtime";

const root = join(__dirname, "..");
const tokens = readFileSync(
  join(root, "app/assets/css/vendor/crystal-neuo/tokens.css"),
  "utf8",
);

describe("theme resolution", () => {
  it("maps colour mode and contrast to a data-theme", () => {
    expect(themeFor(false, "standard")).toBe("light");
    expect(themeFor(true, "standard")).toBe("dark");
    expect(themeFor(false, "high")).toBe("high-contrast");
    expect(themeFor(true, "high")).toBe("high-contrast");
  });

  function runPrePaint(stored: Record<string, string>, osDark: boolean) {
    const dataset: Record<string, string> = {};
    const env = {
      document: { documentElement: { dataset } },
      localStorage: { getItem: (k: string) => stored[k] ?? null },
      matchMedia: () => ({ matches: osDark }),
    };
    new Function(
      "document",
      "localStorage",
      "matchMedia",
      themePrePaintScript("nuxt-color-mode"),
    )(env.document, env.localStorage, env.matchMedia);
    return dataset.theme;
  }

  it("applies the stored mode and contrast before first paint", () => {
    expect(runPrePaint({}, false)).toBe("light");
    expect(runPrePaint({}, true)).toBe("dark");
    expect(runPrePaint({ "nuxt-color-mode": "dark" }, false)).toBe("dark");
    expect(runPrePaint({ "nuxt-color-mode": "light" }, true)).toBe("light");
    expect(runPrePaint({ "nuxt-color-mode": "system" }, true)).toBe("dark");
    expect(
      runPrePaint({ [CONTRAST_KEY]: "high", "nuxt-color-mode": "light" }, false),
    ).toBe("high-contrast");
  });

  it("never lets a stored value outside the lists reach an attribute", () => {
    const dataset: Record<string, string> = {};
    const store: Record<string, string> = {
      "crystal-neuo:material": "glitter",
      "crystal-neuo:platform": "ios",
      "crystal-neuo:density": "huge",
    };
    new Function("document", "localStorage", "matchMedia", prePaintScript)(
      { documentElement: { dataset } },
      { getItem: (k: string) => store[k] ?? null },
      () => ({ matches: false }),
    );
    expect(dataset).toEqual({ platform: "ios" });
  });
});

describe("design system contract", () => {
  it("styles every material, platform and density the runtime offers", () => {
    for (const m of MATERIALS) expect(tokens).toContain(`[data-material="${m}"]`);
    for (const p of PLATFORMS) expect(tokens).toContain(`[data-platform="${p}"]`);
    for (const d of DENSITIES) expect(tokens).toContain(`[data-density="${d}"]`);
  });

  it("defines every design token the app references", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === "vendor" || name === "node_modules") continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(vue|ts|css)$/.test(name)) files.push(path);
      }
    };
    walk(join(root, "app"));
    const DESIGN =
      /var\(--((?:surface|content|accent|border|state|radius|shadow|space|size|platform|font-family|type|weight|motion|focus|leading|tracking|density|blur|glass)-[a-z0-9-]+)/g;
    const missing = new Set<string>();
    for (const f of files) {
      const code = readFileSync(f, "utf8");
      for (const [, name] of code.matchAll(DESIGN)) {
        if (!new RegExp(`--${name}\\s*:`).test(tokens))
          missing.add(`${name} (${f.slice(root.length + 1)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
