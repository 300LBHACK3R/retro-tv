function themeAllowed(theme as object) as boolean
    if theme.isPremium <> true then return true
    if m.storeEdition = true then return false
    if m.account = invalid then return false
    if m.account.ownedThemeIds = invalid then return false
    for each id in m.account.ownedThemeIds
        if id = theme.id then return true
    end for
    return false
end function

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
    if not themeAllowed(theme) then theme = resolveTheme(m.themeCatalog.defaultId, m.themeCatalog)
    m.themeId = theme.id
    m.themeBackgroundOpacity = theme.backgroundOpacity
    m.top.themeColors = theme.colors
    colors = theme.colors
    m.guide.winter = theme.id = "christmas-2005-home"
    m.top.FindNode("winterMotion").enabled = m.guide.winter and m.fullscreen <> true and m.guide.visible <> true
    m.top.FindNode("guideWinterMotion").enabled = m.guide.winter and m.guide.visible = true
    for each nodeId in ["room", "guideRoom"]
        room = m.top.FindNode(nodeId)
        room.uri = theme.background
        room.opacity = theme.backgroundOpacity
        if nodeId = "room" and m.home.visible = true then room.opacity = 0.85
    end for
    paintTheme({ background: "appBg", menuPanel: "panelAltBg", listPanel: "panelBg", accent: "primary",
        heading: "text", profileLabel: "primary", status: "textMuted", channelTitle: "primary",
        nowHeading: "primary", nextHeading: "primary", nowTitle: "text", nextTitle: "textMuted",
        emptyMessage: "text", hint: "primary", buildLabel: "textMuted", guideBackground: "appBg",
        browserHeader: "appBg", browserFooter: "appBg", guideHeaderShield: "appBg", guideFooterShield: "appBg",
        bannerPanel: "panelBg", bannerChannel: "primary", bannerProgramme: "text", bannerHelp: "textMuted" })
    m.menu.color = colors.text
    m.menu.focusedColor = colors.onPrimary
    m.menu.focusBitmapBlendColor = colors.primary
    for each component in [m.home, m.channels, m.guide]
        component.themeColors = colors
    end for
    m.libraryGrid.focusBitmapBlendColor = colors.primary
    m.playerFocus.color = colors.primary
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
