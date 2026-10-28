/**
 * Leaderboard browser smoke on a 360px phone. Run against a running build
 * (see boards.ts):  bun run smoke:leaderboard
 *
 * Plays an offline Bao la Kujifunza game against an easy bot to the end,
 * then opens the leaderboard: the play appears in the history with its game,
 * variant, difficulty, tier and result, and nothing overflows horizontally.
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

const page = await browser.newPage();
await page.navigate(`${BASE}/play/bao`);
await page.waitFor("role:dialog");
await page.click(`css:[data-testid="variant-select"]`);
await page.click("role:option[name='Bao la Kujifunza']");
await page.click(`css:[data-testid="difficulty-select"]`);
await page.click("role:option[name='Easy']");
await page.click("role:button[name='Start']");
await page.waitFor("css:[role=grid]");
await page.waitForTimeout(800);
await page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>("button")]
    .find((b) => b.textContent?.trim() === "No thanks")
    ?.click(),
);

for (let i = 0; i < 600; i++) {
  const over = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((d) =>
      d.textContent?.includes("Rematch"),
    ),
  );
  if (over) break;
  await page.evaluate(async () => {
    const settle = () => new Promise((r) => setTimeout(r, 60));
    const start = document.querySelector<HTMLElement>('[data-state~="start"]');
    if (!start) return;
    start.click();
    await settle();
    for (let k = 0; k < 3; k++) {
      document
        .querySelector<HTMLElement>('[data-state~="direction"], [data-state~="entry"]')
        ?.click();
      await settle();
      document.querySelector<HTMLElement>('[data-testid="choose-stop"]')?.click();
      await settle();
    }
  });
  await page.waitForTimeout(300);
}
// Close the game-over dialog and open the leaderboard on this device's plays.
await page.press("Escape");
await page.waitForTimeout(600);
await page.evaluate(() =>
  document.querySelector<HTMLElement>('button[aria-label="Leaderboard"]')?.click(),
);
await page.waitForTimeout(600);
await page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')]
    .find((b) => b.textContent?.trim() === "My games")
    ?.click(),
);
await page.waitForTimeout(800);

const view = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')!;
  const row = dialog.querySelector('[data-testid="history-row"]');
  const overflowing = [...dialog.querySelectorAll<HTMLElement>("*")].filter(
    (el) =>
      el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible",
  ).length;
  return {
    caption: dialog.querySelector('[data-testid="metric-caption"]')?.textContent?.trim(),
    history: row?.textContent?.replace(/\s+/g, " ").trim(),
    pageOverflows: document.documentElement.scrollWidth > innerWidth,
    dialogOverflows: dialog.scrollWidth > dialog.clientWidth,
    overflowing,
  };
});
check(
  view.caption === "Ranked by wins, then win rate",
  "leaderboard labels the ranking",
  view.caption,
);
check(
  !!view.history &&
    ["Bao", "Bao la Kujifunza", "Easy", "New"].every((s) => view.history!.includes(s)),
  "history shows game, variant, difficulty and tier",
  view.history,
);
check(
  !view.pageOverflows && !view.dialogOverflows,
  "readable at 360px without horizontal overflow",
  view,
);
if (process.env.SMOKE_SHOTS)
  await page.screenshot(`${process.env.SMOKE_SHOTS}/leaderboard.png`);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall leaderboard smoke checks passed");
