/**
 * Open/close state for the Customize dialog, shared so the header, the
 * settings panel and anything else can open it.
 */
export function useCustomizePanel() {
  const open = useState("games:customize-open", () => false);
  return {
    open,
    show: () => (open.value = true),
    hide: () => (open.value = false),
  };
}
