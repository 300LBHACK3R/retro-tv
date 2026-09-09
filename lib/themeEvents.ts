export const THEME_LIBRARY_OPEN_EVENT = "ttv:open-theme-library";

/** Requests that the mounted Tate's TV Theme Library trigger open its dialog. */
export function requestThemeLibraryOpen(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(THEME_LIBRARY_OPEN_EVENT));
}
