' Runs the actual guide renderer, navigation and request lifecycle without hardware.
sub main()
    _brs_.mockFunction("CreateObject", function(kind, name)
        return node()
    end function)
    m.top = node()
    m.top.visible = true
    m.top.query = ""
    m.top.category = ""
    m.top.audience = "all"
    m.top.favourites = ["7"]
    init()
    channels = []
    data = { ok: true, audience: "all", start: 1800000000, end: 1800010800, now: 1800000600, minStart: 1800000000, maxStart: 1800248400, clock: "7:40 pm", date: "Mon, Nov 16", slots: ["7:30 pm", "8:00 pm", "8:30 pm", "9:00 pm", "9:30 pm", "10:00 pm"], days: [{ label: "Now", start: 1800000000 }, { label: "Tomorrow", start: 1800018000 }], channels: [] }
    for i = 1 to 12
        channels.Push({ id: "channel:" + i.ToStr(), number: i, title: "Station " + i.ToStr(), now: "Current show", next: "Next show", poster: "logo.png", category: "Entertainment" })
        cells = []
        for j = 0 to 5
            cells.Push({ title: "Programme " + j.ToStr(), type: "SHOW", start: data.start + j * 1800, end: data.start + (j+1)*1800, minutes: 30 })
        end for
        data.channels.Push({ id: "channel:" + i.ToStr(), cells: cells })
    end for
    m.top.channels = channels
    m.top.channelId = "channel:7"
    open()
    data.requestId = m.sequence
    onGuideData(event(data))
    check(m.index = 6 and m.top.focused, "Opening highlights the tuned station")
    check(m.rows.children.Count() = 4, "Only a bounded page of four rows is built")
    check(m.top.FindNode("nowLine").visible, "Current-time line is shown in the live window")
    check(m.top.FindNode("detailTitle").text = "Programme 0", "Full selected title is shown above the grid")
    releaseCachedGuide()
    check(m.data.start = data.start and m.rows.children.Count() = 4, "Memory pressure preserves the visible guide")
    check(onKeyEvent("right", true) and m.cursor = data.start + 1800, "Right moves through programmes without retuning")
    check(m.top.selectedId = invalid, "Browsing does not emit a playback selection")
    onKeyEvent("down", true)
    check(m.index = 7 and m.cursor = data.start + 1800, "Vertical browsing preserves the selected time")
    updateChannels()
    check(m.index = 7, "Catalogue refresh preserves the browsed channel")
    onKeyEvent("OK", true)
    check(m.top.selectedId = "channel:8", "Future programme selection tunes its channel live")
    m.top.selectedId = ""
    check(not onKeyEvent("OK", false) and m.top.selectedId = "", "Key releases cannot tune")
    onKeyEvent("channeldown", true)
    check(m.index = 11, "Channel Down pages channels and clamps to final row")
    m.index = 0
    onKeyEvent("up", true)
    check(m.zone = "days", "Up from first row reaches day tabs")
    onKeyEvent("up", true)
    check(m.zone = "tools", "Up from day tabs reaches filters")
    m.tool = 2
    onKeyEvent("OK", true)
    check(m.ids.Count() = 1 and m.ids[0] = "channel:7", "Favourites use the selected profile's saved channel IDs")
    onKeyEvent("OK", true)
    m.top.query = "12"
    updateChannels()
    check(m.ids.Count() = 1 and m.ids[0] = "channel:12", "Search matches channel numbers")
    m.top.query = "no match"
    updateChannels()
    check(m.rows.children.Count() = 0 and m.top.FindNode("empty").visible, "Empty filters remove all old programme rows")
    m.zone = "grid"
    onKeyEvent("OK", true)
    check(m.top.selectedId = "", "Empty filtered guide cannot select a stale station")
    onKeyEvent("up", true)
    check(m.zone = "days", "Empty guide still lets viewers reach filters")
    m.top.query = ""
    updateChannels()
    m.compact = true
    render()
    check(m.rows.children.Count() = 5, "Compact mode fits five readable rows")
    savedData = m.data
    onGuideData(event({ ok: false, requestId: m.sequence }))
    check(m.data.start = savedData.start and Instr(1,m.top.FindNode("status").text,"offline") > 0, "A failed refresh retains current listings and offers retry")
    onGuideData(event({ ok: true, audience: "kids", requestId: m.sequence, channels: [] }))
    check(m.data.start = savedData.start, "A reply for another audience cannot replace the guide")
    onGuideData(event({ ok: true, audience: "all", requestId: m.sequence - 1, channels: [] }))
    check(m.data.start = savedData.start, "Old requests cannot overwrite newer guide data")
    changeWindow(data.maxStart + 10800)
    check(m.start = data.maxStart and m.data = invalid, "Horizon clamps and old programme labels disappear while a new window loads")
    check(not m.top.FindNode("nowLine").visible, "No stale Now line appears on a loading future window")
    onKeyEvent("replay", true)
    check(m.start = 0 and m.cursor = 0, "Replay requests current listings")
    m.top.channels = [channels[1]]
    updateChannels()
    check(m.index = 0 and m.ids[0] = "channel:2", "Removed channels cannot survive lineup updates")
    shutdown()
    check(m.task = invalid and m.top.FindNode("tick").control = "stop", "Closing stops background guide work")
    check(onKeyEvent("back", true) and m.top.closeRequested, "Back returns without changing the stream")
    m.top.visible = false
    m.data = savedData
    releaseCachedGuide()
    check(m.data = invalid and m.rows.children.Count() = 0, "Memory pressure releases listings and rendered rows for a hidden guide")
    updateChannels()
    check(m.rows.children.Count() = 0, "A catalogue update does not recreate the hidden guide")
    m.top.visible = true
    open()
    check(m.rows.children.Count() = 1 and m.task <> invalid, "Opening a released guide rebuilds the lineup and refreshes listings")
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: guide timeline, filters, focus, paging, request races, empty states and lifecycle"
end sub
function event(data as object) as object
    return { value: data, GetData: function(): return m.value: end function }
end function
function node() as object
    return {
        children: [], nodes: {}, font: {}
        FindNode: function(id)
            if m.nodes[id] = invalid then m.nodes[id] = node()
            return m.nodes[id]
        end function
        SetFocus: sub(value): m.focused = value: end sub
        ObserveField: sub(a,b): end sub
        UnobserveField: sub(a): end sub
        GetChildCount: function(): return m.children.Count(): end function
        RemoveChildrenIndex: sub(count, index): m.children = []: end sub
        CreateChild: function(kind)
            child = node()
            child.kind = kind
            m.children.Push(child)
            return child
        end function
    }
end function
sub check(condition as boolean, description as string)
    if condition then return
    if m.failed = invalid then m.failed = 0
    m.failed++
    print "FAIL: "; description
end sub
