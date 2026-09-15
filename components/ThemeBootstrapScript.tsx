import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_REVISION,
  getThemeBootstrapEntries,
  THEME_STORAGE_KEY,
} from "@/lib/themes";

/**
 * Applies the persisted theme before React hydrates, preventing a bright/dark
 * flash and keeping every route visually consistent from the first paint.
 */
export function createThemeBootstrapScript() {
  const entries = Object.fromEntries(
    getThemeBootstrapEntries().map((entry) => [entry.id, entry]),
  );

  const script = `(() => {
    const themes = ${JSON.stringify(entries)};
    const fallbackId = ${JSON.stringify(DEFAULT_THEME_ID)};
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};

    try {
      const storedValue = window.localStorage.getItem(storageKey);
      const storedState = storedValue ? JSON.parse(storedValue) : null;
      const requestedId = storedState?.state?.themeRevision === ${JSON.stringify(DEFAULT_THEME_REVISION)}
        ? storedState?.state?.themeId : fallbackId;
      const theme = themes[requestedId] || themes[fallbackId];

      if (!theme) return;

      const root = document.documentElement;
      root.dataset.ttvTheme = theme.id;
      root.dataset.ttvCategory = theme.category;
      root.dataset.ttvLayout = theme.layout;
      root.dataset.ttvAppearance = theme.appearance;
      root.style.colorScheme = theme.appearance;
      if (storedState?.state?.viewerSettings?.preferReducedMotion)
        root.dataset.ttvReducedMotion = "true";

      for (const [property, value] of Object.entries(theme.cssVars)) {
        root.style.setProperty(property, value);
      }
    } catch {
      // The normal ThemeRuntime applies the default theme after hydration.
    }
  })();`;

  return script.replace(/</g, "\\u003c");
}

export default function ThemeBootstrapScript() {
  return (
    <script
      id="ttv-theme-bootstrap"
      dangerouslySetInnerHTML={{
        __html: createThemeBootstrapScript(),
      }}
    />
  );
}
