sub updateContent()
    item = m.top.itemContent
    if item = invalid then return
    m.top.FindNode("channel").text = item.title
    m.top.FindNode("now").text = item.shortDescriptionLine1
    m.top.FindNode("next").text = item.shortDescriptionLine2
    showFocus()
end sub
