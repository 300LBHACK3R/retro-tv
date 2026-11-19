' Run with an off-device BrightScript interpreter, alongside components/Viewer.brs and components/Guide.brs.
' Nodes below model focus and fields only; they do not simulate video or render XML.
sub main()
    resetViewer()
    m.home.visible = true
    startApp(invalid)
    check(m.home.visible and not m.autoTune, "Normal app launch opens the account/free-viewing chooser")
    check(m.launchComplete, "Normal launch reports its usable home screen")
    m.catalog = { channels: [{ id: "channel:1", number: 1 }] }
    startDefaultChannel()
    check(m.requested = "", "Listings arriving behind Home do not start playback")
    m.home.action = "watch"
    onHomeAction()
    check(m.requested = "channel:1" and not m.home.visible, "Choosing Watch for free opens the viewer and starts live TV")

    resetViewer()
    m.fullStoreEdition = true
    m.registry = { preference: "saved", Read: function(key): return m.preference: end function,
        Delete: sub(key): m.preference = "": end sub, Flush: sub(): end sub }
    m.home.action = "watch"
    onHomeAction()
    check(m.registry.preference = "", "Explicit guest viewing clears the previous adult launch preference")

    resetViewer()
    m.catalog = { channels: [{ id: "channel:1", number: 1 }] }
    startApp({ source: "homescreen" })
    check(m.requested = "" and m.home.visible, "An already loaded catalogue still waits for a home selection")

    resetViewer()
    startApp(invalid)
    m.home.action = "watch"
    onHomeAction()
    check(m.autoTune and not m.home.visible, "Early free selection waits inside the viewer for the catalogue")
    m.catalog = { channels: [{ id: "channel:1", number: 1 }] }
    startDefaultChannel()
    check(m.requested = "channel:1", "A delayed catalogue starts live TV without another button press")

    resetViewer()
    startApp({ contentId: "media:episode", mediaType: "episode" })
    check(m.top.launch.contentId = "media:episode" and m.requested = "", "Cold deep links bypass default channel tuning")
    check(m.preparedProfileMediaType = "episode" and m.requestedLaunchProfile, "Cold deep links prepare the profile before dispatch")
    check(not isPlaybackLaunch({ contentId: 7, mediaType: "live" }), "Malformed launch values are rejected")
    check(not isPlaybackLaunch({ contentId: "", mediaType: "live" }), "Empty content IDs cannot block ordinary launch")

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
    check(m.video.width = 224 and not m.video.enableUI, "Library keeps a small player without transport overlays")
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

    resetViewer()
    m.catalog = { channels: [{ id: "channel:1", number: 1 }, { id: "channel:7", number: 7 }] }
    m.tunedChannelId = "channel:7"
    focusPlayer()
    check(onKeyEvent("OK", true) and m.requested = "channel:7", "Retry keeps the failed channel instead of switching to channel one")
    check(onKeyEvent("channelup", true) and m.requested = "channel:1", "Channel Up wraps within the allowed lineup")
    m.tunedChannelId = "channel:1"
    check(onKeyEvent("channeldown", true) and m.requested = "channel:7", "Channel Down wraps within the allowed lineup")
    m.catalog.channels = []
    m.requested = ""
    check(onKeyEvent("channelup", true) and m.requested = "", "An empty approved lineup cannot tune an adult fallback")
    m.home.visible = true
    check(not onKeyEvent("play", true), "Transport keys cannot start hidden playback on Home")
    m.home.visible = false
    check(not onKeyEvent("OK", false), "Key releases never repeat selections")

    resetViewer()
    m.video.visible = true
    m.video.control = "play"
    m.restoreTarget = "content"
    m.view = "episodes"
    m.libraryGrid.SetFocus(true)
    check(onKeyEvent("back", true) and m.view = "library", "Back from episodes returns to the library")
    check(onKeyEvent("back", true) and m.focus.current = "menu", "Back from the library returns to navigation")
    check(onKeyEvent("back", true) and m.home.visible, "Back from navigation returns to the home cards")
    m.home.visible = false
    m.fullscreen = true
    for each key in ["play", "playonly", "replay", "rewind", "fastforward", "options"]
        check(not onKeyEvent(key, true), "Fullscreen preserves native Roku control: " + key)
    end for
    m.top.dialog = {}
    m.requested = ""
    check(not onKeyEvent("channelup", true) and m.requested = "", "Channel shortcuts do not interrupt PIN or search dialogs")

    resetViewer()
    m.catalog = { channels: [{ id: "channel:1", number: 1, title: "Retro", now: "Show" }, { id: "channel:7", number: 7, title: "Kids", now: "Cartoon" }] }
    m.playing = { id: "channel:1", mediaType: "live", title: "Show" }
    m.tunedChannelId = "channel:1"
    m.video.visible = true
    m.video.control = "play"
    m.video.position = 73
    m.restoreTarget = "player"
    enterFullscreen()
    check(not m.video.enableUI, "Live fullscreen reserves directional keys for channel surfing")
    check(m.liveBanner.visible, "Fullscreen explains channel and guide controls")
    check(onKeyEvent("up", true) and m.requested = "channel:7" and m.fullscreen, "Up tunes the next allowed channel without leaving fullscreen")
    check(onKeyEvent("down", true) and m.requested = "channel:1" and m.fullscreen, "Down returns to the previous station")
    m.requested = ""
    check(not onKeyEvent("up", false) and m.requested = "", "Releasing a channel key does not tune twice")
    check(not onKeyEvent("options", true), "Live fullscreen leaves the native captions shortcut available")
    check(onKeyEvent("play", true) and m.video.control = "play", "Live transport cannot pause the station clock")
    check(onKeyEvent("OK", true), "OK opens the live guide from fullscreen")
    check(m.guide.visible and m.guideBackdrop.visible and m.focus.current = "guide", "The guide receives focus above the existing video")
    check(m.video.width = 320 and m.video.position = 73 and m.video.control = "play", "Guide preview resizes without stopping, seeking or retuning")
    check(m.catalogRefreshed and m.guide.channelId = "channel:1", "Opening the guide refreshes listings and identifies the tuned station")
    check(not onKeyEvent("up", true) and m.requested = "", "Guide arrows cannot change the background channel")
    closeGuide()
    check(not m.guide.visible and m.fullscreen and m.video.width = 1280, "Back restores the same fullscreen layout")
    check(m.focus.current = "video" and m.requested = "", "Closing the guide restores playback focus without a network tune")
    openGuide()
    m.guide.selectedId = "channel:1"
    onGuideSelected()
    check(not m.guide.visible and m.requested = "", "Selecting the playing station returns to fullscreen without restarting it")
    openGuide()
    m.guide.selectedId = "channel:7"
    onGuideSelected()
    check(m.requested = "channel:7" and m.fullscreen and m.focus.current = "video", "Selecting another guide row tunes it in fullscreen")
    openGuide()
    m.catalog.channels = [{ id: "channel:1", number: 1, title: "Retro", now: "Show" }]
    m.guide.selectedId = "channel:7"
    m.requested = ""
    onGuideSelected()
    check(m.requested = "" and m.guide.visible, "A removed channel cannot be tuned by a queued guide selection")

    resetViewer()
    m.kids = true
    m.catalog = { channels: [{ id: "channel:kids", number: 22, title: "Kids", now: "Cartoon" }] }
    m.playing = { id: "channel:kids", mediaType: "live", title: "Cartoon" }
    m.tunedChannelId = "channel:kids"
    m.video.visible = true
    enterFullscreen()
    check(onKeyEvent("up", true) and m.requested = "channel:kids", "Fullscreen surfing stays within a one-channel Kids lineup")
    openGuide()
    check(m.guide.channels.Count() = 1 and m.guide.channels[0].id = "channel:kids", "The guide receives only the filtered Kids catalogue")

    resetViewer()
    m.playing = { id: "media:episode", mediaType: "episode", title: "Episode" }
    m.video.visible = true
    enterFullscreen()
    check(m.video.enableUI, "Library fullscreen keeps the native transport UI")
    for each key in ["up", "down", "left", "right", "OK", "play", "rewind", "fastforward", "options"]
        check(not onKeyEvent(key, true), "VOD keeps native control: " + key)
    end for

    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: viewer navigation and audience regression checks"
end sub

sub resetViewer()
    m.focus = { current: "" }
    m.guide = focusNode("guide")
    m.guide.visible = false
    m.guide.CallFunc = sub(name)
        if name = "open" then m.SetFocus(true)
    end sub
    m.guideBackdrop = { visible: false }
    m.liveBanner = { visible: false }
    m.bannerTimer = { control: "stop" }
    m.top = {
        dialog: invalid
        nodes: { hint: {}, bannerChannel: {}, bannerProgramme: {} }
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
    m.tunedChannelId = ""
    m.stopped = false
    m.launchComplete = false
    m.fullStoreEdition = false
    m.preparedProfileMediaType = ""
    m.requestedLaunchProfile = false
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
sub showHome()
    m.home.visible = true
    m.autoTune = false
end sub
sub renderList(preserve as boolean)
end sub
sub requestPlayback(id as string)
    m.requested = id
    m.requestedId = id
    m.tunedChannelId = id
end sub
sub stopPlayback()
    m.stopped = true
    m.playing = invalid
end sub
sub restoreFocus()
    m.restored = m.restoreTarget
    if m.guide.visible
        m.guide.SetFocus(true)
    else if m.fullscreen
        m.video.SetFocus(true)
    else if m.restoreTarget = "player"
        m.playerTarget.SetFocus(true)
    else if m.restoreTarget = "menu"
        m.menu.SetFocus(true)
    end if
end sub
sub refreshCatalog()
    m.catalogRefreshed = true
end sub
sub markLaunchComplete()
    m.launchComplete = true
end sub

sub resetViewing(): end sub
sub prepareLaunchProfile(mediaType): m.preparedProfileMediaType = mediaType: end sub
sub requestLaunchProfile(): m.requestedLaunchProfile = true: end sub
