sub init()
    updateFocus()
end sub

sub updateFocus()
    border = m.top.FindNode("border")
    paintTheme({ panel: "panelBg", titleLabel: "text", subtitleLabel: "textMuted", addHorizontal: "text", addVertical: "text" })
    border.visible = m.top.selected
    m.top.FindNode("panel").visible = m.top.add
    border.color = themeColor("border", "0x708078FF")
    if m.top.selected
        border.visible = m.top.selected
    m.top.FindNode("panel").visible = m.top.add
    border.color = themeColor("primary", "0xF1CA83FF")
        m.top.FindNode("titleLabel").color = border.color
    end if
end sub
