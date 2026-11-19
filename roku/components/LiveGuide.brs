sub init()
    m.index = 0
    m.ids = []
    m.filtered = []
    m.zone = "grid"
    m.tool = 0
    m.day = 0
    m.compact = false
    m.favouritesOnly = false
    m.data = invalid
    m.start = 0
    m.cursor = 0
    m.sequence = 0
    m.rows = m.top.FindNode("rows")
    m.top.FindNode("tick").ObserveField("fire", "refreshGuide")
end sub

sub shutdown()
    m.sequence++
    if m.task <> invalid
        m.task.UnobserveField("response")
        m.task.control = "stop"
        m.task = invalid
    end if
    m.top.FindNode("tick").control = "stop"
end sub

sub releaseCachedGuide()
    if m.top.visible then return
    m.data = invalid
    for each id in ["tools", "days", "slots", "rows"]
        clearNodes(m.top.FindNode(id))
    end for
end sub

sub open()
    shutdown()
    m.data = invalid
    m.start = 0
    m.cursor = 0
    m.zone = "grid"
    m.day = 0
    m.favouritesOnly = false
    m.top.query = ""
    m.top.category = ""
    updateChannels()
    for i = 0 to m.ids.Count() - 1
        if m.ids[i] = m.top.channelId then m.index = i
    end for
    render()
    m.top.SetFocus(true)
    refreshGuide()
    m.top.FindNode("tick").control = "start"
end sub

sub updateChannels()
    if m.ids = invalid then return
    previous = ""
    if m.index < m.ids.Count() then previous = m.ids[m.index]
    m.ids = []
    m.filtered = []
    m.index = 0
    if m.top.channels <> invalid
        for each channel in m.top.channels
            matches = true
            if m.top.query <> "" then matches = Instr(1, LCase(channel.title + " " + channel.number.ToStr()), LCase(m.top.query)) > 0
            if m.top.category <> "" and channel.category <> m.top.category then matches = false
            if m.favouritesOnly and not isFavourite(channel.id) then matches = false
            if matches
                m.ids.Push(channel.id)
                m.filtered.Push(channel)
                if channel.id = previous then m.index = m.ids.Count() - 1
            end if
        end for
    end if
    render()
end sub

function isFavourite(id as string) as boolean
    if m.top.favourites <> invalid
        for each saved in m.top.favourites
            if id = "channel:" + saved then return true
        end for
    end if
    return false
end function

sub refreshGuide()
    if not m.top.visible then return
    if m.task <> invalid
        m.task.UnobserveField("response")
        m.task.control = "stop"
    end if
    m.sequence++
    task = CreateObject("roSGNode", "ApiTask")
    task.path = "guide?audience=" + m.top.audience + "&start=" + m.start.ToStr()
    task.requestId = m.sequence
    task.ObserveField("response", "onGuideData")
    m.task = task
    m.top.FindNode("status").text = "Updating listings..."
    task.control = "run"
end sub

sub onGuideData(event as object)
    data = event.GetData()
    if data.requestId <> m.sequence or not m.top.visible then return
    if data.ok <> true or data.audience <> m.top.audience
        m.top.FindNode("status").text = "Guide offline. Press Replay to retry. You can still watch live."
        return
    end if
    if type(data.channels) <> "roArray" or type(data.days) <> "roArray" or type(data.slots) <> "roArray" then return
    m.data = data
    m.start = data.start
    if m.cursor < data.start or m.cursor >= data.end
        m.cursor = data.start
        if data.now >= data.start and data.now < data.end then m.cursor = data.now
    end if
    m.top.FindNode("status").text = data.date + "   •   Local time   •   72-hour guide"
    render()
end sub

sub changeWindow(start as dynamic)
    if m.data <> invalid
        if start < m.data.minStart then start = m.data.minStart
        if start > m.data.maxStart then start = m.data.maxStart
    end if
    if start = m.start and m.data <> invalid then return
    m.start = start
    m.cursor = start
    m.data = invalid
    render()
    refreshGuide()
end sub

function selectedCells() as object
    if m.index >= m.ids.Count() then return []
    return cellsFor(m.ids[m.index])
end function

function cellsFor(id as string) as object
    if m.data <> invalid
        for each channel in m.data.channels
            if channel.id = id then return channel.cells
        end for
    end if
    return []
end function

function selectedCellIndex(cells as object) as integer
    for i = 0 to cells.Count() - 1
        if cells[i].end > m.cursor then return i
    end for
    return cells.Count() - 1
end function

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "back"
        m.top.closeRequested = true
        return true
    end if
    if key = "replay"
        m.start = 0
        m.cursor = 0
        m.data = invalid
        m.day = 0
        render()
        refreshGuide()
        return true
    end if
    if key = "rewind" or key = "fastforward"
        if m.data <> invalid
            amount = 10800
            if key = "rewind" then amount = -10800
            changeWindow(m.start + amount)
        end if
        return true
    end if
    count = m.ids.Count()
    if m.zone = "tools"
        lastTool = 3
        if m.top.storeEdition = true then lastTool = 2
        if key = "left" and m.tool > 0 then m.tool--
        if key = "right" and m.tool < lastTool then m.tool++
        if key = "down" then m.zone = "days"
        if key = "OK"
            if m.tool = 0 then m.top.action = "search"
            if m.tool = 1 then m.top.action = "category"
            if m.tool = 2 and m.top.storeEdition <> true
                m.favouritesOnly = not m.favouritesOnly
                updateChannels()
            end if
            if m.tool = lastTool then m.compact = not m.compact
        end if
    else if m.zone = "days"
        if key = "up" then m.zone = "tools"
        if key = "down" and count > 0 then m.zone = "grid"
        if m.data = invalid and key = "OK" then refreshGuide()
        if m.data <> invalid
            if key = "left" and m.day > 0 then m.day--
            if key = "right" and m.day < m.data.days.Count() - 1 then m.day++
            if key = "OK"
                target = m.data.days[m.day].start
                changeWindow(target)
            end if
        end if
    else
        if key = "up"
            if m.index > 0 then m.index-- else m.zone = "days"
        else if key = "down" and m.index < count - 1
            m.index++
        else if key = "channelup" or key = "channeldown"
            amount = pageSize()
            if key = "channelup" then amount = -amount
            m.index = m.index + amount
            if m.index < 0 then m.index = 0
            if m.index >= count then m.index = count - 1
            if m.index < 0 then m.index = 0
        else if key = "left" or key = "right"
            cells = selectedCells()
            selected = selectedCellIndex(cells)
            stepBy = 1
            if key = "left" then stepBy = -1
            target = selected + stepBy
            if target >= 0 and target < cells.Count()
                m.cursor = cells[target].start
            else if m.data <> invalid
                changeWindow(m.start + stepBy * 10800)
            end if
        else if key = "OK" or key = "play" or key = "playonly"
            if count > 0 then m.top.selectedId = m.ids[m.index]
            return true
        end if
    end if
    render()
    return true
end function
