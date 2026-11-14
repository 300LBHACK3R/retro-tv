sub init()
    m.index = 0
    m.ids = []
    m.top.ObserveField("focusedChild", "render")
end sub

sub updateChannels()
    previousId = ""
    if m.index < m.ids.Count() then previousId = m.ids[m.index]
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

sub syncTunedChannel()
    ' Follow channel keys without moving a viewer's in-progress strip selection.
    if not m.top.HasFocus()
        for i = 0 to m.ids.Count() - 1
            if m.ids[i] = m.top.channelId then m.index = i
        end for
    end if
    render()
end sub

sub render()
    m.top.RemoveChildrenIndex(m.top.GetChildCount(), 0)
    if m.top.channels = invalid then return
    first = Int(m.index / 5) * 5
    for slot = 0 to 4
        index = first + slot
        if index >= m.top.channels.Count() then exit for
        channel = m.top.channels[index]
        card = m.top.CreateChild("Rectangle")
        card.translation = [slot * 184, 0]
        card.width = 172
        card.height = 64
        card.color = "0x132538FF"
        if channel.id = m.top.channelId then card.color = "0x35513FFF"
        selected = index = m.index and m.top.HasFocus()
        if selected then card.color = m.top.accent
        label = card.CreateChild("Label")
        label.translation = [10,4]
        label.width = 152
        label.height = 26
        label.font.size = 22
        label.text = "CH " + channel.number.ToStr()
        label.color = "0xFFF3D8FF"
        if selected then label.color = "0x102035FF"
        title = card.CreateChild("Label")
        title.translation = [10,32]
        title.width = 152
        title.height = 26
        title.font.size = 20
        title.text = channel.title
        title.color = label.color
    end for
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if m.ids.Count() = 0 then return false
    if key = "right" or key = "left"
        offset = 1
        if key = "left" then offset = -1
        m.index = (m.index + offset + m.ids.Count()) mod m.ids.Count()
        render()
        return true
    else if key = "OK"
        m.top.selectedId = m.ids[m.index]
        return true
    end if
    return false
end function
