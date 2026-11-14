' Exercise the guide's real navigation and row rendering with lightweight node stubs.
sub main()
    rows = node()
    m.top = node()
    m.top.nodes = { rows: rows, empty: {}, position: {} }
    m.top.FindNode = function(id)
        return m.nodes[id]
    end function
    m.top.accent = "0xE7C584FF"
    m.top.SetFocus = sub(value)
        m.focused = value
    end sub
    init()
    channels = []
    for i = 1 to 12
        channels.Push({ id: "channel:" + i.ToStr(), number: i, title: "Station " + i.ToStr(), now: "Current show", next: "Next show" })
    end for
    m.top.channels = channels
    updateChannels()
    m.top.channelId = "channel:7"
    open()
    check(m.index = 6 and m.top.focused, "Opening highlights the tuned station")
    check(rows.children.Count() = 5 and m.top.nodes.position.text = "6–10 of 12", "Only one bounded page of readable rows is built")
    check(rows.children[1].children[1].text = "CH 7 • LIVE", "The playing station is visibly marked")
    check(rows.children[1].children[3].text = "Current show" and rows.children[1].children[4].text = "Next show", "Guide rows display real Now and Next metadata")
    m.top.themeColors = { text: "0x10233BFF", onPrimary: "0xFFFFFFFF", guideRowBg: "0xF8FBFFFF", guideCurrentBg: "0x1769C2FF" }
    render()
    check(rows.children[1].children[0].color = "0x1769C2FF" and rows.children[1].children[3].color = "0xFFFFFFFF", "The tuned row keeps white text on Bright Cable's blue background")
    check(rows.children[0].children[3].color = "0x10233BFF", "Other light-theme rows use dark programme text")
    check(onKeyEvent("down", true) and m.index = 7, "Down browses without tuning")
    check(m.top.selectedId = invalid, "Browsing does not emit a playback selection")
    m.top.channels = channels
    updateChannels()
    check(m.index = 7, "Minute refresh preserves the browsed row instead of jumping to the playing station")
    check(onKeyEvent("right", true) and m.index = 11, "Right advances a page and clamps at the final channel")
    check(rows.children.Count() = 2, "The final page does not create empty selectable rows")
    check(onKeyEvent("down", true) and m.index = 0, "Down wraps at the last allowed channel")
    check(onKeyEvent("up", true) and m.index = 11, "Up wraps at the first allowed channel")
    check(onKeyEvent("left", true) and m.index = 6, "Left pages backward")
    check(not onKeyEvent("OK", false) and m.top.selectedId = invalid, "Key releases cannot select a channel")
    check(onKeyEvent("OK", true) and m.top.selectedId = "channel:7", "OK emits the permanent channel identifier")
    check(onKeyEvent("back", true) and m.top.closeRequested, "Back asks the viewer to restore its previous layout")

    m.top.channels = [channels[1]]
    updateChannels()
    check(m.index = 0 and rows.children.Count() = 1, "Removing the highlighted channel leaves a valid selection")
    onKeyEvent("OK", true)
    check(m.top.selectedId = "channel:2", "Selection after a lineup change uses the new allowed channel")
    m.top.channels = []
    updateChannels()
    m.top.selectedId = ""
    check(rows.children.Count() = 0 and m.top.nodes.empty.visible, "An empty audience clears old rows and shows a recovery message")
    check(not onKeyEvent("OK", true) and m.top.selectedId = "", "An empty guide cannot tune a stale channel")
    check(onKeyEvent("back", true), "Back still closes an empty guide")
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: guide paging, selection, refresh, rendering and empty audience"
end sub

function node() as object
    return {
        children: [], font: {}
        GetChildCount: function()
            return m.children.Count()
        end function
        RemoveChildrenIndex: sub(count, index)
            m.children = []
        end sub
        CreateChild: function(kind)
            child = node()
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
