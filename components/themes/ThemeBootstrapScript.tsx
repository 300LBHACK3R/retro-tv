import { createThemeCssVars, getDefaultTheme, THEME_STORAGE_KEY } from "@/lib/themes";

/** Apply the universal starting theme before hydration. Only motion is remembered. */
export function createThemeBootstrapScript() {
  const theme = getDefaultTheme();
  const entry = {
    id: theme.id,
    category: theme.category,
    layout: theme.layout,
    appearance: theme.appearance,
    cssVars: createThemeCssVars(theme),
  };
  const script = `(() => {
    const theme = ${JSON.stringify(entry)};
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
