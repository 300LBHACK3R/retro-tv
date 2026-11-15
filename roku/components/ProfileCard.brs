sub init()
    updateFocus()
end sub

sub updateFocus()
    border = m.top.FindNode("border")
    paintTheme({ panel: "panelBg", titleLabel: "text", subtitleLabel: "textMuted", addHorizontal: "text", addVertical: "text" })
    border.color = themeColor("border", "0x708078FF")
    if m.top.selected
        border.color = themeColor("primary", "0xF1CA83FF")
        m.top.FindNode("titleLabel").color = border.color
    end if
end sub
