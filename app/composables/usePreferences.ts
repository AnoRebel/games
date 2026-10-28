/**
 * User preferences (small scalars) persisted in localStorage — shared across
 * tabs, survive reload. Consumed by notifications, animation gating, etc.
 */
export function usePreferences() {
  const notifications = useLocalStorage("games:pref-notifications", true);
  const animations = useLocalStorage("games:pref-animations", true);
  const sound = useLocalStorage("games:pref-sound", false);
  return { notifications, animations, sound };
}
