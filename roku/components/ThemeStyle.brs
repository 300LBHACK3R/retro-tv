function themeColor(token as string, fallback as string) as string
    if m.top.themeColors <> invalid
        value = m.top.themeColors[token]
        if value <> invalid then return value
    end if
    return fallback
end function

sub paintTheme(nodes as object)
    if m.top.themeColors = invalid then return
    for each id in nodes
        node = m.top.FindNode(id)
        color = m.top.themeColors[nodes[id]]
        if node <> invalid and color <> invalid then node.color = color
    end for
end sub
