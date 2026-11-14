sub init()
    updateFocus()
end sub

sub updateFocus()
    border = m.top.FindNode("border")
    if m.top.selected then border.color = m.top.accent else border.color = "0x708078FF"
    m.top.FindNode("titleLabel").color = "0xFFF3D8FF"
    if m.top.selected then m.top.FindNode("titleLabel").color = m.top.accent
end sub
