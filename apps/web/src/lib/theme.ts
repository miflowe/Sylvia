/** Light, dark, or follow the phone. Stored on this device only. */
export type Theme = "system" | "light" | "dark";

const KEY = "sylvia.theme";
const BAR = { light: "#f6f4ee", dark: "#121a15" } as const;

/**
 * Runs in <head> before first paint, so a forced theme never flashes the other one. Kept as a string because it
 * must not wait for the app's JavaScript.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=t==="dark"?"${BAR.dark}":"${BAR.light}"})}}catch(e){}`;

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {}
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The browser bar colour: forced themes pin both metas; "system" puts back the light/dark pair.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = theme === "system" ? (m.media.includes("dark") ? BAR.dark : BAR.light) : BAR[theme];
  });
}
