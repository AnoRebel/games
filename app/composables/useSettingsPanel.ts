/**
 * Global settings panel open/close state — shared across the app so any button
 * can open the settings slideover (no dedicated route/page).
 *
 * Uses Nuxt's `useState` (SSR-safe shared state) rather than a module-level ref.
 */
export function useSettingsPanel() {
  const open = useState("games:settings-open", () => false);
  return {
    open,
    show: () => (open.value = true),
    hide: () => (open.value = false),
    toggle: () => (open.value = !open.value),
  };
}
