sub updateContent()
    item = m.top.itemContent
    if item = invalid
        m.top.FindNode("title").text = ""
        m.top.FindNode("poster").uri = ""
        m.top.FindNode("badge").visible = false
        m.top.FindNode("badgePanel").visible = false
        m.top.FindNode("focusFrame").visible = false
        return
    end if
    m.top.themeColors = item.viewerColors
    paintTheme({ border: "border", panel: "panelAltBg", title: "text", badge: "textMuted", badgePanel: "panelBg" })
    m.top.FindNode("title").text = item.title
    poster = m.top.FindNode("poster")
    poster.uri = item.HDPosterUrl
    badge = m.top.FindNode("badge")
    badgePanel = m.top.FindNode("badgePanel")
    badge.visible = item.themeBadge <> invalid and item.themeBadge <> ""
    badgePanel.visible = badge.visible
    if badge.visible
        badge.text = item.themeBadge
        if item.themeBadge = "Selected"
            badge.color = themeColor("onPrimary", "0x18261BFF")
            badgePanel.color = themeColor("primary", "0xF1CA83FF")
        end if
    end if
    showFocus()
end sub

sub showFocus()
    frame = m.top.FindNode("focusFrame")
    frame.visible = m.top.itemHasFocus and m.top.itemContent <> invalid
    frame.color = themeColor("primary", "0xF1CA83FF")
end sub
