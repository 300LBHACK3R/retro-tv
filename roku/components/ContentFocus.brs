sub showFocus()
    frame = m.top.FindNode("focusFrame")
    frame.visible = m.top.itemHasFocus
    if m.top.itemContent <> invalid then frame.color = m.top.itemContent.viewerAccent
end sub
