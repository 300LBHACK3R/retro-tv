' Cloud bookmarks belong to the selected, server-authorised household profile.
' Guest bookmarks stay local. Tokens and profile grants never enter public API calls.
sub resetViewing()
    cancelTask("viewingTask")
    m.viewingBusy = false
    m.viewingReady = false
    m.viewingBlocked = false
    m.viewingQueue = []
    m.cloudProgress = {}
    m.cloudWatchlist = []
    m.cloudFavourites = []
    if m.guide <> invalid then m.guide.favourites = []
    m.profileGrant = ""
    m.libraryFilter = "all"
    m.viewingRequestId = -1
    m.viewingPlaybackId = CreateObject("roDeviceInfo").GetRandomUUID()
    m.viewingSequence = 0
end sub

sub startViewing(grant as string)
    resetViewing()
    m.profileGrant = grant
    viewingRequest({ action: "state" })
end sub

function cloudProfile() as boolean
    return m.accountSession <> invalid and m.activeAccountProfile <> invalid
end function

sub viewingRequest(payload as object)
    if not cloudProfile() or m.profileGrant = "" or m.viewingBusy or m.viewingBlocked then return
    if m.accountSession.expiresAt < CreateObject("roDateTime").AsSeconds() + 60
        refreshAccount()
        return
    end if
    payload.profileId = m.activeAccountProfile.id
    payload.profileGrant = m.profileGrant
    m.sequence++
    m.viewingRequestId = m.sequence
    m.viewingFromQueue = m.viewingQueue.Count() > 0
    m.viewingSent = payload
    m.viewingBusy = true
    task = CreateObject("roSGNode", "AccountTask")
    task.endpoint = "viewing"
    task.payload = payload
    task.accessToken = m.accountSession.accessToken
    task.requestId = m.sequence
    task.ObserveField("response", "onViewingResponse")
    m.viewingTask = task
    task.control = "run"
end sub

sub flushViewing()
    if m.viewingBusy or m.viewingBlocked or not cloudProfile() then return
    if m.viewingQueue.Count() > 0 then viewingRequest(m.viewingQueue[0]) else viewingRequest({ action: "state" })
end sub

sub onViewingResponse(event as object)
    data = event.GetData()
    if data.requestId <> m.viewingRequestId or not cloudProfile() then return
    m.viewingBusy = false
    m.viewingTask.UnobserveField("response")
    m.viewingTask.response = {}
    m.viewingTask = invalid
    sent = m.viewingSent
    if data.ok <> true
        if m.fullStoreEdition = true and m.catalog <> invalid and m.pendingLaunch <> invalid
            if m.pendingLaunch.mediaType <> "livefeed" and m.pendingLaunch.mediaType <> "live"
                m.pendingLaunch = invalid
                markLaunchComplete()
            end if
        end if
        if data.status = 401
            token = m.accountSession.accessToken
            forgetAccount()
            revokeAccountSession(token)
            stopPlayback()
            showMessage("This TV was signed out", ["Sign in again to reconnect your household. Free viewing remains available."])
        else if data.status = 403 or data.status = 409
            m.viewingBlocked = true
            m.viewingQueue = []
            stopPlayback()
            showMessage("Reconnect your profile", [data.error, "Open Profiles and choose your profile again before continuing."])
        else
            m.status.text = "Saved viewing is offline. Reconnecting shortly."
            if sent.action = "state" then m.viewingReady = false
        end if
        return
    end if
    if data.profileGrant <> invalid then m.profileGrant = data.profileGrant
    if data.ownedThemeIds <> invalid
        m.account.ownedThemeIds = data.ownedThemeIds
        m.account.purchasedThemeIds = data.purchasedThemeIds
        m.account.member = data.member
        if not themeAllowed(resolveTheme(m.themeId, m.themeCatalog)) then applyTheme(m.themeCatalog.defaultId)
    end if
    if m.viewingFromQueue and m.viewingQueue.Count() > 0 then m.viewingQueue.Shift()
    if sent.action = "state"
        for each queued in m.viewingQueue
            if queued.action = "progress"
                if data.progress.DoesExist(queued.mediaId) then queued.revision = data.progress[queued.mediaId].revision
                updatedAt = 0
                cached = m.cloudProgress[queued.mediaId]
                if cached <> invalid and cached.updatedAt <> invalid then updatedAt = cached.updatedAt
                data.progress[queued.mediaId] = { position: queued.position, duration: queued.duration, revision: queued.revision, updatedAt: updatedAt }
            end if
        end for
        m.cloudProgress = data.progress
        m.cloudWatchlist = data.watchlist
        m.cloudFavourites = data.favouriteChannels
        if m.guide <> invalid then m.guide.favourites = m.cloudFavourites
        m.viewingReady = true
        m.status.text = "Saved viewing is up to date."
    else
        if sent.action = "progress"
            entry = m.cloudProgress[sent.mediaId]
            if entry <> invalid then entry.revision = data.revision
            ' A queued later position was based on this revision before the reply.
            for each queued in m.viewingQueue
                if queued.action = "progress" and queued.mediaId = sent.mediaId then queued.revision = data.revision
            end for
        else if sent.action = "theme"
            applyTheme(sent.themeId)
            m.registry.Write("theme", m.themeId)
            m.registry.Flush()
        end if
    end if
    if m.view = "library" or m.view = "themes" then renderList(true)
    if m.fullStoreEdition = true and m.pendingLaunch <> invalid and m.catalog <> invalid and m.viewingReady then dispatchLaunch()
    if m.viewingQueue.Count() > 0 then flushViewing()
end sub

sub queueViewing(payload as object)
    if not cloudProfile() or not m.viewingReady or m.viewingBlocked then return
    ' Keep the in-flight first entry, coalesce later positions of the same title.
    nextQueue = []
    for i = 0 to m.viewingQueue.Count() - 1
        queued = m.viewingQueue[i]
        keep = true
        if payload.action = "progress" and queued.action = "progress" and queued.mediaId = payload.mediaId
            if i > 0 or not m.viewingBusy then keep = false
        end if
        if keep then nextQueue.Push(queued)
    end for
    if nextQueue.Count() >= 40
        m.status.text = "Saved viewing is waiting for a connection. Try again shortly."
        return
    end if
    nextQueue.Push(payload)
    m.viewingQueue = nextQueue
    flushViewing()
end sub

sub cloudSaveProgress(id as string, position as float, duration as float)
    if not m.viewingReady or m.viewingBlocked then return
    mediaId = Mid(id, 7)
    if duration <= 0 then return
    if position > duration then position = duration
    revision = 0
    if m.cloudProgress.DoesExist(mediaId) then revision = m.cloudProgress[mediaId].revision
    m.viewingSequence++
    updatedAt = CreateObject("roDateTime").AsSeconds() * 1000#
    m.cloudProgress[mediaId] = { position: position, duration: duration, revision: revision, updatedAt: updatedAt }
    queueViewing({ action: "progress", mediaId: mediaId, position: position, duration: duration, revision: revision, playbackId: m.viewingPlaybackId, sequence: m.viewingSequence })
end sub

function arrayHas(values as object, id as string) as boolean
    for each value in values
        if value = id then return true
    end for
    return false
end function

function groupMatchesSaved(group as object) as boolean
    key = Mid(group.id, 8)
    if m.libraryFilter = "watchlist" then return arrayHas(m.cloudWatchlist, key)
    if m.libraryFilter = "continue"
        for each item in group.items
            entry = m.cloudProgress[Mid(item.id, 7)]
            if entry <> invalid
                if entry.position >= 10 and entry.position < entry.duration - 10 then return true
            end if
        end for
        return false
    end if
    return true
end function

sub showSavedOptions()
    if not cloudProfile()
        showMessage("Your saved viewing", ["Sign in and choose a household profile to sync Continue Watching, your watchlist and favourite channels."])
        return
    end if
    if not m.viewingReady or m.viewingBlocked
        showMessage("Saved viewing is connecting", ["Try again shortly. If it stays unavailable, open Profiles and choose your profile again."])
        flushViewing()
        return
    end if
    buttons = ["Continue Watching", "Watchlist", "Favourite channels", "All library titles"]
    m.savedActions = ["continue", "watchlist", "favourites", "all"]
    m.savedTarget = invalid
    if m.group <> invalid
        m.savedTarget = { kind: "watchlist", id: Mid(m.group.id, 8), saved: not arrayHas(m.cloudWatchlist, Mid(m.group.id, 8)) }
    else if m.view = "library" and m.libraryGrid.itemFocused >= 0 and m.libraryGrid.itemFocused < m.entries.Count()
        group = m.entries[m.libraryGrid.itemFocused]
        m.savedTarget = { kind: "watchlist", id: Mid(group.id, 8), saved: not arrayHas(m.cloudWatchlist, Mid(group.id, 8)) }
    else if m.view = "live" and m.tunedChannelId <> ""
        id = Mid(m.tunedChannelId, 9)
        m.savedTarget = { kind: "favouriteChannels", id: id, saved: not arrayHas(m.cloudFavourites, id) }
    end if
    if m.savedTarget <> invalid
        label = "Remove from watchlist"
        if m.savedTarget.kind = "favouriteChannels" then label = "Remove favourite channel"
        if m.savedTarget.saved
            label = "Add to watchlist"
            if m.savedTarget.kind = "favouriteChannels" then label = "Favourite this channel"
        end if
        buttons.Push(label)
        m.savedActions.Push("toggle")
    end if
    buttons.Push("Back")
    dialog = CreateObject("roSGNode", "StandardMessageDialog")
    dialog.title = "Your saved viewing"
    dialog.message = ["Shared with this profile on your phone, computer and TV. Choose a title, then use * to save it."]
    dialog.buttons = buttons
    dialog.ObserveField("buttonSelected", "onSavedOption")
    presentDialog(dialog)
end sub

sub onSavedOption(event as object)
    index = event.GetData()
    m.top.dialog.close = true
    if index >= m.savedActions.Count() then return
    action = m.savedActions[index]
    if action = "toggle"
        payload = m.savedTarget
        payload.action = "saved"
        queueViewing(payload)
        ' Refresh canonical arrays after this idempotent change is acknowledged.
        m.viewingQueue.Push({ action: "state" })
    else if action = "favourites"
        if m.catalog = invalid
            showMessage("Channels are connecting", ["Your favourites are saved. Try again after the live lineup finishes loading."])
            return
        end if
        dialog = CreateObject("roSGNode", "StandardMessageDialog")
        dialog.title = "Favourite channels"
        dialog.message = ["Choose a channel to watch."]
        buttons = []
        m.favouriteIds = []
        for each channel in m.catalog.channels
            if arrayHas(m.cloudFavourites, Mid(channel.id, 9))
                buttons.Push(channel.title)
                m.favouriteIds.Push(channel.id)
            end if
        end for
        if buttons.Count() = 0 then dialog.message = ["No favourites yet. Tune a channel, press *, and choose Saved viewing to favourite it."]
        buttons.Push("Back")
        dialog.buttons = buttons
        dialog.ObserveField("buttonSelected", "onFavouriteSelected")
        presentDialog(dialog)
    else
        m.libraryFilter = action
        m.view = "library"
        m.group = invalid
        m.search = ""
        renderList(false)
        layoutVideo()
        focusContent()
    end if
end sub

sub onFavouriteSelected(event as object)
    index = event.GetData()
    m.top.dialog.close = true
    if index < m.favouriteIds.Count()
        m.view = "live"
        renderList(false)
        requestPlayback(m.favouriteIds[index])
        enterFullscreen()
    end if
end sub

sub reportVideoFailure()
    if m.storeEdition = true then return
    task = CreateObject("roSGNode", "AccountTask")
    task.endpoint = "diagnostics"
    mediaId = ""
    if not m.kids and m.playing <> invalid
        if Left(m.playing.id, 6) = "media:" then mediaId = Mid(m.playing.id, 7)
    end if
    task.payload = { source: "roku", code: "video_error", mediaId: mediaId }
    m.diagnosticTask = task
    task.control = "run"
end sub
