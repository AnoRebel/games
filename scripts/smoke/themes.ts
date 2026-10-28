/**
 * Scene-theme browser smoke. Run against a running build (see boards.ts):
 *
 *   bun run smoke:themes
 *
 * Starts a checkers game, makes a move, then creates and applies a custom
 * scene theme from the settings panel mid-game, checking the scene re-themes
 * at once while the game state is untouched.
 */
import { browser } from "bunwright";

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const failures: string[] = [];
function check(ok: boolean, what: string, detail?: unknown) {
  console.log(
    `${ok ? "✓" : "✗"} ${what}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`,
  );
  if (!ok) failures.push(what);
}
const settle = (ms = 400) => page.waitForTimeout(ms);

const page = await browser.newPage();
await page.navigate(`${BASE}/play/checkers`);
await page.waitFor("role:dialog");
await page.click("role:button[name='Start']");
await page.waitFor("css:[role=grid]");
await settle(800);
await page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>("button")]
    .find((b) => b.textContent?.trim() === "No thanks")
    ?.click(),
);
await page.evaluate(async () => {
  document.querySelector<HTMLElement>('[data-state~="origin"]')?.click();
  await new Promise((r) => setTimeout(r, 60));
  document.querySelector<HTMLElement>('[data-state~="destination"]')?.click();
});
// Wait for the bot's reply so nothing is in flight during the switch.
for (let i = 0; i < 60; i++) {
  const text = await page.evaluate(
    () => document.querySelector('[data-testid="board-announcer"]')?.textContent ?? "",
  );
  if (text.includes("Bot") && text.includes("Your turn")) break;
  await settle(250);
}

const snapshot = () =>
  page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-scene-theme]")!;
    return {
      theme: scene.dataset.sceneTheme,
      surface: scene.style.getPropertyValue("--games-scene-surface"),
      pieces: [...document.querySelectorAll("[data-piece]")]
        .map((p) => p.closest("[data-square]")?.getAttribute("data-square"))
        .join(","),
      announcer: document
        .querySelector('[data-testid="board-announcer"]')
        ?.textContent?.trim(),
    };
  });
const before = await snapshot();
check(before.theme === "felt", "a new player starts on the Felt scene", before.theme);

// Create a theme in the settings panel and apply it.
await page.click("role:button[name='Settings']");
await settle(800);
/** Click inside the scrolling settings panel. */
const tapIn = (testId: string) =>
  page.evaluate(
    new Function(
      `document.querySelector('[data-testid="${testId}"]')?.scrollIntoView();document.querySelector('[data-testid="${testId}"]')?.click();`,
    ) as () => void,
  );
await tapIn("new-theme");
await settle();
await page.screenshot(
  process.env.SMOKE_SHOTS ? `${process.env.SMOKE_SHOTS}/theme-editor.png` : undefined,
);
await page.evaluate(() => {
  const input = document.querySelector<HTMLInputElement>('[data-testid="theme-name"]')!;
  input.value = "Smoke sunset";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
for (const mode of ["light", "dark"]) {
  await tapIn(`mode-${mode}`);
  await settle(100);
  await page.evaluate(
    new Function(
      `const i=document.querySelector('[data-testid="hex-surface"]');` +
        `i.value='#5a2a2a';i.dispatchEvent(new Event('change',{bubbles:true}));`,
    ) as () => void,
  );
}
await tapIn("save-theme");
await settle();
const created = await page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>("[data-testid^='theme-custom:']")].map(
    (b) => b.dataset.testid,
  ),
);
check(created.length === 1, "custom theme saved", created);
await tapIn(created[0]!);
await settle();
await page.press("Escape");
await settle();

const after = await snapshot();
check(
  after.theme?.startsWith("custom:") ?? false,
  "scene switched to the custom theme",
  after.theme,
);
check(
  after.surface === "#5a2a2a",
  "scene colours updated without a reload",
  after.surface,
);
check(
  after.pieces === before.pieces && after.announcer === before.announcer,
  "game state unchanged by the theme switch",
  { before: before.announcer, after: after.announcer },
);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall theme smoke checks passed");
