' Run with brs 0.45.0 and components/Playback.brs. Network, clock and Video are mocked.
sub main()
    _brs_.mockFunction("requestPlayback", sub(id)
        m.requested = id
        m.requestCount++
    end sub)
    _brs_.mockFunction("saveProgress", sub()
        m.saves++
    end sub)
    _brs_.mockFunction("readProgressPosition", function(id)
        return invalid
    end function)

    resetPlayback()
    m.playing = { id: "channel:1", mediaType: "live", start: 0, end: 52 }
    m.video.position = 1280
    onVideoPosition()
    check(m.requestCount = 0, "A preceding programme's late position cannot skip a 52-second ad")
    m.video.position = 53
    onVideoPosition()
    check(m.requestCount = 0, "Only the station clock advances live segments")

    m.segmentSeconds = 52
    m.segmentClock = clockAt(5000)
    onSegmentEnd()
    check(m.requestCount = 0 and m.segmentTimer.duration = 47, "A queued timer from the old clip cannot skip a new ad")
    m.video.state = "finished"
    onVideoState()
    check(m.requestCount = 0, "An early file ending does not repeatedly refetch the same exhausted clip")
    m.segmentClock = clockAt(52000)
    onSegmentEnd()
    check(m.requestCount = 1 and m.requested = "channel:1", "At the scheduled boundary the same station is refreshed")

    resetPlayback()
    m.playing = { id: "channel:7", mediaType: "live", end: 52 }
    m.segmentSeconds = 52
    m.segmentClock = clockAt(1000)
    m.segmentTimer.control = "start"
    m.video.state = "error"
    m.video.errorCode = -5
    m.video.errorInfo = { category: "mediaerror", dbgmsg: "https://private.invalid/source" }
    onVideoState()
    check(m.playing.id = "channel:7" and m.segmentTimer.control = "start", "A decoder error retains the live station and its boundary timer")
    check(not m.video.visible and not m.fullscreen, "A failed clip returns to a usable viewer")
    check(Instr(1, m.playbackError, "mediaerror -5") > 0, "Playback reports the Roku error code")
    check(Instr(1, m.playbackError, "https") = 0 and not m.dialogShown, "Live recovery does not expose source URLs or require dismissing a modal")
    m.segmentClock = clockAt(52000)
    onSegmentEnd()
    check(m.requested = "channel:7", "The next live segment is requested after a commercial failure")
    stopPlayback()
    m.requested = ""
    onSegmentEnd()
    check(m.requested = "" and m.segmentClock = invalid, "Returning Home cancels automatic recovery")

    resetPlayback()
    m.isLoadingPlayback = true
    m.playRequest = 2
    m.requestedId = "channel:1"
    onPlayback(response({ requestId: 1, ok: false }))
    check(m.isLoadingPlayback and not m.dialogShown, "A stale response cannot stop a newer tune")
    onPlayback(response({ requestId: 2, ok: true, playback: { id: "channel:7" } }))
    check(m.isLoadingPlayback, "A response for another station is ignored")
    item = { id: "channel:1", title: "Commercial", url: "https://example.invalid/ad.mp4", streamFormat: "mp4", duration: 52, start: 7, end: 52, mediaType: "live", generatedAt: "2020-01-01T00:00:00Z" }
    onPlayback(response({ requestId: 2, ok: true, playback: item }))
    check(m.video.content.playStart = 7 and m.segmentSeconds = 45, "Commercial tuning preserves the scheduled source offset and remaining time")
    check(m.video.control = "play" and m.video.visible and not m.video.enableTrickPlay, "A scheduled commercial starts automatically without seeking controls")
    check(m.segmentTimer.control = "start", "Live tuning starts the station clock")
    m.video.state = "playing"
    onVideoState()
    check(m.launchComplete, "Successful video starts complete launch reporting")

    resetPlayback()
    m.isLoadingPlayback = true
    m.playRequest = 3
    m.requestedId = "channel:1"
    m.guide.visible = true
    m.video.focusCalls = 0
    m.video.SetFocus = sub(value)
        m.focusCalls++
    end sub
    onPlayback(response({ requestId: 3, ok: true, playback: item }))
    check(m.video.focusCalls = 0 and m.guide.visible, "A completed tune does not steal focus from an open guide")
    check(m.video.control = "play", "Live segments continue playing while the guide is open")

    resetPlayback()
    m.fullStoreEdition = true
    m.isLoadingPlayback = true
    m.playRequest = 4
    m.requestedId = "channel:1"
    onPlayback(response({ requestId: 4, ok: true, playback: item }))
    check(m.playing = invalid and m.dialogShown, "Store playback rejects a backend that has no RAF protocol")

    resetPlayback()
    m.fullStoreEdition = true
    m.isLoadingPlayback = true
    m.playRequest = 5
    m.requestedId = "channel:1"
    item.scheduledAd = true
    item.startGrace = 3
    onPlayback(response({ requestId: 5, ok: true, advertising: "raf", playback: item }))
    check(m.top.nodes.scheduledAdSurface.visible and m.launchComplete, "Store mid-break join displays a usable timed slate")
    check(m.video.content = invalid and m.segmentTimer.duration = 45, "Store never gives a scheduled ad to the programme Video node")
    m.segmentClock = clockAt(45000)
    m.adRendering = true
    onSegmentEnd()
    check(m.requestCount = 0 and m.segmentTimer.duration = 3, "RAF receives a bounded delivery allowance")
    m.segmentClock = clockAt(48000)
    onSegmentEnd()
    check(m.requestCount = 1 and m.requested = "channel:1", "RAF rejoins the station's wall clock within the deadline")

    resetPlayback()
    m.playing = { id: "media:episode", mediaType: "episode" }
    m.lastSavedPosition = 10
    m.video.position = 25
    onVideoPosition()
    check(m.saves = 1, "On-demand position notifications still save viewing progress")
    m.video.state = "error"
    m.video.errorCode = -3
    m.video.errorInfo = invalid
    onVideoState()
    check(m.playing = invalid and m.dialogShown, "On-demand errors stop with a recoverable message")

    _brs_.mockFunction("progressRegistry", function()
        return { values: m.storeBookmarks, Read: function(id)
            if m.values[id] = invalid then return ""
            return m.values[id]
        end function }
    end function)
    _brs_.mockFunction("localBookmarkKey", function(id)
        return "test-hash-" + id
    end function)
    series = { items: [{ id: "media:one" }, { id: "media:two" }, { id: "media:three" }] }
    m.storeBookmarks = {}
    check(storeSeriesEpisode(series).id = "media:one", "A new Store series starts with the first episode")
    m.storeBookmarks["media:one"] = "-1:50"
    m.storeBookmarks["media:two"] = "30:60"
    check(storeSeriesEpisode(series).id = "media:two", "A Store series resumes the most recent unfinished episode")
    m.storeBookmarks["media:two"] = "-1:75"
    check(storeSeriesEpisode(series).id = "media:three", "A Store series advances after a completed episode")

    m.cloudMode = true
    m.cloudProgress = { one: { position: 50, duration: 100, updatedAt: 1760000005000# }, three: { position: 25, duration: 100, updatedAt: 1760000000000# } }
    check(storeSeriesEpisode(series).id = "media:one", "Full Store prioritizes the current profile's most recent cloud bookmark")
    m.cloudProgress.one.position = 100
    check(storeSeriesEpisode(series).id = "media:two", "A completed cloud bookmark advances the current profile to the next episode")
    m.cloudMode = false
    resetPlayback()
    m.isLoadingPlayback = true
    m.playRequest = 4
    m.requestedId = "media:episode"
    bif = "https://example.invalid/episode.bif"
    episode = { id: "media:episode", title: "Episode", url: "https://example.invalid/episode.mp4", streamFormat: "mp4", duration: 1200, start: 0, mediaType: "episode", hdBifUrl: bif }
    onPlayback(response({ requestId: 4, ok: true, playback: episode }))
    check(m.video.content.HDBifUrl = bif and m.video.enableTrickPlay, "VOD forwards published seek thumbnails to Roku's trick-play UI")

    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: live boundaries, ad errors, stale responses, VOD progress and Store smart bookmarks"
end sub

sub resetPlayback()
    m.top = { dialog: invalid, nodes: {
        scheduledAdSurface: { visible: false }, scheduledAdSlate: { visible: false }, scheduledAdCountdown: {},
        scheduledAdTimer: { ObserveField: sub(field, callback)
        end sub },
    }, FindNode: function(id)
        return m.nodes[id]
    end function, SetFocus: sub(value)
    end sub }
    m.guide = { visible: false }
    m.liveBanner = { visible: false }
    m.video = { visible: true, control: "play", position: 0, state: "playing", SetFocus: sub(value)
    end sub }
    m.segmentTimer = { control: "stop", duration: 0 }
    m.segmentClock = invalid
    m.playing = invalid
    m.playbackError = ""
    m.status = {}
    m.playerMessage = {}
    m.fullscreen = true
    m.requested = ""
    m.requestCount = 0
    m.saves = 0
    m.dialogShown = false
    m.launchComplete = false
    m.fullStoreEdition = false
    m.adSlateTimer = invalid
    m.adRendering = false
    if m.failed = invalid then m.failed = 0
end sub
function clockAt(milliseconds as integer) as object
    return { elapsed: milliseconds, TotalMilliseconds: function()
        return m.elapsed
    end function }
end function
function response(data as object) as object
    return { data: data, GetData: function()
        return m.data
    end function }
end function
sub check(condition as boolean, description as string)
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
sub cancelTask(name as string)
end sub
sub layoutVideo()
end sub
sub restoreFocus()
end sub
sub markLaunchComplete()
    m.launchComplete = true
end sub
sub showMessage(title as string, lines as object)
    m.dialogShown = true
end sub

sub hideLiveBanner()
    m.liveBanner.visible = false
end sub
sub updateLiveBanner()
end sub

function cloudProfile() as boolean: return m.cloudMode = true: end function
sub reportVideoFailure(): end sub
