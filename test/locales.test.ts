/**
 * Every interface string exists in both English and Swahili, for the shared
 * locale files and every page's own file.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "locales");

function keys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

const load = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

const pairs: [string, string, string][] = [
  ["shared", join(ROOT, "en.json"), join(ROOT, "sw.json")],
];
for (const page of readdirSync(join(ROOT, "pages"))) {
  pairs.push([
    page,
    join(ROOT, "pages", page, "en.json"),
    join(ROOT, "pages", page, "sw.json"),
  ]);
}

describe("locales", () => {
  it.each(pairs)("%s strings exist in English and Swahili", (_name, en, sw) => {
    const enKeys = keys(load(en)).sort();
    const swKeys = keys(load(sw)).sort();
    expect(swKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !swKeys.includes(k))).toEqual([]);
  });

  it("has the setup, room and game-selection strings", () => {
    const en = load(join(ROOT, "en.json")) as Record<string, Record<string, string>>;
    for (const k of [
      "variant",
      "botSeats",
      "botSeatsNone",
      "difficulty",
      "diffEasyHelp",
      "diffNormalHelp",
      "diffHardHelp",
    ]) {
      expect(en.setup![k]).toBeTruthy();
    }
    expect(en.room!.botSeats).toContain("{count}");
  });
});
