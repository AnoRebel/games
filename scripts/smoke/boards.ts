/**
 * Board-game browser smoke. Run against a running build:
 *
 *   bun run build && node .output/server/index.mjs   # in another shell
 *   bun run smoke:boards                              # SMOKE_BASE=http://localhost:3000
 *
 * Checks, on a 360×640 phone: the home page lists both board games; a Bao
 * game goes from setup to its first move, to game over and a rematch; the
 * 10×10 board fits with ≥24px cells, zooms by keyboard to 44px cells with
 * board-local panning, and keeps its selection through rotation; and the page
 * stays responsive while a hard bot searches.
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

async function chooseOption(testId: string, label: string) {
  await page.click(`css:[data-testid="${testId}"]`);
  await page.click(`role:option[name='${label}']`);
}

async function startGame(game: string, variant?: string, difficulty?: string) {
  await page.navigate(`${BASE}/play/${game}`);
  await page.waitFor("role:dialog");
  if (variant) await chooseOption("variant-select", variant);
  if (difficulty) await chooseOption("difficulty-select", difficulty);
  await page.click("role:button[name='Start']");
  await page.waitFor("css:[role=grid]");
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent?.trim() === "No thanks")
      ?.click(),
  );
}

const metrics = () =>
  page.evaluate(() => {
    const grid = document.querySelector('[role="grid"]')!.getBoundingClientRect();
    const cell = document.querySelector('[role="gridcell"]')!.getBoundingClientRect();
    const frame = document.querySelector('[data-testid="board-frame"]')!;
    return {
      pageOverflows: document.documentElement.scrollWidth > innerWidth,
      gridFits: grid.left >= 0 && grid.right <= innerWidth,
      cell: Math.round(cell.width),
      pans: frame.scrollWidth > frame.clientWidth,
      selected: document.querySelectorAll('[data-state~="selected"]').length,
    };
  });

// 1. Home lists the board games.
await page.navigate(`${BASE}/`);
await page.waitFor("text:Checkers");
const cards = await page.evaluate(() =>
  [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()),
);
check(
  ["Bao", "Checkers"].every((g) => cards.includes(g)),
  "home lists Bao and Checkers",
  cards,
);

// 2. Bao: setup → first move → game over → rematch.
await startGame("bao", "Bao la Kujifunza", "Easy");
const seeded = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="seed-count"]')].every(
    (c) => c.textContent?.trim() === "2",
  ),
);
check(seeded, "Bao la Kujifunza starts with two seeds in every pit");
let moves = 0;
for (let i = 0; i < 600; i++) {
  const over = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((d) =>
      d.textContent?.includes("Rematch"),
    ),
  );
  if (over) break;
  const acted = await page.evaluate(async () => {
    // Let the board re-render between taps.
    const settle = () => new Promise((r) => setTimeout(r, 60));
    const start = document.querySelector<HTMLElement>('[data-state~="start"]');
    if (!start) return false;
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
    return true;
  });
  if (acted) moves++;
  await page.waitForTimeout(300);
}
check(moves > 0, "made moves on the Bao board", moves);
const rematch = await page.evaluate(() => {
  const button = [
    ...document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
  ].find((b) => b.textContent?.trim() === "Rematch");
  button?.click();
  return !!button;
});
check(rematch, "game over offers a rematch");
await page.waitForTimeout(1200);
const fresh = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="seed-count"]')].every(
    (c) => c.textContent?.trim() === "2",
  ),
);
check(fresh, "rematch deals a fresh board");

// 3. International on a phone: fit, keyboard zoom, rotation.
await startGame("checkers", "International");
const fit = await metrics();
check(
  !fit.pageOverflows && fit.gridFits && fit.cell >= 24,
  "10×10 board fits a 360px phone",
  fit,
);
await page.evaluate(() =>
  document.querySelector<HTMLElement>('[data-state~="origin"]')?.click(),
);
await page.evaluate(() =>
  document.querySelector<HTMLElement>('[data-testid="board-zoom"]')?.focus(),
);
await page.press("Enter");
await page.waitForTimeout(300);
const zoom = await metrics();
check(
  !zoom.pageOverflows && zoom.cell >= 44 && zoom.pans && zoom.selected === 1,
  "keyboard zoom gives 44px cells and pans the board",
  zoom,
);
await page.resize(640, 360);
await page.waitForTimeout(400);
const landscape = await metrics();
check(
  !landscape.pageOverflows && landscape.selected === 1,
  "rotation reflows and keeps the selection",
  landscape,
);
await page.resize(360, 640);

// 4. A hard bot never blocks the page.
await startGame("checkers", "International", "Hard");
await page.evaluate(() => {
  const w = window as unknown as { __long: number[] };
  w.__long = [];
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => w.__long.push(e.duration)),
  ).observe({
    type: "longtask",
  });
});
const panelMs: number[] = [];
for (let turn = 0; turn < 3; turn++) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-state~="origin"]')?.click();
    document
      .querySelector<HTMLElement>(
        '[data-state~="destination"], [data-state~="capture-destination"]',
      )
      ?.click();
  });
  panelMs.push(
    await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector<HTMLElement>('button[aria-label="Rules"]')!.click();
      while (!document.querySelector('[role="dialog"]'))
        await new Promise((r) => setTimeout(r, 5));
      return Math.round(performance.now() - t0);
    }),
  );
  await page.press("Escape");
  await page.waitForTimeout(400);
  await page.waitFor("text:Your turn", { timeout: 30_000 });
}
const longTasks = await page.evaluate(() =>
  (window as unknown as { __long: number[] }).__long.filter((d) => d > 100),
);
check(
  panelMs.every((ms) => ms < 250) && longTasks.length === 0,
  "UI stays responsive during hard search",
  {
    panelMs,
    longTasks,
  },
);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall board smoke checks passed");
