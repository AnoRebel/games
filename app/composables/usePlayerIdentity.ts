// A small, friendly avatar set. The player's avatar is chosen deterministically
// from their stable id (so it's stable across sessions) but can be overridden.
const AVATARS = [
  "🦁",
  "🐘",
  "🦒",
  "🦓",
  "🐆",
  "🦅",
  "🐊",
  "🦩",
  "🦜",
  "🐬",
  "🦈",
  "🦚",
  "🐝",
  "🦋",
  "🐙",
  "🦉",
];

/** Deterministic default avatar from a stable id. */
export function avatarFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length]!;
}

/**
 * Player identity — a stable id + display name persisted in localStorage
 * (shared across tabs, survives reload; used for reconnect & leaderboards).
 */
export function usePlayerIdentity() {
  const name = useLocalStorage("games:player-name", "You");
  const id = useLocalStorage("games:player-id", "");
  // '' = use the deterministic default from the id; a set value overrides it.
  const avatarOverride = useLocalStorage("games:player-avatar", "");
  if (import.meta.client && !id.value) {
    // Generate a stable id once (client only; crypto is fine here — not engine).
    id.value =
      globalThis.crypto?.randomUUID?.() ??
      `p-${Date.now().toString(36)}-${Math.floor(performance.now())}`;
  }
  const avatar = computed(() => avatarOverride.value || avatarFor(id.value));
  return { id, name, avatar, avatarOverride, avatarChoices: AVATARS };
}
