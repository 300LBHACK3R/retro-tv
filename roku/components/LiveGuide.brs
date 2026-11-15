sub init()
    m.index = 0
    m.ids = []
    m.rows = m.top.FindNode("rows")
end sub

sub updateChannels()
    previousId = ""
    if m.index >= 0 and m.index < m.ids.Count() then previousId = m.ids[m.index]
    m.ids = []
    m.index = 0
    if m.top.channels <> invalid
        for each channel in m.top.channels
            m.ids.Push(channel.id)
            if channel.id = previousId then m.index = m.ids.Count() - 1
        end for
    end if
    render()
end sub

sub open()
    for i = 0 to m.ids.Count() - 1
        if m.ids[i] = m.top.channelId then m.index = i
    end for
    render()
    m.top.SetFocus(true)
end sub

sub updateColors()
    paintTheme({ title: "text", subtitle: "textMuted", panel: "guideHeaderBg", channelHeading: "text",
        nowHeading: "text", nextHeading: "text", empty: "text", position: "textMuted", help: "primary", accentLine: "primary" })
    render()
end sub

sub render()
    if m.rows = invalid then return
    m.rows.RemoveChildrenIndex(m.rows.GetChildCount(), 0)
    count = m.ids.Count()
    m.top.FindNode("empty").visible = count = 0
    m.top.FindNode("position").text = ""
    if count = 0 then return
    first = Int(m.index / 5) * 5
    last = first + 4
    if last >= count then last = count - 1
    m.top.FindNode("position").text = (first + 1).ToStr() + "–" + (last + 1).ToStr() + " of " + count.ToStr()
    for i = first to last
        channel = m.top.channels[i]
        row = m.rows.CreateChild("Rectangle")
        row.translation = [0, (i - first) * 79]
        row.width = 1176
        row.height = 72
        row.color = themeColor("border", "0x314257FF")
        inset = row.CreateChild("Rectangle")
        inset.translation = [3,3]
        inset.width = 1170
        inset.height = 66
        inset.color = themeColor("guideRowBg", "0x132538FF")
        if i mod 2 = 1 then inset.color = themeColor("guideRowAltBg", "0x132538FF")
        textColor = themeColor("text", "0xFFF3D8FF")
        numberColor = themeColor("primary", "0xF1CA83FF")
        if channel.id = m.top.channelId
            inset.color = themeColor("guideCurrentBg", "0x224236FF")
            textColor = themeColor("onPrimary", "0xFFF3D8FF")
            numberColor = textColor
        end if
        if i = m.index
            inset.color = themeColor("guideActiveBg", "0xF1CA83FF")
            textColor = themeColor("onPrimary", "0x18261BFF")
            numberColor = textColor
            row.color = textColor
        end if
        number = "CH " + channel.number.ToStr()
        if channel.id = m.top.channelId then number = number + " • LIVE"
        addLabel(row, number, 12, 5, 224, 27, numberColor)
        addLabel(row, channel.title, 12, 34, 224, 30, textColor)
        addLabel(row, channel.now, 256, 6, 434, 60, textColor)
        addLabel(row, channel.next, 718, 6, 434, 60, textColor)
    end for
end sub

sub addLabel(parent as object, text as string, x as integer, y as integer, width as integer, height as integer, color as dynamic)
    label = parent.CreateChild("Label")
    label.translation = [x,y]
    label.width = width
    label.height = height
    label.text = text
    label.wrap = height > 30
    label.maxLines = 2
    label.vertAlign = "center"
    label.font.size = 22
    label.color = color
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "back"
        m.top.closeRequested = true
        return true
    end if
    count = m.ids.Count()
    if count = 0 then return false
    if key = "up" or key = "down" or key = "channelup" or key = "channeldown"
        stepBy = 1
        if key = "up" or key = "channelup" then stepBy = -1
        m.index = (m.index + stepBy + count) mod count
    else if key = "left" or key = "right"
        stepBy = 5
        if key = "left" then stepBy = -5
        m.index = m.index + stepBy
        if m.index < 0 then m.index = 0
        if m.index >= count then m.index = count - 1
    else if key = "OK" or key = "play" or key = "playonly"
        m.top.selectedId = m.ids[m.index]
        return true
    else
        return false
    end if
    render()
    return true
end function
