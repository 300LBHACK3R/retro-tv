sub requestPlayback(id as string)
    if Left(id, 6) = "media:" and cloudProfile() and (not m.viewingReady or m.viewingBlocked)
        showMessage("Connecting saved viewing", ["Your resume position is still loading. Try again shortly, or choose your profile again if this message persists."])
        flushViewing()
        return
    end if
    saveProgress()
    cancelTask("playTask")
    stopScheduledAd()
    m.segmentTimer.control = "stop"
    m.segmentClock = invalid
    m.playbackError = ""
    m.playing = invalid
    m.video.control = "stop"
    m.video.visible = false
    m.isLoadingPlayback = true
    m.requestedId = id
    m.status.text = "Tuning in..."
    m.playerMessage.text = "Tuning in..."
    if Left(id, 8) = "channel:"
        m.tunedChannelId = id
        updateNowNext()
    end if
    layoutVideo()
    task = CreateObject("roSGNode", "ApiTask")
    task.path = "play?audience=" + audience() + "&id=" + encoded(id)
    if m.fullStoreEdition = true then task.path = task.path + "&raf=1"
    m.sequence++
    m.playRequest = m.sequence
    task.requestId = m.sequence
    task.ObserveField("response", "onPlayback")
    m.playTask = task
    task.control = "run"
end sub

sub onPlayback(event as object)
    if not m.isLoadingPlayback then return
    data = event.GetData()
    if data.requestId <> m.playRequest then return
    if data.playback <> invalid
        if data.playback.id <> m.requestedId then return
    end if
    m.isLoadingPlayback = false
    if m.fullStoreEdition = true and data.ok = true and data.advertising <> "raf"
        stopPlayback()
        markLaunchComplete()
        showMessage("Playback unavailable", ["The streaming service is updating. Try Refresh shortly."])
        return
    end if
    if data.ok <> true or data.playback = invalid
        stopPlayback()
        markLaunchComplete()
        showMessage("Couldn't tune in", ["This programme is currently unavailable. Try another channel or Refresh."])
        return
    end if
    item = data.playback
    m.playing = item
    m.lastSavedPosition = -1
    start = item.start
    if item.mediaType = "live"
        ' Rejoin the station's clock after network latency, never a saved VOD bookmark.
        generated = CreateObject("roDateTime")
        generated.FromISO8601String(item.generatedAt)
        drift = CreateObject("roDateTime").AsSeconds() - generated.AsSeconds()
        if drift > 0 and drift < 15 then start = start + drift
        if start >= item.end
            requestPlayback(item.id)
            return
        end if
        m.segmentSeconds = item.end - start
        m.segmentClock = CreateObject("roTimespan")
        m.segmentClock.Mark()
        m.segmentTimer.duration = m.segmentSeconds
        m.segmentTimer.control = "start"
    end if
    if m.fullStoreEdition = true and item.scheduledAd = true
        showScheduledAd(item, start)
        return
    end if
    content = CreateObject("roSGNode", "ContentNode")
    content.id = item.id
    content.title = item.title
    content.url = item.url
    content.streamFormat = item.streamFormat
    content.length = Int(item.duration)
    content.contentType = "episode"
    if item.mediaType = "movie" then content.contentType = "movie"
    if item.mediaType <> "live"
        if item.hdBifUrl <> invalid then content.HDBifUrl = item.hdBifUrl
        saved = readProgressPosition(item.id)
        if saved <> invalid and saved >= 10 and saved < item.duration - 15 then start = saved
    end if
    content.playStart = start
    m.video.enableTrickPlay = item.mediaType <> "live"
    m.video.content = content
    m.video.visible = true
    layoutVideo()
    if m.fullscreen and not m.guide.visible and m.top.dialog = invalid then m.video.SetFocus(true)
    if m.liveBanner.visible then updateLiveBanner()
    m.video.control = "play"
    m.status.text = "Playing • " + item.title
end sub

sub stopPlayback()
    hideLiveBanner()
    saveProgress()
    cancelTask("playTask")
    stopScheduledAd()
    m.isLoadingPlayback = false
    m.playing = invalid
    m.segmentClock = invalid
    m.playbackError = ""
    m.segmentTimer.control = "stop"
    m.video.control = "stop"
    m.video.visible = false
    m.fullscreen = false
    m.playerMessage.text = "Choose a channel, or press OK to try live TV again."
    layoutVideo()
    restoreFocus()
end sub

sub onVideoState()
    if m.playing = invalid then return
    if m.playing.scheduledAd = true then return
    state = m.video.state
    if state = "error"
        reportVideoFailure()
        ' Read diagnostics before stop resets the Video fields. Never expose URLs.
        detail = videoFailureCode(m.video.errorCode, m.video.errorInfo)
        if m.playing.mediaType = "live"
            ' Keep the station clock alive so one bad clip cannot strand the channel.
            m.video.control = "stop"
            m.video.visible = false
            m.fullscreen = false
            hideLiveBanner()
            m.playbackError = "Clip unavailable (" + detail + "). Waiting for the next live segment."
            m.playerMessage.text = "This clip could not play. Live TV will retry at the next segment."
            m.status.text = m.playbackError
            layoutVideo()
            if m.top.dialog = invalid then restoreFocus()
        else
            stopPlayback()
            showMessage("Playback interrupted", ["This video could not be played (" + detail + "). Try again or choose another title."])
        end if
        markLaunchComplete()
    else if state = "playing"
        markLaunchComplete()
    else if state = "finished"
        if m.playing.mediaType = "live"
            ' Rounded file durations can end just before the scheduled boundary.
            ' Refetching now would reopen the same exhausted clip in a tight loop.
            onSegmentEnd()
        else
            clearProgress(m.playing.id)
            m.playing = invalid
            stopPlayback()
        end if
    else if state = "paused"
        if m.playing.mediaType = "live" then requestPlayback(m.playing.id) else saveProgress()
    end if
end sub

sub onSegmentEnd()
    if m.playing <> invalid
        if m.playing.mediaType = "live" and m.segmentClock <> invalid
            remaining = m.segmentSeconds - m.segmentClock.TotalMilliseconds() / 1000.0
            ' Allow RAF a short delivery window to finish its own end-of-ad measurement.
            if remaining <= 0 and m.adRendering = true then remaining = remaining + 3
            if remaining > 0
                ' Ignore a queued fire event belonging to the previous clip.
                m.segmentTimer.duration = remaining
                m.segmentTimer.control = "start"
            else
                requestPlayback(m.playing.id)
            end if
        end if
    end if
end sub

sub showScheduledAd(item as object, start as float)
    surface = m.top.FindNode("scheduledAdSurface")
    if surface = invalid then return
    surface.visible = true
    m.top.FindNode("scheduledAdSlate").visible = true
    hideLiveBanner()
    m.status.text = "Commercial break"
    layoutVideo()
    if m.fullscreen and not m.guide.visible and m.top.dialog = invalid then m.top.SetFocus(true)
    if m.adSlateTimer = invalid
        m.adSlateTimer = m.top.FindNode("scheduledAdTimer")
        m.adSlateTimer.ObserveField("fire", "onScheduledAdTick")
    end if
    onScheduledAdTick()
    m.adSlateTimer.control = "start"
    markLaunchComplete()
    ' RAF owns ad playback and focus. Previews preserve the clock with the slate.
    if not m.fullscreen or m.guide.visible then return
    if item.vastUrl = invalid or item.startGrace = invalid or start >= item.startGrace then return
    prefix = "https://www.tatestv.ca/api/roku/ad?"
    if Left(item.vastUrl, Len(prefix)) <> prefix then return
    ' Only the full Store archive includes the RAF-dependent Task component.
    taskComponent = "ScheduledAdTask"
    task = CreateObject("roSGNode", taskComponent)
    if task = invalid then return
    holder = CreateObject("roSGNode", "Rectangle")
    holder.width = 1280
    holder.height = 720
    holder.color = "0x00000000"
    surface.AppendChild(holder)
    task.view = holder
    task.url = item.vastUrl
    task.genre = item.adGenre
    task.kidsContent = item.kidsContent = true
    task.channelId = item.id
    task.startWindow = item.startGrace - start
    task.requestId = m.playRequest
    task.ObserveField("response", "onScheduledAdResponse")
    m.adTask = task
    m.adHolder = holder
    task.control = "run"
end sub

sub onScheduledAdResponse(event as object)
    if m.adTask = invalid then return
    response = event.GetData()
    if response.requestId <> m.playRequest then return
    if response.state = "rendering"
        m.adRendering = true
        m.top.FindNode("scheduledAdSlate").visible = false
        m.adSlateTimer.control = "stop"
        return
    end if
    releaseScheduledAd()
    if response.state = "dismissed"
        stopPlayback()
    else
        if m.fullscreen and not m.guide.visible and m.top.dialog = invalid then m.top.SetFocus(true)
        onSegmentEnd()
    end if
end sub

sub releaseScheduledAd()
    if m.adTask <> invalid
        m.adTask.UnobserveField("response")
        m.adTask.control = "stop"
        m.adTask = invalid
    end if
    if m.adHolder <> invalid
        surface = m.top.FindNode("scheduledAdSurface")
        if surface <> invalid then surface.RemoveChild(m.adHolder)
        m.adHolder = invalid
        m.top.FindNode("scheduledAdSlate").visible = true
        onScheduledAdTick()
        m.adSlateTimer.control = "start"
    end if
    m.adRendering = false
end sub

sub stopScheduledAd()
    releaseScheduledAd()
    if m.adSlateTimer <> invalid then m.adSlateTimer.control = "stop"
    surface = m.top.FindNode("scheduledAdSurface")
    if surface <> invalid then surface.visible = false
end sub

sub onScheduledAdTick()
    if m.segmentClock = invalid then return
    remaining = Int(m.segmentSeconds - m.segmentClock.TotalMilliseconds() / 1000.0 + 0.999)
    if remaining < 0 then remaining = 0
    minutes = Int(remaining / 60)
    seconds = remaining mod 60
    clock = minutes.ToStr() + ":" + Right("0" + seconds.ToStr(), 2)
    m.top.FindNode("scheduledAdCountdown").text = "Next segment in " + clock
end sub

sub onVideoPosition()
    if m.playing = invalid then return
    ' The position notification can still describe the preceding source file.
    ' Live boundaries use the station clock, never an old programme's offset.
    if m.playing.mediaType = "live" then return
    if Abs(m.video.position - m.lastSavedPosition) >= 15
        saveProgress()
    end if
end sub

function videoFailureCode(code as integer, info as dynamic) as string
    category = "video"
    if type(info) = "roAssociativeArray"
        for each allowed in ["http", "drm", "mediaerror", "mediaplayer"]
            if info.category = allowed then category = allowed
        end for
    end if
    return category + " " + code.ToStr()
end function

function progressRegistry() as object
    if m.storeEdition = true then return CreateObject("roRegistrySection", "ttv-store-progress")
    return CreateObject("roRegistrySection", "ttv-progress-" + audience())
end function

function localBookmarkKey(id as string) as string
    ' Compact keys keep the full guest libraries inside Roku's 32 KB registry.
    ' The original media ID is stable across releases and programming changes.
    bytes = CreateObject("roByteArray")
    bytes.FromAsciiString(id)
    digest = CreateObject("roEVPDigest")
    digest.Setup("sha256")
    return Left(digest.Process(bytes), 16)
end function

function parseLocalBookmark(entry as string, compact as boolean) as dynamic
    if entry = "" then return invalid
    separator = Instr(1, entry, ":")
    if compact
        if separator <= 1 then return invalid
        return { position: Val(Left(entry, separator - 1), 36) - 1, stamp: Val(Mid(entry, separator + 1), 36) }
    end if
    if separator <= 1 then return { position: Val(entry, 10), stamp: 0 }
    return { position: Val(Left(entry, separator - 1), 10), stamp: Val(Mid(entry, separator + 1), 10) }
end function

function readLocalBookmark(registry as object, id as string) as dynamic
    bookmark = parseLocalBookmark(registry.Read(localBookmarkKey(id)), true)
    if bookmark <> invalid then return bookmark
    ' Older installations stored the full ID and decimal values in this section.
    return parseLocalBookmark(registry.Read(id), false)
end function

function storeSeriesEpisode(group as object) as dynamic
    if group.items.Count() = 0 then return invalid
    newestIndex = -1
    newestStamp = 0
    completed = false
    scopedToProfile = cloudProfile()
    if not scopedToProfile then registry = progressRegistry()
    for index = 0 to group.items.Count() - 1
        item = group.items[index]
        stamp = 0
        finished = false
        if scopedToProfile
            metadata = m.cloudProgress[Mid(item.id, 7)]
            if metadata <> invalid and metadata.updatedAt <> invalid
                stamp = metadata.updatedAt
                finished = metadata.position >= metadata.duration - 10
            end if
        else
            bookmark = readLocalBookmark(registry, item.id)
            if bookmark <> invalid
                stamp = bookmark.stamp
                finished = bookmark.position = -1
            end if
        end if
        if stamp > 0 and stamp >= newestStamp
            newestIndex = index
            newestStamp = stamp
            completed = finished
        end if
    end for
    if newestIndex < 0 then return group.items[0]
    if completed then newestIndex = (newestIndex + 1) mod group.items.Count()
    return group.items[newestIndex]
end function

function readProgressPosition(id as string) as dynamic
    if cloudProfile()
        entry = m.cloudProgress[Mid(id, 7)]
        if entry <> invalid then return entry.position
        return invalid
    end if
    bookmark = readLocalBookmark(progressRegistry(), id)
    if bookmark <> invalid then return bookmark.position
    return invalid
end function

sub saveProgress()
    if m.playing = invalid then return
    if m.playing.mediaType = "live" then return
    if m.video.state <> "playing" and m.video.state <> "paused" then return
    position = Int(m.video.position)
    if position < 0 then return
    if cloudProfile()
        cloudSaveProgress(m.playing.id, position, m.playing.duration)
        m.lastSavedPosition = position
        return
    end if
    rememberedPosition = invalid
    if position >= 10 and position < m.playing.duration - 15
        rememberedPosition = position
    end if
    if (m.storeEdition <> true and m.fullStoreEdition <> true) or rememberedPosition <> invalid then writeLocalProgress(m.playing.id, rememberedPosition)
    m.lastSavedPosition = position
end sub

sub writeLocalProgress(id as string, position as dynamic)
    registry = progressRegistry()
    key = localBookmarkKey(id)
    if position = invalid
        registry.Delete(key)
        registry.Delete(id)
        registry.Flush()
        return
    end if
    now = CreateObject("roDateTime").AsSeconds()
    ' Offset the completion marker (-1) so both values use an unsigned radix.
    value = StrI(Int(position) + 1, 36) + ":" + StrI(now, 36)
    previous = registry.Read(key)
    growth = Len(value) - Len(previous)
    if previous = "" then growth = growth + Len(key) + 8
    storage = CreateObject("roRegistry")
    ' Keep room for sign-in state, account refresh tokens and app preferences.
    if growth > 0 and storage.GetSpaceAvailable() < growth + 4096
        pruneExpiredLocalBookmarks(now)
        if storage.GetSpaceAvailable() < growth + 4096 then return
    end if
    if not registry.Write(key, value) then return
    ' Remove legacy data only after the replacement is accepted by the registry.
    if registry.Read(id) <> "" then registry.Delete(id)
    registry.Flush()
end sub

sub pruneExpiredLocalBookmarks(now as integer)
    cutoff = now - 30 * 24 * 60 * 60
    for each name in ["ttv-progress-all", "ttv-progress-kids", "ttv-store-progress"]
        registry = CreateObject("roRegistrySection", name)
        changed = false
        for each key in registry.GetKeyList()
            bookmark = parseLocalBookmark(registry.Read(key), Left(key, 6) <> "media:")
            if bookmark <> invalid and bookmark.stamp > 0 and bookmark.stamp < cutoff
                if registry.Delete(key) then changed = true
            end if
        end for
        if changed then registry.Flush()
    end for
end sub

sub clearProgress(id as string)
    if cloudProfile() and m.playing <> invalid
        cloudSaveProgress(id, m.playing.duration, m.playing.duration)
        return
    end if
    if m.storeEdition = true or m.fullStoreEdition = true
        writeLocalProgress(id, -1)
    else
        writeLocalProgress(id, invalid)
    end if
end sub
