sub init()
    for each id in ["home", "browser", "menu", "libraryGrid", "channels", "playerTarget", "playerFocus", "playerMessage", "liveStage", "guide", "guideBackdrop", "liveBanner", "bannerTimer", "emptyMessage", "status", "heading", "profileLabel", "video", "refreshTimer", "segmentTimer"]
        m[id] = m.top.FindNode(id)
    end for
    appInfo = CreateObject("roAppInfo")
    m.storeEdition = appInfo.GetValue("ttv_store_edition") = "1"
    registryName = "tates-tv-v1"
    if m.storeEdition then registryName = "tates-tv-store-v1"
    m.registry = CreateObject("roRegistrySection", registryName)
    m.kids = not m.storeEdition and m.registry.Read("kids") = "true"
    m.home.storeEdition = m.storeEdition
    m.guide.storeEdition = m.storeEdition
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
    m.home.ObserveField("selectedProfile", "onAccountProfileSelected")
    m.menu.ObserveField("itemSelected", "onMenuSelected")
    m.guide.ObserveField("selectedId", "onGuideSelected")
    m.guide.ObserveField("action", "onGuideAction")
    m.guide.ObserveField("closeRequested", "closeGuide")
    m.bannerTimer.ObserveField("fire", "hideLiveBanner")
    m.libraryGrid.ObserveField("itemSelected", "onGridSelected")
    m.channels.ObserveField("selectedId", "onChannelSelected")
    m.playerTarget.ObserveField("focusedChild", "onPlayerFocus")
    m.video.ObserveField("state", "onVideoState")
    m.video.ObserveField("position", "onVideoPosition")
    m.refreshTimer.ObserveField("fire", "onRefresh")
    m.segmentTimer.ObserveField("fire", "onSegmentEnd")
    resetViewing()
    applyTheme(m.registry.Read("theme"))
    buildMenu()
    m.top.FindNode("buildLabel").text = "v" + appInfo.GetVersion()
    m.home.kids = m.kids
    refreshCatalog()
    m.refreshTimer.control = "start"
    if not m.storeEdition then initAccounts()
end sub

sub showHome()
    m.profilePickerOpen = false
    dismissGuide()
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
    m.profilePickerOpen = false
    m.home.visible = false
    m.top.FindNode("room").opacity = m.themeBackgroundOpacity
    m.browser.visible = true
    m.menu.SetFocus(true)
end sub

sub restoreFocus()
    if m.home.visible
        if m.profilePickerOpen = true and not m.accountBusy and m.authStage = "" then m.authStage = "profiles"
        m.home.SetFocus(true)
    else if m.guide.visible
        m.guide.SetFocus(true)
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
    m.guide.channels = data.channels
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
    entries = [{ id: "live", label: "Live TV" }, { id: "guide", label: "Live guide" }, { id: "library", label: "Library" }, { id: "search", label: "Search" }]
    if m.storeEdition <> true
        profileLabel = "Kids mode"
        if m.kids = true then profileLabel = "Exit Kids"
        if m.account <> invalid then profileLabel = "Profiles"
        entries.Push({ id: "profile", label: profileLabel })
    end if
    entries.Append([{ id: "themes", label: "Themes" }, { id: "refresh", label: "Refresh" }, { id: "home", label: "Home" }])
    m.menuActions = []
    for each entry in entries
        node = content.CreateChild("ContentNode")
        node.title = entry.label
        m.menuActions.Push(entry.id)
    end for
    m.menu.content = content
    m.profileLabel.text = "FREE VIEWING"
    if m.account <> invalid
        m.profileLabel.text = "SIGNED IN"
        if m.account.member then m.profileLabel.text = "MEMBERSHIP ACTIVE"
    end if
    if m.activeAccountProfile <> invalid then m.profileLabel.text = m.activeAccountProfile.name
    if m.kids then m.profileLabel.text = "KIDS • PIN LOCKED"
end sub

sub onMenuSelected()
    index = m.menu.itemSelected
    if index < 0 or index >= m.menuActions.Count() then return
    action = m.menuActions[index]
    m.autoTune = false
    if action = "live"
        openLive()
        return
    else if action = "guide"
        m.restoreTarget = "menu"
        openGuide()
        return
    else if action = "library"
        m.libraryFilter = "all"
        m.view = "library"
        m.group = invalid
        m.search = ""
    else if action = "search"
        showSearch()
        return
    else if action = "profile"
        changeProfile()
        return
    else if action = "themes"
        m.view = "themes"
    else if action = "refresh"
        refreshCatalog()
        return
    else if action = "home"
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
    if preserve and focused >= 0 and focused < m.entries.Count() then selectedId = m.entries[focused].id
    m.liveStage.visible = m.view = "live"
    m.libraryGrid.visible = m.view = "library" or m.view = "episodes" or m.view = "themes"
    portrait = m.view = "library" or m.view = "episodes"
    m.top.FindNode("listPanel").opacity = 1
    m.libraryGrid.itemSize = [214,200]
    m.libraryGrid.numColumns = 4
    m.libraryGrid.numRows = 2
    if portrait
        m.top.FindNode("listPanel").opacity = 0
        m.libraryGrid.itemSize = [174,344]
        m.libraryGrid.numColumns = 5
        m.libraryGrid.numRows = 1
    end if
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
        for each theme in m.themeCatalog.themes
            if m.storeEdition <> true or theme.isPremium <> true then m.entries.Push(theme)
        end for
        m.heading.text = "Your style. " + m.entries.Count().ToStr() + " themes."
        if selectedId = "" then selectedId = m.themeId
    else if m.catalog <> invalid
        if m.view = "episodes" and m.group <> invalid
            m.heading.text = m.group.title
            m.entries = m.group.items
        else
            m.heading.text = "Your library. Your evening."
            if m.libraryFilter = "continue" then m.heading.text = "Continue Watching"
            if m.libraryFilter = "watchlist" then m.heading.text = "Your watchlist"
            if m.search <> "" then m.heading.text = "Search: " + m.search
            for each group in m.catalog.library
                if (m.search = "" or Instr(1, LCase(group.title), LCase(m.search)) > 0) and groupMatchesSaved(group) then m.entries.Push(group)
            end for
        end if
    end if
    content = CreateObject("roSGNode", "ContentNode")
    selected = 0
    for index = 0 to m.entries.Count() - 1
        entry = m.entries[index]
        node = content.CreateChild("ContentNode")
        node.AddField("viewerColors", "assocarray", false)
        node.viewerColors = m.top.themeColors
        node.AddField("portraitCard", "boolean", false)
        node.portraitCard = portrait
        node.AddField("themeBadge", "string", false)
        if m.view = "themes"
            node.viewerColors = entry.colors
            node.themeBadge = "Free"
            if entry.isPremium
                node.themeBadge = "Locked"
                if entry.priceLabel <> invalid then node.themeBadge = entry.priceLabel + " • Locked"
                if themeAllowed(entry)
                    node.themeBadge = "Included with account"
                    if m.account.member then node.themeBadge = "Included with membership"
                    if m.account.purchasedThemeIds <> invalid
                        if arrayHas(m.account.purchasedThemeIds, entry.id) then node.themeBadge = "Owned"
                    end if
                end if
            end if
            if entry.id = m.themeId then node.themeBadge = "Selected"
        end if
        if m.view = "episodes" and cloudProfile()
            saved = m.cloudProgress[Mid(entry.id, 7)]
            if saved <> invalid
                if saved.position >= saved.duration - 10
                    node.themeBadge = "Watched"
                else if saved.position >= 10
                    node.themeBadge = "Resume at " + Int(saved.position / 60).ToStr() + " min"
                end if
            end if
        end if
        node.title = entry.title
        node.HDPosterUrl = "pkg:/images/logo.png"
        if entry.poster <> invalid then node.HDPosterUrl = entry.poster
        if entry.id = selectedId then selected = index
    end for
    target = m.libraryGrid
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
    else
        m.libraryGrid.SetFocus(true)
    end if
end sub

sub onGridSelected()
    index = m.libraryGrid.itemSelected
    if index < 0 or index >= m.entries.Count() then return
    entry = m.entries[index]
    if m.view = "themes"
        if not themeAllowed(entry)
            if m.storeEdition = true then return
            showMessage("Make it yours", ["Visit tatestv.ca/account to purchase this theme, then sign in or Refresh on your TV. Memberships include premium themes. Your free themes are always available."])
            return
        end if
        if cloudProfile()
            queueViewing({ action: "theme", themeId: entry.id })
            return
        end if
        applyTheme(entry.id)
        m.registry.Write("theme", m.themeId)
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
        m.libraryFilter = "all"
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
    if dialog <> invalid
        if dialog.HasField("accountDialog") then cancelAccountFlow()
    end if
    m.top.dialog = invalid
    m.newPinHash = invalid
    m.pendingAccountProfile = invalid
    restoreFocus()
end sub

sub closeMessage()
    m.top.dialog.close = true
    restoreFocus()
end sub

sub onRefresh()
    if m.storeEdition <> true
        refreshAccount()
        flushViewing()
    end if
    if not m.isLoadingPlayback and m.top.dialog = invalid then refreshCatalog()
end sub

sub onLaunch()
    args = m.top.launch
    if not isPlaybackLaunch(args) then return
    if m.top.dialog <> invalid then m.top.dialog.close = true
    dismissGuide()
    m.autoTune = false
    showBrowser()
    m.restoreTarget = "player"
    m.pendingLaunch = { id: args.contentId, mediaType: LCase(args.mediaType) }
    if m.catalog <> invalid then dispatchLaunch()
end sub

sub dispatchLaunch()
    link = m.pendingLaunch
    m.pendingLaunch = invalid
    if m.storeEdition = true
        if not dispatchStoreLaunch(link) then showHome()
        return
    end if
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
                        startLinkedVod(group, item)
                    end if
                    return
                end if
            end for
        end for
    end if
    showMessage("Programme unavailable", ["This programme is not available in the current profile."])
end sub

function dispatchStoreLaunch(link as object) as boolean
    if link.mediaType = "livefeed" or link.mediaType = "live"
        for each channel in m.catalog.channels
            if channel.id = link.id
                m.view = "live"
                renderList(false)
                m.fullscreen = true
                requestPlayback(channel.id)
                return true
            end if
        end for
        return false
    end if

    for each group in m.catalog.library
        if link.mediaType = "series" and group.id = link.id
            item = storeSeriesEpisode(group)
            if item = invalid then return false
            startLinkedVod(group, item)
            return true
        end if
        for each item in group.items
            if item.id = link.id
                if link.mediaType = "series" and group.type = "show"
                    episode = storeSeriesEpisode(group)
                    if episode = invalid then return false
                    startLinkedVod(group, episode)
                    return true
                end if
                matches = link.mediaType = item.mediaType
                if link.mediaType = "shortformvideo" or link.mediaType = "short-form"
                    matches = item.duration <= 900
                else if link.mediaType = "tvspecial"
                    matches = group.type = "movie"
                end if
                if not matches then return false
                startLinkedVod(group, item)
                return true
            end if
        end for
    end for
    return false
end function

sub startLinkedVod(group as object, item as object)
    m.view = "episodes"
    m.group = group
    renderList(false)
    m.restoreTarget = "content"
    m.fullscreen = true
    requestPlayback(item.id)
end sub
