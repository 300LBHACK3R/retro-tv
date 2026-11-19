sub updateColors()
    m.top.FindNode("winterTrim").visible = m.top.winter
    m.top.FindNode("winterOrnaments").visible = m.top.winter
    paintTheme({ title: "text", clock: "primary", detailTitle: "text", detailMeta: "textMuted", previewLabel: "textMuted",
        panel: "guideHeaderBg", empty: "text", position: "textMuted", status: "textMuted", help: "primary", nowLine: "primary" })
    render()
end sub

function pageSize() as integer
    if m.compact then return 5
    return 4
end function

sub clearNodes(node as object)
    node.RemoveChildrenIndex(node.GetChildCount(), 0)
end sub

function guideBox(parent as object, x as float, y as float, width as float, height as float, color as string) as object
    node = parent.CreateChild("Rectangle")
    node.translation = [x,y]
    node.width = width
    node.height = height
    node.color = color
    return node
end function

function guideLabel(parent as object, text as string, x as float, y as float, width as float, height as float, color as string, size = 20 as integer) as object
    label = parent.CreateChild("Label")
    label.translation = [x,y]
    label.width = width
    label.height = height
    label.text = text
    label.wrap = false
    label.vertAlign = "center"
    label.font.size = size
    label.color = color
    return label
end function

sub renderControls()
    tools = m.top.FindNode("tools")
    days = m.top.FindNode("days")
    slots = m.top.FindNode("slots")
    clearNodes(tools)
    clearNodes(days)
    clearNodes(slots)
    labels = ["Search channels", "All categories"]
    if m.top.storeEdition <> true
        favouriteLabel = "Favourites"
        if m.favouritesOnly then favouriteLabel = "Favourites: On"
        labels.Push(favouriteLabel)
    end if
    rowModeLabel = "Compact rows"
    if m.compact then rowModeLabel = "Comfortable rows"
    labels.Push(rowModeLabel)
    if m.top.query <> "" then labels[0] = "Search: " + m.top.query
    if m.top.category <> "" then labels[1] = m.top.category
    stride = Int(1184 / labels.Count())
    for i = 0 to labels.Count() - 1
        drawButton(tools, labels[i], i * stride, 0, stride - 8, 44, m.zone = "tools" and m.tool = i)
    end for
    if m.data <> invalid
        m.top.FindNode("clock").text = m.data.clock
        for i = 0 to m.data.days.Count() - 1
            day = m.data.days[i]
            drawButton(days, day.label, i * 154, 0, 144, 40, m.zone = "days" and m.day = i)
        end for
        guideLabel(days, m.data.date, 630, 0, 546, 40, themeColor("textMuted", "0xCAD8E6FF"))
    else
        drawButton(days, "Now / Retry", 0, 0, 144, 40, m.zone = "days")
    end if
    guideLabel(slots, "CHANNELS", 12, 0, 212, 38, themeColor("textMuted", "0xCAD8E6FF"), 18)
    for i = 0 to 5
        x = 224 + i * 952 / 6
        guideBox(slots, x, 0, 1, 38, themeColor("border", "0x354963FF"))
        text = ""
        if m.data <> invalid then text = m.data.slots[i]
        guideLabel(slots, text, x + 12, 0, 142, 38, themeColor("text", "0xF5F6FFFF"), 18)
    end for
end sub

sub drawButton(parent as object, text as string, x as integer, y as integer, width as integer, height as integer, focused as boolean)
    borderColor = themeColor("border", "0x354963FF")
    bg = themeColor("panelAltBg", "0x132538FF")
    fg = themeColor("text", "0xF5F6FFFF")
    if focused
        borderColor = themeColor("onPrimary", "0x071522FF")
        bg = themeColor("primary", "0xF1CA83FF")
        fg = borderColor
    end if
    outer = guideBox(parent, x, y, width, height, borderColor)
    guideBox(outer, 2, 2, width - 4, height - 4, bg)
    guideLabel(outer, text, 14, 0, width - 28, height, fg)
end sub

sub render()
    if m.rows = invalid or not m.top.visible then return
    renderControls()
    clearNodes(m.rows)
    count = m.ids.Count()
    m.top.FindNode("empty").visible = count = 0
    m.top.FindNode("empty").text = "No matching channels. Press Up to change filters, or Back to return."
    m.top.FindNode("position").text = ""
    m.top.FindNode("nowLine").visible = false
    m.top.FindNode("detailTitle").text = "Find something good."
    m.top.FindNode("detailMeta").text = "Choose a listing to watch its channel live."
    if count = 0 then return
    first = Int(m.index / pageSize()) * pageSize()
    last = first + pageSize() - 1
    if last >= count then last = count - 1
    m.top.FindNode("position").text = (first + 1).ToStr() + "–" + (last + 1).ToStr() + " of " + count.ToStr() + " channels"
    height = 62
    if m.compact then height = 50
    for i = first to last
        channel = m.filtered[i]
        bg = themeColor("guideRowBg", "0x0B192CFF")
        if i mod 2 = 1 then bg = themeColor("guideRowAltBg", "0x132538FF")
        row = guideBox(m.rows, 0, (i-first) * height, 1176, height - 2, bg)
        if channel.id = m.top.channelId then guideBox(row, 0, 0, 4, height - 2, themeColor("primary", "0xF1CA83FF"))
        logo = row.CreateChild("Poster")
        logo.translation = [10, 8]
        logo.width = 44
        logo.height = height - 16
        logo.loadDisplayMode = "scaleToFit"
        if channel.poster <> invalid then logo.uri = channel.poster
        number = "CH " + channel.number.ToStr()
        if channel.id = m.top.channelId then number = number + " • LIVE"
        guideLabel(row, number, 64, 3, 154, 24, themeColor("primary", "0xF1CA83FF"), 17)
        guideLabel(row, channel.title, 64, 27, 154, height - 28, themeColor("text", "0xF5F6FFFF"), 19)
        cells = cellsFor(channel.id)
        selected = selectedCellIndex(cells)
        for j = 0 to cells.Count() - 1
            cell = cells[j]
            x = 224 + (cell.start - m.data.start) / 10800 * 952
            width = (cell.end - cell.start) / 10800 * 952
            if width >= 2
                focus = i = m.index and j = selected and m.zone = "grid"
                fg = themeColor("text", "0xF5F6FFFF")
                fill = bg
                edge = themeColor("border", "0x354963FF")
                if focus
                    fill = themeColor("guideActiveBg", "0xF1CA83FF")
                    fg = themeColor("onPrimary", "0x071522FF")
                    edge = fg
                end if
                tile = guideBox(row, x, 0, width - 1, height - 2, edge)
                if width > 5 then guideBox(tile, 2, 2, width - 5, height - 6, fill)
                if width > 40
                    guideLabel(tile, cell.title, 10, 3, width - 20, 29, fg, 21)
                    if not m.compact and width > 90 then guideLabel(tile, cell.type + " / " + cell.minutes.ToStr() + " min", 10, 32, width - 20, 24, fg, 16)
                end if
            end if
            if i = m.index and j = selected
                m.top.FindNode("detailTitle").text = cell.title
                m.top.FindNode("detailMeta").text = "CH " + channel.number.ToStr() + " • " + channel.title + "   /   " + cell.type + "   /   " + cell.minutes.ToStr() + " min   •   OK watches live"
            end if
        end for
        if cells.Count() = 0
            fg = themeColor("text", "0xF5F6FFFF")
            if i = m.index and m.zone = "grid" then guideBox(row, 224, 0, 4, height - 2, themeColor("primary", "0xF1CA83FF"))
            guideLabel(row, "Schedule unavailable • OK to watch live", 240, 0, 920, height - 2, fg)
            if i = m.index then m.top.FindNode("detailTitle").text = channel.now
        end if
    end for
    if m.data <> invalid
        if m.data.now >= m.data.start and m.data.now < m.data.end
            line = m.top.FindNode("nowLine")
            line.translation = [276 + (m.data.now - m.data.start) / 10800 * 952, 390]
            line.height = (last - first + 1) * height - 2
            line.visible = true
        end if
    end if
end sub
