sub init()
    for each id in ["home", "browser", "menu", "list", "libraryGrid", "channels", "playerTarget", "playerFocus", "playerMessage", "liveStage", "guideStage", "emptyMessage", "status", "heading", "profileLabel", "video", "refreshTimer", "segmentTimer"]
        m[id] = m.top.FindNode(id)
    end for
    m.registry = CreateObject("roRegistrySection", "tates-tv-v1")
    m.kids = m.registry.Read("kids") = "true"
    m.catalog = invalid
    m.entries = []
    m.view = "live"
    m.group = invalid
    m.search = ""
    m.pendingLaunch = invalid
    m.playing = invalid
    m.segmentClock = invalid
    m.playbackError = ""
    m.isLoadingPlayback = false
    m.sequence = 0
    m.launchComplete = false
    m.dialogSequence = 0
    m.fullscreen = false
    m.autoTune = false
    m.tunedChannelId = ""
    m.restoreTarget = "menu"
    m.home.ObserveField("action", "onHomeAction")
    m.menu.ObserveField("itemSelected", "onMenuSelected")
    m.list.ObserveField("itemSelected", "onItemSelected")
    m.list.ObserveField("itemFocused", "onGuideFocused")
    m.libraryGrid.ObserveField("itemSelected", "onGridSelected")
    m.channels.ObserveField("selectedId", "onChannelSelected")
    m.playerTarget.ObserveField("focusedChild", "onPlayerFocus")
    m.video.ObserveField("state", "onVideoState")
    m.video.ObserveField("position", "onVideoPosition")
    m.refreshTimer.ObserveField("fire", "onRefresh")
    m.segmentTimer.ObserveField("fire", "onSegmentEnd")
    applyTheme(m.registry.Read("theme"))
    buildMenu()
    m.top.FindNode("buildLabel").text = "v" + CreateObject("roAppInfo").GetVersion()
    m.home.kids = m.kids
    refreshCatalog()
    m.refreshTimer.control = "start"
end sub

sub showHome()
    m.autoTune = false
    m.pendingLaunch = invalid
    stopPlayback()
    m.browser.visible = false
    m.top.FindNode("room").opacity = 0.85
    m.home.kids = m.kids
    m.home.visible = true
    m.home.CallFunc("reset")
end sub

sub showBrowser()
    m.home.visible = false
    m.top.FindNode("room").opacity = 0.4
    m.browser.visible = true
    m.menu.SetFocus(true)
end sub

sub restoreFocus()
    if m.home.visible
        m.home.SetFocus(true)
    else if m.fullscreen
        m.video.SetFocus(true)
    else if m.restoreTarget = "player" and m.view = "live"
        m.playerTarget.SetFocus(true)
    else if m.restoreTarget = "channels" and m.view = "live"
        m.channels.SetFocus(true)
    else if m.restoreTarget = "content"
        focusContent()
    else
        m.menu.SetFocus(true)
    end if
end sub

function audience() as string
    if m.kids then return "kids"
    return "all"
end function

function encoded(value as string) as string
    return value.EncodeUriComponent()
end function

sub cancelTask(name as string)
    if m[name] <> invalid
        m[name].UnobserveField("response")
        m[name].control = "stop"
        m[name] = invalid
    end if
end sub

sub refreshCatalog()
    cancelTask("catalogTask")
    m.status.text = "Updating your TV listings..."
    task = CreateObject("roSGNode", "ApiTask")
    task.path = "catalog?audience=" + audience()
    m.sequence++
    m.catalogRequest = m.sequence
    task.requestId = m.sequence
    task.ObserveField("response", "onCatalog")
    m.catalogTask = task
    task.control = "run"
end sub

sub onCatalog(event as object)
    data = event.GetData()
    if data.requestId <> m.catalogRequest then return
    if data.ok <> true
        m.status.text = data.error
        if m.catalog = invalid then m.playerMessage.text = "Your listings could not load. Press OK to try again, or choose Refresh."
        markLaunchComplete()
        return
    end if
    if data.audience <> audience() then return
    if type(data.channels) <> "roArray" or type(data.library) <> "roArray"
        m.status.text = "Listings could not be read. Choose Refresh to try again."
        if m.catalog = invalid then m.playerMessage.text = "Your listings could not load. Press OK to try again, or choose Refresh."
        markLaunchComplete()
        return
    end if
    m.catalog = data
    if m.view = "episodes" and m.group <> invalid
        previousId = m.group.id
        m.group = invalid
        for each group in data.library
            if group.id = previousId then m.group = group
        end for
        if m.group = invalid then m.view = "library"
    end if
    m.status.text = "Free viewing • Updated from Tate's TV"
    if m.kids then m.status.text = "Kids mode • Only your approved lineup"
    if m.playbackError <> "" then m.status.text = m.playbackError
    renderList(true)
    updateNowNext()
    if m.pendingLaunch <> invalid
        dispatchLaunch()
    else
        startDefaultChannel()
    end if
    if not m.isLoadingPlayback then markLaunchComplete()
end sub

sub markLaunchComplete()
    if m.launchComplete then return
    m.top.SignalBeacon("AppLaunchComplete")
    m.launchComplete = true
end sub

sub buildMenu()
    content = CreateObject("roSGNode", "ContentNode")
    labels = ["Live TV", "Live guide", "Library", "Search", "Kids mode", "Themes", "Refresh", "Home"]
    if m.kids then labels[4] = "Exit Kids"
    for each label in labels
        node = content.CreateChild("ContentNode")
        node.title = label
    end for
    m.menu.content = content
    m.profileLabel.text = "FREE VIEWING"
    if m.kids then m.profileLabel.text = "KIDS • PIN LOCKED"
end sub

sub onMenuSelected()
    index = m.menu.itemSelected
    m.autoTune = false
    if index = 0
        openLive()
        return
    else if index = 1
        m.view = "channels"
    else if index = 2
        m.view = "library"
        m.group = invalid
        m.search = ""
    else if index = 3
        showSearch()
        return
    else if index = 4
        changeProfile()
        return
    else if index = 5
        m.view = "themes"
    else if index = 6
        refreshCatalog()
        return
    else if index = 7
        showHome()
        return
    end if
    renderList(false)
    layoutVideo()
    focusContent()
end sub

sub renderList(preserve as boolean)
    selectedId = ""
    focused = m.libraryGrid.itemFocused
    if m.view = "channels" then focused = m.list.itemFocused
    if preserve and focused >= 0 and focused < m.entries.Count() then selectedId = m.entries[focused].id
    m.liveStage.visible = m.view = "live"
    m.guideStage.visible = m.view = "channels"
    m.libraryGrid.visible = m.view = "library" or m.view = "episodes" or m.view = "themes"
    m.emptyMessage.visible = false
    m.entries = []
    m.heading.text = "Good TV. Your way."
    if m.view = "live"
        m.heading.text = "Your TV. Your way."
        lineup = []
        if m.catalog <> invalid then lineup = m.catalog.channels
        m.channels.channels = lineup
        updateNowNext()
        return
    else if m.view = "themes"
        m.heading.text = "Make yourself at home."
        m.entries = [{ id: "christmas", title: "Christmas '96", poster: "pkg:/images/room.jpg" }, { id: "retro", title: "Classic Blue", poster: "pkg:/images/logo.png" }]
    else if m.catalog <> invalid
        if m.view = "channels"
            m.heading.text = "Live guide • On now. Up next."
            m.entries = m.catalog.channels
        else if m.view = "episodes" and m.group <> invalid
            m.heading.text = m.group.title
            m.entries = m.group.items
        else
            m.heading.text = "Your library. Your evening."
            if m.search <> "" then m.heading.text = "Search: " + m.search
            for each group in m.catalog.library
                if m.search = "" or Instr(1, LCase(group.title), LCase(m.search)) > 0 then m.entries.Push(group)
            end for
        end if
    end if
    content = CreateObject("roSGNode", "ContentNode")
    selected = 0
    for index = 0 to m.entries.Count() - 1
        entry = m.entries[index]
        node = content.CreateChild("ContentNode")
        node.AddField("viewerAccent", "color", false)
        node.viewerAccent = m.viewerAccent
        node.title = entry.title
        node.HDPosterUrl = "pkg:/images/logo.png"
        if entry.poster <> invalid then node.HDPosterUrl = entry.poster
        if m.view = "channels"
            node.title = "CH " + entry.number.ToStr() + "  " + entry.title
            node.shortDescriptionLine1 = entry.now
            node.shortDescriptionLine2 = entry.next
        end if
        if entry.id = selectedId then selected = index
    end for
    target = m.libraryGrid
    if m.view = "channels" then target = m.list
    target.content = content
    if m.entries.Count() > 0
        target.jumpToItem = selected
    else
        m.emptyMessage.text = "Nothing available here yet. Choose Refresh to check again."
        if m.search <> "" then m.emptyMessage.text = "No titles match that search. Open Search to try another title."
        m.emptyMessage.visible = true
    end if
end sub

sub focusContent()
    m.restoreTarget = "content"
    if m.view = "live"
        focusPlayer()
    else if m.entries.Count() = 0
        m.menu.SetFocus(true)
    else if m.view = "channels"
        m.list.SetFocus(true)
    else
        m.libraryGrid.SetFocus(true)
    end if
end sub

sub onGuideFocused()
    index = m.list.itemFocused
    if index < 0 or index >= m.entries.Count() then return
    if m.view <> "channels" then return
    m.status.text = "CH " + m.entries[index].number.ToStr() + " • " + m.entries[index].now
end sub

sub onItemSelected()
    index = m.list.itemSelected
    if m.view <> "channels" or index < 0 or index >= m.entries.Count() then return
    id = m.entries[index].id
    m.restoreTarget = "content"
    requestPlayback(id)
end sub

sub onGridSelected()
    index = m.libraryGrid.itemSelected
    if index < 0 or index >= m.entries.Count() then return
    entry = m.entries[index]
    if m.view = "themes"
        applyTheme(entry.id)
        m.registry.Write("theme", entry.id)
        m.registry.Flush()
        renderList(true)
    else if m.view = "library"
        m.group = entry
        m.view = "episodes"
        renderList(false)
    else if m.view = "episodes"
        m.restoreTarget = "content"
        m.fullscreen = true
        requestPlayback(entry.id)
    end if
end sub

sub applyTheme(theme as string)
    m.top.FindNode("room").visible = theme <> "retro"
    if theme = "retro"
        background = "0x071C36FF"
        menu = "0x123663FF"
        accent = "0x80E5FFFF"
    else
        background = "0x10271FFF"
        menu = "0x193B2FFF"
        accent = "0xE7C584FF"
    end if
    m.top.FindNode("background").color = background
    m.top.FindNode("menuPanel").color = menu
    m.top.FindNode("accent").color = accent
    m.menu.focusBitmapBlendColor = accent
    m.list.focusBitmapBlendColor = accent
    m.top.FindNode("hint").color = accent
    m.home.accent = accent
    m.channels.accent = accent
    m.libraryGrid.focusBitmapBlendColor = accent
    m.playerFocus.color = accent
    m.viewerAccent = accent
    palette = CreateObject("roSGNode", "RSGPalette")
    palette.colors = {
        DialogBackgroundColor: background
        DialogTextColor: "0xFFF3D8FF"
        DialogFocusColor: accent
        DialogFocusItemColor: "0x102035FF"
        DialogItemColor: accent
        DialogSecondaryTextColor: "0xD5DDDBFF"
        DialogSecondaryItemColor: accent
        DialogInputFieldColor: menu
        DialogKeyboardColor: menu
        DialogFootprintColor: menu
    }
    m.top.palette = palette
end sub

sub showSearch()
    m.restoreTarget = "menu"
    dialog = CreateObject("roSGNode", "StandardKeyboardDialog")
    dialog.title = "Find your next favourite"
    dialog.buttons = ["Search", "Cancel"]
    dialog.ObserveField("buttonSelected", "onSearch")
    presentDialog(dialog)
end sub

sub onSearch(event as object)
    dialog = m.top.dialog
    if event.GetData() = 0
        m.search = Left(dialog.text, 100)
        m.view = "library"
        m.group = invalid
        m.autoTune = false
        renderList(false)
        layoutVideo()
        m.restoreTarget = "content"
    end if
    dialog.close = true
    restoreFocus()
end sub

sub showMessage(title as string, lines as object)
    dialog = CreateObject("roSGNode", "StandardMessageDialog")
    dialog.title = title
    dialog.message = lines
    dialog.buttons = ["OK"]
    dialog.ObserveField("buttonSelected", "closeMessage")
    presentDialog(dialog)
end sub

sub presentDialog(dialog as object)
    m.dialogSequence++
    dialog.id = "dialog-" + m.dialogSequence.ToStr()
    dialog.ObserveField("wasClosed", "onDialogClosed")
    m.top.dialog = dialog
end sub

sub onDialogClosed(event as object)
    dialog = m.top.dialog
    if dialog <> invalid
        if dialog.id <> event.GetNode() then return
    end if
    m.top.dialog = invalid
    m.newPinHash = invalid
    restoreFocus()
end sub

sub closeMessage()
    m.top.dialog.close = true
    restoreFocus()
end sub

sub onRefresh()
    if not m.isLoadingPlayback and m.top.dialog = invalid then refreshCatalog()
end sub

sub onLaunch()
    args = m.top.launch
    if not isPlaybackLaunch(args) then return
    if m.top.dialog <> invalid then m.top.dialog.close = true
    m.autoTune = false
    showBrowser()
    m.restoreTarget = "player"
    m.pendingLaunch = { id: args.contentId, mediaType: LCase(args.mediaType) }
    if m.catalog <> invalid then dispatchLaunch()
end sub

sub dispatchLaunch()
    link = m.pendingLaunch
    m.pendingLaunch = invalid
    if link.mediaType = "live"
        for each channel in m.catalog.channels
            if channel.id = link.id
                m.view = "live"
                renderList(false)
                m.fullscreen = true
                requestPlayback(channel.id)
                return
            end if
        end for
    else
        for each group in m.catalog.library
            if link.mediaType = "series" and group.id = link.id
                stopPlayback()
                m.view = "episodes"
                m.group = group
                renderList(false)
                layoutVideo()
                m.restoreTarget = "content"
                m.libraryGrid.SetFocus(true)
                return
            end if
            for each item in group.items
                if item.id = link.id
                    if link.mediaType = "series"
                        stopPlayback()
                        m.view = "episodes"
                        m.group = group
                        renderList(false)
                        layoutVideo()
                        m.restoreTarget = "content"
                        m.libraryGrid.SetFocus(true)
                    else if link.mediaType = item.mediaType or link.mediaType = "short-form"
                        m.view = "episodes"
                        m.group = group
                        renderList(false)
                        m.restoreTarget = "content"
                        m.fullscreen = true
                        requestPlayback(item.id)
                    end if
                    return
                end if
            end for
        end for
    end if
    showMessage("Programme unavailable", ["This programme is not available in the current profile."])
end sub
