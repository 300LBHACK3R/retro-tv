sub init()
    updateFocus()
end sub

sub updateFocus()
    border = m.top.FindNode("border")
    paintTheme({ panel: "panelBg", titleLabel: "text", subtitleLabel: "textMuted", addHorizontal: "text", addVertical: "text" })
    if m.top.selected then border.color = m.top.accent else border.color = themeColor("border", "0x708078FF")
    if m.top.selected then m.top.FindNode("titleLabel").color = m.top.accent
end sub
