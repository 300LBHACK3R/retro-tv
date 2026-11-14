' Run with brs and components/ChannelStrip.brs. Drawing is replaced by a counter.
sub main()
    _brs_.mockFunction("render", sub()
        m.renders++
    end sub)
    m.renders = 0
    m.top = { channels: [{ id: "channel:1" }, { id: "channel:7" }], channelId: "channel:1", focused: true, HasFocus: function()
        return m.focused
    end function }
    m.ids = []
    m.index = 0
    updateChannels()
    check(onKeyEvent("left", true) and m.index = 1, "Left wraps to the last channel")
    check(onKeyEvent("right", true) and m.index = 0, "Right wraps to the first channel")
    check(not onKeyEvent("right", false) and m.index = 0, "A key release cannot move twice")
    check(onKeyEvent("OK", true) and m.top.selectedId = "channel:1", "OK selects the highlighted channel")
    check(not onKeyEvent("up", true), "Up bubbles to the viewer so focus can leave the strip")
    check(not onKeyEvent("back", true), "Back bubbles to the viewer menu")
    m.top.channelId = "channel:7"
    syncTunedChannel()
    check(m.index = 0, "Metadata does not steal a focused channel selection")
    m.top.focused = false
    syncTunedChannel()
    check(m.index = 1, "Channel shortcuts align the unfocused strip with the tuned channel")
    m.top.channels = [{ id: "channel:7" }, { id: "channel:1" }]
    updateChannels()
    check(m.index = 0, "Refreshing listings preserves selection by ID after reordering")
    m.top.channels = []
    updateChannels()
    check(not onKeyEvent("OK", true) and not onKeyEvent("left", true), "An empty lineup never selects an unavailable channel")
    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: channel strip navigation, focus and refresh"
end sub
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
