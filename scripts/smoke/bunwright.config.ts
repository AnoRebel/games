/**
 * Browser for the smoke scripts. Uses the system Chrome by default; set
 * BUN_CHROME_PATH to pick another binary. Sandboxing is unavailable when
 * running as root (containers/CI), so it is disabled there.
 */
import { defineConfig } from "bunwright";

const root = process.getuid?.() === 0;

export default defineConfig({
  backend: {
    type: "chrome",
    path: process.env.BUN_CHROME_PATH || undefined,
    argv: ["--headless=new", ...(root ? ["--no-sandbox"] : [])],
  },
  width: 360,
  height: 640,
});
