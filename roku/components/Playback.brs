sub requestPlayback(id as string)
    saveProgress()
    cancelTask("playTask")
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
    if data.ok <> true or data.playback = invalid
        stopPlayback()
        markLaunchComplete()
        showMessage("Couldn't tune in", ["This programme is currently unavailable. Try another channel or Refresh."])
        return
    end if
    item = data.playback
    m.playing = item
    m.lastSavedPosition = -1
    content = CreateObject("roSGNode", "ContentNode")
    content.id = item.id
    content.title = item.title
    content.url = item.url
    content.streamFormat = item.streamFormat
    content.length = Int(item.duration)
    content.contentType = "episode"
    if item.mediaType = "movie" then content.contentType = "movie"
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
    else
        progress = readProgress()
        if progress.DoesExist(item.id)
            saved = progress[item.id]
            if saved >= 10 and saved < item.duration - 15 then start = saved
        end if
    end if
    content.playStart = start
    m.video.enableTrickPlay = item.mediaType <> "live"
    m.video.content = content
    m.video.visible = true
    layoutVideo()
    if m.fullscreen and m.top.dialog = invalid then m.video.SetFocus(true)
    m.video.control = "play"
    m.status.text = "Playing • " + item.title
end sub

sub stopPlayback()
    saveProgress()
    cancelTask("playTask")
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
    state = m.video.state
    if state = "error"
        ' Read diagnostics before stop resets the Video fields. Never expose URLs.
        detail = videoFailureCode(m.video.errorCode, m.video.errorInfo)
        if m.playing.mediaType = "live"
            ' Keep the station clock alive so one bad clip cannot strand the channel.
            m.video.control = "stop"
            m.video.visible = false
            m.fullscreen = false
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
    return CreateObject("roRegistrySection", "ttv-progress-" + audience())
end function

function readProgress() as object
    registry = progressRegistry()
    data = {}
    for each key in registry.GetKeyList()
        data[key] = Val(registry.Read(key))
    end for
    return data
end function

sub saveProgress()
    if m.playing = invalid then return
    if m.playing.mediaType = "live" then return
    if m.video.state <> "playing" and m.video.state <> "paused" then return
    position = Int(m.video.position)
    if position < 0 then return
    registry = progressRegistry()
    registry.Delete(m.playing.id)
    if position >= 10 and position < m.playing.duration - 15
        stamp = CreateObject("roDateTime").AsSeconds()
        registry.Write(m.playing.id, position.ToStr() + ":" + stamp.ToStr())
    end if
    ' Bound both profiles together below Roku's 32 KB app registry quota.
    keys = registry.GetKeyList()
    while keys.Count() > 30
        oldestKey = ""
        oldestTime = CreateObject("roDateTime").AsSeconds() + 1
        for each key in keys
            parts = registry.Read(key).Tokenize(":")
            timestamp = 0
            if parts.Count() = 2 then timestamp = Val(parts[1])
            if timestamp < oldestTime
                oldestKey = key
                oldestTime = timestamp
            end if
        end for
        registry.Delete(oldestKey)
        keys = registry.GetKeyList()
    end while
    registry.Flush()
    m.lastSavedPosition = position
end sub

sub clearProgress(id as string)
    registry = progressRegistry()
    registry.Delete(id)
    registry.Flush()
end sub
