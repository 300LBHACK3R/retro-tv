' Run with an off-device BrightScript interpreter, alongside components/Viewer.brs.
' Nodes below model focus and fields only; they do not simulate video or render XML.
sub main()
    resetViewer()
    m.home.visible = true
    m.catalog = { channels: [{ id: "channel:7", number: 7 }, { id: "channel:1", number: 1 }] }
    enterViewer()
    check(m.requested = "channel:1", "Guest entry starts channel one when available")
    check(not m.home.visible and m.view = "live", "Guest entry opens the shared viewer")
    check(m.focus.current = "player", "Entry focuses the live player")

    resetViewer()
    m.kids = true
    m.catalog = { channels: [{ id: "channel:kids", number: 22 }] }
    enterViewer()
    check(m.requested = "channel:kids" and m.kids, "Kids entry stays within its filtered lineup")
    m.catalog.channels = []
    m.requested = ""
    m.autoTune = true
    startDefaultChannel()
    check(m.requested = "" and Instr(1, m.playerMessage.text, "Kids") > 0, "Empty Kids lineup never falls back to adult channels")

    resetViewer()
    enterViewer()
    check(m.autoTune and m.requested = "", "Entry waits for its catalogue")
    m.catalog = { channels: [{ id: "channel:2", number: 2 }] }
    startDefaultChannel()
    check(m.requested = "channel:2", "Catalogue completion starts an available channel")
    m.requested = ""
    startDefaultChannel()
    check(m.requested = "", "Catalogue refresh does not restart playback")
    m.autoTune = true
    m.home.visible = true
    startDefaultChannel()
    check(m.requested = "", "Background catalogue cannot play behind the home screen")
    m.home.visible = false
    m.pendingLaunch = { id: "media:episode" }
    startDefaultChannel()
    check(m.requested = "", "A deep link takes priority over automatic tuning")

    resetViewer()
    m.video.visible = true
    m.video.position = 73
    m.video.control = "play"
    focusPlayer()
    enterFullscreen()
    check(m.fullscreen and m.video.width = 1280 and m.focus.current = "video", "Fullscreen receives native player controls")
    check(not onKeyEvent("options", true), "Fullscreen leaves captions and options to Roku")
    check(onKeyEvent("back", true), "Back leaves fullscreen")
    check(not m.fullscreen and m.video.width = 640, "Back restores the inline player")
    check(m.video.position = 73 and m.video.control = "play", "Resizing does not seek or restart playback")
    check(m.restored = "player", "Back restores the player's browsing focus")
    m.view = "library"
    layoutVideo()
    check(m.video.width = 176 and not m.video.enableUI, "Library keeps a small player without transport overlays")
    check(not m.profileLabel.visible, "Mini player cannot overlap the account label")

    resetViewer()
    m.catalog = { channels: [{ id: "channel:1", number: 1 }] }
    m.playing = { mediaType: "live" }
    openLive()
    check(m.requested = "" and not m.stopped, "Returning to Live retains the existing live programme")
    m.playing = { mediaType: "episode" }
    openLive()
    check(m.stopped and m.requested = "channel:1", "Opening Live from VOD tunes the live schedule")
    check(onKeyEvent("down", true) and m.focus.current = "channels", "Down reaches the channel strip")
    check(onKeyEvent("up", true) and m.focus.current = "player", "Up returns to the player")
    m.channels.selectedId = "channel:2"
    onChannelSelected()
    check(m.requested = "channel:2" and m.restoreTarget = "channels", "Tuning preserves the channel browsing target")
    m.top.dialog = {}
    check(not onKeyEvent("back", true), "Dialogs retain their own Back handling")

    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: viewer navigation and audience regression checks"
end sub

sub resetViewer()
    m.focus = { current: "" }
    m.top = {
        dialog: invalid
        nodes: { hint: {} }
        FindNode: function(id)
            return m.nodes[id]
        end function
    }
    m.home = { visible: false }
    m.video = focusNode("video")
    m.video.visible = false
    m.playerTarget = focusNode("player")
    m.channels = focusNode("channels")
    m.menu = focusNode("menu")
    m.list = focusNode("guide")
    m.libraryGrid = focusNode("library")
    m.playerMessage = { text: "" }
    m.playerFocus = { visible: false }
    m.profileLabel = { visible: true }
    m.catalog = invalid
    m.pendingLaunch = invalid
    m.playing = invalid
    m.isLoadingPlayback = false
    m.fullscreen = false
    m.autoTune = false
    m.kids = false
    m.view = "live"
    m.requested = ""
    m.stopped = false
    if m.failed = invalid then m.failed = 0
end sub

function focusNode(id as string) as object
    return {
        id: id, focus: m.focus
        SetFocus: sub(focused)
            if focused then m.focus.current = m.id
        end sub
        HasFocus: function()
            return m.focus.current = m.id
        end function
    }
end function

sub check(condition as boolean, description as string)
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub

' Scene and API boundaries; the viewer's routing and layout functions run unchanged.
sub showBrowser()
    m.home.visible = false
end sub
sub renderList(preserve as boolean)
end sub
sub requestPlayback(id as string)
    m.requested = id
end sub
sub stopPlayback()
    m.stopped = true
    m.playing = invalid
end sub
sub restoreFocus()
    m.restored = m.restoreTarget
end sub
