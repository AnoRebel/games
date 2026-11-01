/**
 * Appearance browser smoke. Run against a running build (see boards.ts):
 *
 *   bun run smoke:appearance
 *
 * Opens Customize from the header and checks that every material, platform
 * style and density applies at once, that the choice survives a reload with
 * no flash of the default, that light/dark and high contrast drive the
 * palette, that Nuxt UI controls follow the material, and that the dialog
 * fits a 360px phone.
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
const settle = (ms = 300) => page.waitForTimeout(ms);
const html = () =>
  page.evaluate(() => {
    const d = document.documentElement;
    const cs = getComputedStyle(d);
    return {
      material: d.dataset.material,
      platform: d.dataset.platform,
      density: d.dataset.density,
      theme: d.dataset.theme,
      radius: cs.getPropertyValue("--radius-md").trim(),
      control: cs.getPropertyValue("--size-control-md").trim(),
      bg: getComputedStyle(document.body).backgroundColor,
      font: getComputedStyle(document.body).fontFamily,
    };
  });
/** Press a radio or button inside the Customize dialog by test id. */
const press = (testid: string) =>
  page.evaluate(
    new Function(
      `document.querySelector('[data-testid="${testid}"]')?.click();`,
    ) as () => void,
  );

await page.navigate(`${BASE}/`);
await page.waitFor("text:Checkers");
await settle(800);
const initial = await html();
check(
  initial.material === "refraction" &&
    initial.platform === "web" &&
    initial.density === "comfortable",
  "defaults to Refraction, web, comfortable",
  initial,
);

await page.click("css:[data-testid='open-customize']");
await page.waitFor("css:[data-testid='appearance-customizer']");
await settle();

// Every material applies at once and changes the material's look.
const seen = new Map<string, { radius: string; bg: string; font: string }>();
for (const m of ["refraction", "tactile", "signal", "folio", "bloom", "hybrid"]) {
  await press(`material-${m}`);
  await settle(150);
  const h = await html();
  check(h.material === m, `material ${m} applies`, h.material);
  seen.set(m, { radius: h.radius, bg: h.bg, font: h.font });
}
const looks = new Set([...seen.values()].map((v) => `${v.radius}|${v.bg}|${v.font}`));
check(looks.size >= 5, "materials look different from one another", looks.size);

// Layout: platform style changes control size and corners; density spacing.
await press("material-tactile");
for (const p of ["web", "ios", "android", "windows", "macos"]) {
  await press(`platform-${p}`);
  await settle(100);
  const h = await html();
  check(h.platform === p, `platform ${p} applies`, {
    control: h.control,
    radius: h.radius,
  });
}
await press("platform-ios");
await press("density-compact");
await settle(100);
const compact = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--spacing").trim(),
);
await press("density-spacious");
await settle(100);
const spacious = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--spacing").trim(),
);
check(compact !== spacious, "density changes the spacing step", { compact, spacious });

// A Nuxt UI button follows the platform's touch target (44px on iOS).
const done = await page.evaluate(() => {
  const b = document.querySelector<HTMLElement>('[data-testid="appearance-done"]')!;
  return Math.round(b.getBoundingClientRect().height);
});
check(done >= 44, "buttons meet the iOS touch target", done);

// High contrast, then back.
await press("contrast-toggle");
await settle(150);
check(
  (await html()).theme === "high-contrast",
  "high contrast applies",
  (await html()).theme,
);
await press("contrast-toggle");
await settle(150);
check((await html()).theme !== "high-contrast", "high contrast turns off");

// Persisted and applied before first paint.
await press("appearance-done");
await settle();
await page.reload();
const early = await page.evaluate(() => ({
  material: document.documentElement.dataset.material,
  platform: document.documentElement.dataset.platform,
  density: document.documentElement.dataset.density,
}));
check(
  early.material === "tactile" &&
    early.platform === "ios" &&
    early.density === "spacious",
  "choice survives a reload",
  early,
);

// Light/dark from the header toggle drives data-theme.
await page.waitFor("text:Checkers");
await settle(600);
const before = (await html()).theme;
await page.evaluate(() =>
  document
    .querySelector<HTMLElement>(
      'header button[aria-label="Dark mode"], header button[aria-label="Light mode"]',
    )
    ?.click(),
);
await settle(900);
const after = (await html()).theme;
check(
  before !== after && ["light", "dark"].includes(after ?? ""),
  "dark mode toggles the palette",
  {
    before,
    after,
  },
);

// The dialog fits a small phone.
const phone = await browser.newPage({ viewport: { width: 360, height: 640 } });
await phone.navigate(`${BASE}/`);
await phone.waitFor("text:Checkers");
await phone.waitForTimeout(600);
await phone.click("css:[data-testid='open-customize']");
await phone.waitForTimeout(600);
const fit = await phone.evaluate(() => {
  const dlg = document.querySelector<HTMLElement>(
    '[data-testid="appearance-customizer"]',
  )!;
  const r = dlg.closest('[role="dialog"]')!.getBoundingClientRect();
  return {
    dialog: Math.round(r.width),
    viewport: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  };
});
check(fit.dialog <= fit.viewport && !fit.overflow, "Customize fits a 360px screen", fit);

// Reset returns to the defaults.
await press("appearance-reset");
await settle(200);
const reset = await html();
check(
  reset.material === "refraction" &&
    reset.platform === "web" &&
    reset.density === "comfortable",
  "reset returns to the defaults",
  reset,
);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall appearance smoke checks passed");
