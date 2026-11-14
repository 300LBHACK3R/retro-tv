sub openGuide()
    if m.home.visible then return
    hideLiveBanner()
    m.guide.channelId = m.tunedChannelId
    m.guide.channels = []
    if m.catalog <> invalid then m.guide.channels = m.catalog.channels
    m.guide.visible = true
    m.guideBackdrop.visible = true
    layoutVideo()
    m.guide.CallFunc("open")
    refreshCatalog()
end sub

sub dismissGuide()
    m.guide.visible = false
    m.guideBackdrop.visible = false
end sub

sub closeGuide()
    dismissGuide()
    layoutVideo()
    restoreFocus()
end sub

sub onGuideSelected()
    if not m.guide.visible or m.catalog = invalid then return
    ' A catalogue update can remove a channel between selection and this callback.
    for each channel in m.catalog.channels
        if channel.id = m.guide.selectedId
            dismissGuide()
            m.view = "live"
            m.autoTune = false
            m.restoreTarget = "player"
            renderList(false)
            m.fullscreen = true
            if m.playing <> invalid
                if m.playing.id = channel.id and m.video.visible
                    layoutVideo()
                    restoreFocus()
                    showLiveBanner()
                    return
                end if
            end if
            requestPlayback(channel.id)
            restoreFocus()
            showLiveBanner()
            return
        end if
    end for
end sub

function isLivePlayback() as boolean
    if m.playing <> invalid then return m.playing.mediaType = "live"
    if m.isLoadingPlayback then return Left(m.requestedId, 8) = "channel:"
    return false
end function

sub showLiveBanner()
    if not m.fullscreen or m.guide.visible or not isLivePlayback() then return
    updateLiveBanner()
    m.liveBanner.visible = true
    m.bannerTimer.control = "stop"
    m.bannerTimer.control = "start"
end sub

sub updateLiveBanner()
    title = "LIVE TV"
    programme = "Tuning in..."
    if m.catalog <> invalid
        for each channel in m.catalog.channels
            if channel.id = m.tunedChannelId
                title = "CH " + channel.number.ToStr() + " • " + channel.title
                programme = channel.now
            end if
        end for
    end if
    if m.playing <> invalid then programme = m.playing.title
    m.top.FindNode("bannerChannel").text = title
    m.top.FindNode("bannerProgramme").text = programme
end sub

sub hideLiveBanner()
    m.liveBanner.visible = false
    m.bannerTimer.control = "stop"
end sub
