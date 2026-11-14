' Run with brs 0.45.0 and components/Playback.brs. Network, clock and Video are mocked.
sub main()
    _brs_.mockFunction("requestPlayback", sub(id)
        m.requested = id
        m.requestCount++
    end sub)
    _brs_.mockFunction("saveProgress", sub()
        m.saves++
    end sub)
    _brs_.mockFunction("readProgress", function()
        return {}
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

    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: live boundaries, ad errors, stale responses and VOD progress"
end sub

sub resetPlayback()
    m.top = { dialog: invalid }
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
