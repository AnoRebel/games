/**
 * One product name everywhere: the shared declaration feeds the manifest and
 * Apple title, the localized `app.title` feeds every in-app surface, the two
 * agree, and no user-visible string still says "Card Games" or treats the
 * product as card-only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { siteConfig } from "../site.config";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const locale = (code: string) => JSON.parse(read(`locales/${code}.json`));

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory()
      ? files(path, ext)
      : ext.test(name)
        ? [path]
        : [];
  });
}

describe("site identity", () => {
  it("declares the product name once", () => {
    expect(siteConfig).toMatchObject({ name: "Games", shortName: "Games" });
    expect(siteConfig.shortName.length).toBeLessThanOrEqual(12); // home-screen label limit
    expect(siteConfig.description).not.toMatch(/card games? only|card games\b(?! and)/i);
    expect(siteConfig.description).toMatch(/card and board games/i);
  });

  it("feeds the manifest, Apple title and description from that declaration", () => {
    const config = read("nuxt.config.ts");
    expect(config).toMatch(/name: siteConfig\.name/);
    expect(config).toMatch(/short_name: siteConfig\.shortName/);
    expect(config).toMatch(/description: siteConfig\.description/);
    expect(config).toMatch(
      /"apple-mobile-web-app-title", content: siteConfig\.shortName/,
    );
  });

  it("localizes the name: Games in English, Michezo in Swahili", () => {
    expect(locale("en").app.title).toBe(siteConfig.name);
    expect(locale("sw").app.title).toBe("Michezo");
    expect(locale("en").pwa.installPrompt).toBe("Install Games");
    expect(locale("sw").pwa.installPrompt).toBe("Sakinisha Michezo");
  });

  it("reads the localized name on every in-app surface", () => {
    expect(read("app/layouts/default.vue")).toContain('$ts("app.title")');
    expect(read("app/components/RoomShare.vue")).toContain('$ts("app.title")');
    expect(read("app/app.vue")).toContain('$ts("app.title")');
    expect(read("app/pages/index.vue")).toContain('$ts("app.title")');
    expect(read("app/components/PwaPrompt.vue")).toContain('$ts("pwa.installPrompt")');
  });

  it("uses game-agnostic brand copy in both languages", () => {
    for (const code of ["en", "sw"]) {
      const l = locale(code);
      for (const line of [l.app.tagline, l.invite.shareText]) {
        expect(line).not.toMatch(/card|karata/i);
      }
      expect(l.app.subtitle).toMatch(code === "en" ? /board games/i : /ubao/i);
    }
  });

  it("keeps the game names unchanged", () => {
    const home = read("app/pages/index.vue");
    for (const name of ["Last Card", "Albastini", "Bao", "Checkers"])
      expect(home).toContain(`"${name}"`);
  });

  it("shows no stale product name in user-visible files", () => {
    const visible = [
      ...files("app", /\.(vue|ts)$/),
      ...files("locales", /\.json$/),
      "nuxt.config.ts",
      "site.config.ts",
    ];
    const offenders = visible.filter(
      (p) => /Card Games/.test(read(p)) && !p.includes("migrat"),
    );
    expect(offenders.map((p) => relative(ROOT, join(ROOT, p)))).toEqual([]);
  });
});
