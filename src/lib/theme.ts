export type Theme = "light" | "dark";

const THEME_KEY = "vinfuse.theme";
const LEGACY_SUN_KEY = "vinfuse.sunlight";
const EVENT = "vinfuse-theme";

export function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const legacy = localStorage.getItem(LEGACY_SUN_KEY);
    if (legacy === "1") return "light";
    if (legacy === "0") return "dark";
  } catch {
    /* private mode */
  }
  return null;
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("sunlight", theme === "light");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#020817" : "#f8fafc");
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.removeItem(LEGACY_SUN_KEY);
  } catch {
    /* private mode */
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}

export function toggleTheme() {
  setTheme(resolveTheme() === "dark" ? "light" : "dark");
}

export function bootTheme() {
  applyTheme(resolveTheme());
}

export function subscribeTheme(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === LEGACY_SUN_KEY) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (!getStoredTheme()) listener();
  };
  media.addEventListener("change", onMedia);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onMedia);
  };
}

/** Inline boot script — run before paint to avoid a theme flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k="vinfuse.theme",l="vinfuse.sunlight",s=localStorage.getItem(k);var dark=s?s==="dark":(s=localStorage.getItem(l),s==="1"?false:s==="0"?true:window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.classList.toggle("sunlight",!dark);r.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
