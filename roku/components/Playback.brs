sub requestPlayback(id as string)
    saveProgress()
    cancelTask("playTask")
    m.segmentTimer.control = "stop"
    m.playing = invalid
    m.video.control = "stop"
    m.isLoadingPlayback = true
    m.requestedId = id
    m.status.text = "Tuning in..."
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
    m.isLoadingPlayback = false
    if data.ok <> true or data.playback = invalid
        stopPlayback()
        markLaunchComplete()
        showMessage("Couldn't tune in", ["This programme is currently unavailable. Try another channel or Refresh."])
        return
    end if
    item = data.playback
    if item.id <> m.requestedId then return
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
        m.segmentTimer.duration = item.end - start
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
    m.video.SetFocus(true)
    m.video.control = "play"
end sub

sub stopPlayback()
    saveProgress()
    cancelTask("playTask")
    m.isLoadingPlayback = false
    m.playing = invalid
    m.segmentTimer.control = "stop"
    m.video.control = "stop"
    m.video.visible = false
    if m.entries.Count() > 0 then m.list.SetFocus(true) else m.menu.SetFocus(true)
end sub

sub onVideoState()
    if m.playing = invalid then return
    state = m.video.state
    if state = "error"
        stopPlayback()
        markLaunchComplete()
        showMessage("Playback interrupted", ["This video could not be played. Check your connection, then try again."])
    else if state = "playing"
        markLaunchComplete()
    else if state = "finished"
        if m.playing.mediaType = "live"
            requestPlayback(m.playing.id)
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
        if m.playing.mediaType = "live" then requestPlayback(m.playing.id)
    end if
end sub

sub onVideoPosition()
    if m.playing = invalid then return
    if m.playing.mediaType = "live"
        if m.video.position >= m.playing.end then requestPlayback(m.playing.id)
    else if Abs(m.video.position - m.lastSavedPosition) >= 15
        saveProgress()
    end if
end sub

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
