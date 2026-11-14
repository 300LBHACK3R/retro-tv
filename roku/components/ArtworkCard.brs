sub updateContent()
    item = m.top.itemContent
    if item = invalid then return
    m.top.themeColors = item.viewerColors
    paintTheme({ border: "border", panel: "panelAltBg", title: "text", badge: "primary" })
    m.top.FindNode("title").text = item.title
    poster = m.top.FindNode("poster")
    poster.uri = item.HDPosterUrl
    poster.height = 120
    badge = m.top.FindNode("badge")
    badge.visible = item.themeBadge <> invalid and item.themeBadge <> ""
    if badge.visible
        badge.text = item.themeBadge
        poster.height = 94
    end if
    showFocus()
end sub
