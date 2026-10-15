/**
 * Skins: CSS variables in tokens.css. A skin changes looks only, never behaviour.
 * Light/dark follows the computer (System) until the player picks one.
 */
export type SkinId = 'matte' | 'aero' | 'neon' | 'brutal';
export const SKINS: SkinId[] = ['matte', 'aero', 'neon', 'brutal'];
export type Mode = 'light' | 'dark';
/** Which light/dark variants each skin has. Single-mode skins ignore the light/dark/system choice. */
export const SKIN_MODES: Record<SkinId, Mode[]> = { matte: ['light', 'dark'], aero: ['light', 'dark'], neon: ['light', 'dark'], brutal: ['light', 'dark'] };
export const SKIN_LABELS: Record<SkinId, string> = { matte: 'Matte', aero: 'Frutiger Aero', neon: 'Neon', brutal: 'Neubrutalism' };
/** The look a fresh install gets: calm matte plastic on a paper-grain background. */
export const DEFAULT_SKIN: SkinId = 'matte';

/** Skin from `?skin=` (for previewing), then the saved choice, then the default. */
export function pickSkin(search: string, saved: string | null): SkinId {
  const q = new URLSearchParams(search).get('skin');
  for (const c of [q, saved]) if (c && (SKINS as string[]).includes(c)) return c as SkinId;
  return DEFAULT_SKIN;
}

/** The explicit theme if chosen, else the OS preference. */
export const resolveTheme = (saved: string | null, prefersDark: boolean): Mode =>
  saved === 'light' || saved === 'dark' ? saved : prefersDark ? 'dark' : 'light';

/** The mode a skin actually shows: the chosen one if the skin has it, else its only mode. */
export const modeFor = (skin: SkinId, wanted: Mode): Mode =>
  SKIN_MODES[skin].includes(wanted) ? wanted : SKIN_MODES[skin][0];
