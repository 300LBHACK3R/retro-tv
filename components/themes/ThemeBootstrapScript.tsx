import { createThemeCssVars, DEFAULT_THEME_ID, THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
import { CHRISTMAS_ENTRANCE_START, CHRISTMAS_THEME_ID } from "@/lib/themePreferences";

/** Start with the seasonal entrance; verified accounts restore saved themes after hydration. */
export function createThemeBootstrapScript() {
  const entries = THEMES.map((theme) => ({
    id: theme.id,
    category: theme.category,
    layout: theme.layout,
    appearance: theme.appearance,
    cssVars: createThemeCssVars(theme),
  }));
  const script = `(() => {
    const themes = ${JSON.stringify(entries)};
    let id = Date.now() >= ${CHRISTMAS_ENTRANCE_START} ? ${JSON.stringify(CHRISTMAS_THEME_ID)} : ${JSON.stringify(DEFAULT_THEME_ID)};
    const theme = themes.find((theme) => theme.id === id);
    const root = document.documentElement;
    root.dataset.ttvTheme = theme.id;
    root.dataset.ttvCategory = theme.category;
    root.dataset.ttvLayout = theme.layout;
    root.dataset.ttvAppearance = theme.appearance;
    root.style.colorScheme = theme.appearance;
    for (const [property, value] of Object.entries(theme.cssVars)) {
      root.style.setProperty(property, value);
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) || "null");
      if (saved?.state?.viewerSettings?.preferReducedMotion)
        root.dataset.ttvReducedMotion = "true";
    } catch {
      // Storage being blocked must never interrupt the seasonal first paint.
    }
  })();`;
  return script.replace(/</g, "\\u003c");
}

export default function ThemeBootstrapScript() {
  return <script id="ttv-theme-bootstrap" dangerouslySetInnerHTML={{ __html: createThemeBootstrapScript() }} />;
}
