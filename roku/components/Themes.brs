function resolveTheme(id as string, catalog as object) as object
    if id = "christmas" then id = "christmas-96-living-room"
    if id = "retro" then id = "shaw-2006"
    fallback = catalog.themes[0]
    for each theme in catalog.themes
        if theme.id = id then return theme
        if theme.id = catalog.defaultId then fallback = theme
    end for
    return fallback
end function

sub applyTheme(id as string)
    if m.themeCatalog = invalid then m.themeCatalog = ParseJson(ReadAsciiFile("pkg:/data/themes.json"))
    theme = resolveTheme(id, m.themeCatalog)
    m.themeId = theme.id
    m.top.themeColors = theme.colors
    colors = theme.colors
    room = m.top.FindNode("room")
    room.uri = theme.background
    room.visible = theme.background <> ""
    paintTheme({ background: "appBg", menuPanel: "panelAltBg", listPanel: "panelBg", accent: "primary",
        heading: "text", profileLabel: "primary", status: "textMuted", channelTitle: "primary",
        nowHeading: "primary", nextHeading: "primary", nowTitle: "text", nextTitle: "textMuted",
        emptyMessage: "text", hint: "primary", buildLabel: "textMuted", guideBackdrop: "appBg",
        bannerPanel: "panelBg", bannerChannel: "primary", bannerProgramme: "text", bannerHelp: "textMuted" })
    m.menu.color = colors.text
    m.menu.focusedColor = colors.onPrimary
    m.menu.focusBitmapBlendColor = colors.primary
    for each component in [m.home, m.channels, m.guide]
        component.themeColors = colors
        component.accent = colors.primary
    end for
    m.libraryGrid.focusBitmapBlendColor = colors.primary
    m.playerFocus.color = colors.primary
    m.viewerAccent = colors.primary
    palette = CreateObject("roSGNode", "RSGPalette")
    palette.colors = {
        DialogBackgroundColor: colors.panelBg
        DialogTextColor: colors.text
        DialogFocusColor: colors.primary
        DialogFocusItemColor: colors.onPrimary
        DialogItemColor: colors.primary
        DialogSecondaryTextColor: colors.textMuted
        DialogSecondaryItemColor: colors.primary
        DialogInputFieldColor: colors.panelAltBg
        DialogKeyboardColor: colors.panelAltBg
        DialogFootprintColor: colors.panelAltBg
    }
    m.top.palette = palette
end sub
