Library "Roku_Ads.brs"

sub init()
    m.top.functionName = "renderScheduledAd"
end sub

sub renderScheduledAd()
    window = m.top.startWindow
    clock = CreateObject("roTimespan")
    clock.Mark()
    requestId = m.top.requestId
    raf = Roku_Ads()
    raf.setAdPrefs(false, 1)
    raf.setContentId(m.top.channelId)
    raf.setContentGenre(m.top.genre, m.top.kidsContent)
    raf.setAdUrl(m.top.url + "&appId=ROKU_ADS_APP_ID&rida=ROKU_ADS_TRACKING_ID&lat=ROKU_ADS_LIMIT_TRACKING&childDirected=ROKU_ADS_KIDS_CONTENT")
    pods = raf.getAds()
    if pods = invalid or pods.Count() <> 1 or pods[0].backfilled = true or clock.TotalMilliseconds() > window * 1000
        m.top.response = { requestId: requestId, state: "no-fill" }
        return
    end if
    m.top.response = { requestId: requestId, state: "rendering" }
    finished = raf.showAds(pods, invalid, m.top.view)
    state = "dismissed"
    if finished then state = "finished"
    m.top.response = { requestId: requestId, state: state }
end sub
