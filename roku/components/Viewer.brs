sub startApp(args as dynamic)
    if isPlaybackLaunch(args)
        m.top.launch = args
        return
    end if
    showHome()
    markLaunchComplete()
end sub

function isPlaybackLaunch(args as dynamic) as boolean
    if type(args) <> "roAssociativeArray" then return false
    if type(args.contentId) <> "roString" and type(args.contentId) <> "String" then return false
    if type(args.mediaType) <> "roString" and type(args.mediaType) <> "String" then return false
    return Len(args.contentId) > 0 and Len(args.contentId) <= 255 and Len(args.mediaType) > 0
end function

sub onHomeAction()
    if m.home.action = "watch"
        ' Guest entry retains the saved Kids restriction.
        enterViewer()
    else if m.home.action = "parentAccount"
        showMessage("Ask a parent", ["Choose Watch for free to continue the approved Kids lineup.", "To set up an account, a parent must first choose Exit Kids and enter the parent PIN."])
    end if
end sub

' Choosing free viewing opens live TV and starts the current audience's channel.
sub enterViewer()
    m.view = "live"
    m.group = invalid
    m.search = ""
    m.tunedChannelId = ""
    m.autoTune = true
    m.playerMessage.text = "Starting live TV..."
    showBrowser()
    renderList(false)
    layoutVideo()
    focusPlayer()
    startDefaultChannel()
end sub

sub openLive()
    m.view = "live"
    m.autoTune = true
    if m.playing <> invalid
        if m.playing.mediaType = "live"
            m.autoTune = false
        else
            stopPlayback()
        end if
    end if
    renderList(false)
    layoutVideo()
    focusPlayer()
    startDefaultChannel()
end sub

sub startDefaultChannel()
    if not m.autoTune or m.home.visible or m.view <> "live" then return
    if m.catalog = invalid or m.pendingLaunch <> invalid then return
    m.autoTune = false
    if m.catalog.channels.Count() = 0
        m.playerMessage.text = "No live channels are available. Open Library to choose something to watch."
        if m.kids then m.playerMessage.text = "Your Kids live lineup is being prepared. Open Library for approved shows."
        return
    end if
    channel = m.catalog.channels[0]
    for each candidate in m.catalog.channels
        if candidate.number = 1 then channel = candidate
    end for
    requestPlayback(channel.id)
end sub

sub focusPlayer()
    m.restoreTarget = "player"
    m.playerTarget.SetFocus(true)
end sub

sub onPlayerFocus()
    m.playerFocus.visible = m.playerTarget.HasFocus() and not m.fullscreen
end sub

sub onChannelSelected()
    m.restoreTarget = "channels"
    requestPlayback(m.channels.selectedId)
end sub

sub retryLiveChannel()
    if m.catalog = invalid
        m.autoTune = true
        refreshCatalog()
        return
    end if
    for each channel in m.catalog.channels
        if channel.id = m.tunedChannelId
            requestPlayback(channel.id)
            return
        end if
    end for
    m.autoTune = true
    startDefaultChannel()
end sub

sub changeLiveChannel(direction as integer)
    if m.catalog = invalid then return
    count = m.catalog.channels.Count()
    if count = 0 then return
    index = -1
    for i = 0 to count - 1
        if m.catalog.channels[i].id = m.tunedChannelId then index = i
    end for
    if index < 0
        index = 0
    else
        index = (index + direction + count) mod count
    end if
    m.autoTune = false
    requestPlayback(m.catalog.channels[index].id)
end sub

sub updateNowNext()
    m.top.FindNode("channelTitle").text = "LIVE TV"
    m.top.FindNode("nowTitle").text = "Choose a channel below."
    m.top.FindNode("nextTitle").text = "The schedule updates automatically."
    m.channels.channelId = m.tunedChannelId
    if m.catalog = invalid then return
    for each channel in m.catalog.channels
        if channel.id = m.tunedChannelId
            m.top.FindNode("channelTitle").text = "CH " + channel.number.ToStr() + " • " + channel.title
            m.top.FindNode("nowTitle").text = channel.now
            m.top.FindNode("nextTitle").text = channel.next
            return
        end if
    end for
end sub

sub layoutVideo()
    if m.fullscreen
        m.video.translation = [0,0]
        m.video.width = 1280
        m.video.height = 720
        m.video.enableUI = true
        m.playerFocus.visible = false
    else if m.view = "live"
        m.video.translation = [275,185]
        m.video.width = 640
        m.video.height = 360
        m.video.enableUI = false
        onPlayerFocus()
    else
        ' Keep one decoder running while the guide or library is open.
        m.video.translation = [1020,48]
        m.video.width = 176
        m.video.height = 99
        m.video.enableUI = false
        m.playerFocus.visible = false
    end if
    m.profileLabel.visible = not m.video.visible or m.view = "live"
    m.top.FindNode("hint").text = "OK select   •   Back return   •   * viewer options"
    if m.view = "live" then m.top.FindNode("hint").text = "OK fullscreen   •   Down channels   •   Back menu   •   * options"
end sub

sub enterFullscreen()
    if not m.video.visible and not m.isLoadingPlayback then return
    m.fullscreen = true
    layoutVideo()
    m.video.SetFocus(true)
end sub

sub leaveFullscreen()
    m.fullscreen = false
    layoutVideo()
    restoreFocus()
end sub

sub showViewerOptions()
    dialog = CreateObject("roSGNode", "StandardMessageDialog")
    dialog.title = "Your TV. Your way."
    dialog.message = ["Use the player for fullscreen viewing, or keep watching while you browse the guide and library."]
    dialog.buttons = ["Watch fullscreen", "Live guide", "Search library", "Help", "Back"]
    dialog.ObserveField("buttonSelected", "onViewerOption")
    presentDialog(dialog)
end sub

sub onViewerOption(event as object)
    selection = event.GetData()
    m.top.dialog.close = true
    if selection = 0
        enterFullscreen()
    else if selection = 1
        m.autoTune = false
        m.view = "channels"
        renderList(false)
        layoutVideo()
        focusContent()
    else if selection = 2
        showSearch()
    else if selection = 3
        showMessage("Remote controls", ["OK on the player: fullscreen. Back: viewer, menu, then Home. Down from the player: channels; Left/Right: browse; OK: tune; Up: player.", "Library fullscreen: Play/Pause, Rewind, Fast Forward and Replay use Roku's player. Live TV follows the station clock. * in fullscreen opens Roku caption/audio options where available.", "Kids mode needs the parent PIN to exit. Support: tatestv.ca/help"])
    else
        restoreFocus()
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press or m.home.visible then return false
    if m.top.dialog <> invalid then return false
    if key = "channelup" or key = "channeldown"
        direction = 1
        if key = "channeldown" then direction = -1
        changeLiveChannel(direction)
        return true
    end if
    if m.fullscreen
        if key = "back"
            leaveFullscreen()
            return true
        end if
        ' Keep Roku's transport and closed-caption controls on the Video node.
        return false
    end if
    if key = "back"
        if m.view = "episodes" and m.libraryGrid.HasFocus()
            m.view = "library"
            m.group = invalid
            renderList(false)
        else if m.menu.HasFocus()
            showHome()
        else
            m.restoreTarget = "menu"
            m.menu.SetFocus(true)
        end if
        return true
    else if key = "options"
        showViewerOptions()
        return true
    else if key = "play" or key = "playonly"
        if m.view = "live" and not m.video.visible and not m.isLoadingPlayback
            retryLiveChannel()
        else
            enterFullscreen()
        end if
        return true
    end if
    if m.playerTarget.HasFocus()
        if key = "OK"
            if not m.video.visible and not m.isLoadingPlayback
                retryLiveChannel()
            else
                enterFullscreen()
            end if
            return true
        else if key = "down" and m.catalog <> invalid
            if m.catalog.channels.Count() > 0
                m.restoreTarget = "channels"
                m.channels.SetFocus(true)
                return true
            end if
        else if key = "up" or key = "left"
            m.restoreTarget = "menu"
            m.menu.SetFocus(true)
            return true
        end if
    else if m.channels.HasFocus() and key = "up"
        focusPlayer()
        return true
    else if m.menu.HasFocus() and key = "right"
        focusContent()
        return true
    else if (m.list.HasFocus() or m.libraryGrid.HasFocus()) and key = "left"
        m.restoreTarget = "menu"
        m.menu.SetFocus(true)
        return true
    end if
    return false
end function
