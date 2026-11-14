sub updateContent()
    item = m.top.itemContent
    if item = invalid then return
    m.top.FindNode("title").text = item.title
    m.top.FindNode("poster").uri = item.HDPosterUrl
    showFocus()
end sub
