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
    cardWidth = 214
    cardHeight = 200
    artHeight = 120
    if item.portraitCard = true
        cardWidth = 174
        cardHeight = 344
        artHeight = 243
    end if
    for each id in ["border", "focusFrame"]
        m.top.FindNode(id).width = cardWidth
        m.top.FindNode(id).height = cardHeight
    end for
    panel = m.top.FindNode("panel")
    panel.width = cardWidth - 6
    panel.height = cardHeight - 6
    poster = m.top.FindNode("poster")
    poster.width = cardWidth - 12
    poster.height = artHeight
    poster.loadWidth = (cardWidth - 12) * 2
    poster.loadHeight = artHeight * 2
    title = m.top.FindNode("title")
    title.width = cardWidth - 20
    title.translation = [10,artHeight + 18]
    title.height = cardHeight - artHeight - 24
    title.maxLines = 2
    m.top.FindNode("badgePanel").width = cardWidth - 12
    m.top.FindNode("badgePanel").translation = [6,artHeight - 18]
    m.top.FindNode("badge").width = cardWidth - 24
    m.top.FindNode("badge").translation = [12,artHeight - 18]
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
