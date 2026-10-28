/**
 * End-to-end smoke across the new games. Run against a running build (see
 * boards.ts):  bun run smoke:integration
 *
 *  - The product name shows as Games in the title, header and manifest.
 *  - Bao and Checkers start offline at every difficulty and the bot answers.
 *  - An online International room shows its variant in the lobby, seats a
 *    server bot, and plays.
 *  - A finished online Bao game appears in the global leaderboard history
 *    with its variant and difficulty.
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
const dismissTutorial = () =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent?.trim() === "No thanks")
      ?.click(),
  );
const announcer = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="board-announcer"]')?.textContent?.trim() ??
      "",
  );
/** Wait for the bot's move to be announced (it then hands the turn back). */
async function botReply() {
  let text = "";
  for (let i = 0; i < 60; i++) {
    text = await announcer();
    if (text.startsWith("Bot") && text.includes("Your turn")) break;
    await page.waitForTimeout(250);
  }
  return text;
}

// 1. Rename surfaces.
await page.navigate(`${BASE}/`);
await page.waitFor("text:Checkers");
const identity = await page.evaluate(async () => {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const manifest = link ? await (await fetch(link.href)).json() : null;
  return {
    title: document.title,
    header: document
      .querySelector("header nav a")
      ?.textContent?.replace(/\s+/g, " ")
      .trim(),
    manifestName: manifest?.name,
    manifestShort: manifest?.short_name,
    stale: document.body.innerText.includes("Card Games"),
  };
});
check(
  identity.title === "Games" &&
    identity.manifestName === "Games" &&
    identity.manifestShort === "Games" &&
    !identity.stale,
  "the product is called Games everywhere",
  identity,
);

// 2. Offline at every difficulty.
for (const game of ["bao", "checkers"]) {
  for (const difficulty of ["Easy", "Normal", "Hard"]) {
    await page.navigate(`${BASE}/play/${game}`);
    await page.waitFor("role:dialog");
    await page.click(`css:[data-testid="difficulty-select"]`);
    await page.click(`role:option[name='${difficulty}']`);
    await page.click("role:button[name='Start']");
    await page.waitFor("css:[role=grid]");
    await page.waitForTimeout(600);
    await dismissTutorial();
    await page.evaluate(async () => {
      const settle = () => new Promise((r) => setTimeout(r, 80));
      document
        .querySelector<HTMLElement>('[data-state~="start"], [data-state~="origin"]')
        ?.click();
      await settle();
      document
        .querySelector<HTMLElement>(
          '[data-state~="direction"], [data-state~="destination"], [data-state~="capture-destination"]',
        )
        ?.click();
    });
    const reply = await botReply();
    check(
      reply.startsWith("Bot") && reply.includes("Your turn"),
      `offline ${game} @ ${difficulty}: bot replied`,
      reply,
    );
  }
}

/** Choose an option from a select, reopening it if a closing menu ate the click. */
async function pick(testid: string, option: string) {
  for (let i = 0; i < 5; i++) {
    await page.click(`css:[data-testid="${testid}"]`);
    await page.waitForTimeout(300);
    const options = await page.evaluate(() =>
      [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim()),
    );
    if (options.includes(option)) {
      // The headless driver can misjudge popper-positioned options as hidden,
      // so press the option with pointer events from inside the page.
      await page.evaluate(
        new Function(`
          const o = [...document.querySelectorAll('[role="option"]')]
            .find((x) => x.textContent?.trim() === ${JSON.stringify(option)});
          if (!o) return;
          for (const type of ["pointerdown", "pointerup"]) {
            o.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse", button: 0 }));
          }
          o.click();
        `) as () => void,
      );
      await page.waitForTimeout(400);
      return;
    }
    await page.press("Escape");
    await page.waitForTimeout(300);
  }
  throw new Error(`could not choose ${option} in ${testid}`);
}

/** Create an online room from the setup modal. */
async function createRoom(game: string, variant: string, difficulty: string) {
  await page.navigate(`${BASE}/play/${game}`);
  await page.waitFor("role:dialog");
  await page.click("role:button[name='Play online']");
  await page.waitForTimeout(300);
  await pick("variant-select", variant);
  // One seat for the server bot, at the chosen strength.
  await pick("bot-seats-select", "1");
  if (difficulty !== "Normal") await pick("difficulty-select", difficulty);
  const chosen = await page.evaluate(
    () =>
      document.querySelector('[data-testid="difficulty-select"]')?.textContent?.trim() ??
      "",
  );
  check(chosen === difficulty, `online setup offers ${difficulty} bots`, chosen);
  await page.click("role:button[name='Start']");
  await page.waitFor(`css:[data-testid="room-variant"]`, { timeout: 15_000 });
}

/** Start the room from the host controls once it is startable. */
async function startRoom() {
  let state = { found: false, disabled: true, title: "" };
  for (let i = 0; i < 40; i++) {
    state = await page.evaluate(() => {
      const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (x) => x.textContent?.trim() === "Start" && !x.closest('[role="dialog"]'),
      );
      if (b && !b.disabled) b.click();
      return { found: !!b, disabled: b?.disabled ?? true, title: b?.title ?? "" };
    });
    if (state.found && !state.disabled) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`room could not start: ${JSON.stringify(state)}`);
}

// 3. Online International room with a server bot.
await createRoom("checkers", "International", "Normal");
const lobby = await page.evaluate(() => ({
  variant: document.querySelector('[data-testid="room-variant"]')?.textContent?.trim(),
  url: location.search,
}));
check(
  /International/.test(lobby.variant ?? ""),
  "the lobby shows the room's variant",
  lobby,
);
await startRoom();
await page.waitFor("css:[role=grid]", { timeout: 15_000 });
await page.waitForTimeout(600);
await dismissTutorial();
const cells = await page.evaluate(
  () => document.querySelectorAll('[role="gridcell"]').length,
);
check(cells === 100, "the online game plays on the 10×10 board", cells);
await page.evaluate(async () => {
  document.querySelector<HTMLElement>('[data-state~="origin"]')?.click();
  await new Promise((r) => setTimeout(r, 80));
  document.querySelector<HTMLElement>('[data-state~="destination"]')?.click();
});
const online = await botReply();
check(online.startsWith("Bot"), "the server bot answers in the room", online);

// 4. A finished online game is recorded with its provenance.
await createRoom("bao", "Bao la Kujifunza", "Easy");
await startRoom();
await page.waitFor("css:[role=grid]", { timeout: 15_000 });
await page.waitForTimeout(600);
await dismissTutorial();
for (let i = 0; i < 800; i++) {
  const over = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((d) =>
      d.textContent?.includes("Game over"),
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
await page.waitForTimeout(1500); // the server records results asynchronously
const recorded = await page.evaluate(async () => {
  const res = await (await fetch("/api/leaderboard/bao")).json();
  return res.history?.[0] ?? null;
});
check(
  recorded?.variant === "bao-la-kujifunza" &&
    recorded?.difficulty === "easy" &&
    !!recorded?.tier,
  "the online result is recorded with variant, difficulty and tier",
  recorded,
);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall integration smoke checks passed");
