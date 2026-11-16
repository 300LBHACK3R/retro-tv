sub main()
    _brs_.mockFunction("CreateObject", function(kind, name = invalid)
        if kind = "roDateTime" then return { AsSeconds: function(): return 1000: end function }
        if kind = "roDeviceInfo" then return { GetRandomUUID: function(): return "33333333-3333-4333-8333-333333333333": end function }
        return { ObserveField: sub(a,b): end sub, UnobserveField: sub(a): end sub }
    end function)
    m.sequence = 0
    m.view = "live"
    m.kids = true
    m.status = {}
    m.account = { ownedThemeIds: [] }
    m.accountSession = { accessToken: "private-token", expiresAt: 9000 }
    m.activeAccountProfile = { id: "kids" }
    resetViewing()
    startViewing("pin-checked-grant")
    check(m.viewingBusy and m.viewingSent.profileId = "kids", "Initial read binds the selected profile")
    check(m.viewingTask.endpoint = "viewing" and m.viewingTask.accessToken = "private-token", "Cloud requests use the authenticated private endpoint")
    onViewingResponse(reply({ ok: true, requestId: m.viewingRequestId, progress: { episode: { position: 120, duration: 600, revision: 2 } }, watchlist: ["show"], favouriteChannels: ["1"], profileGrant: "renewed" }))
    check(m.viewingReady and not m.viewingBusy and m.profileGrant = "renewed", "Cloud read restores progress and renews the profile grant")
    cloudSaveProgress("media:episode", 135, 600)
    requestId = m.viewingRequestId
    cloudSaveProgress("media:episode", 150, 600)
    cloudSaveProgress("media:episode", 165, 600)
    check(m.viewingQueue.Count() = 2 and m.viewingQueue[1].position = 165, "Slow writes retain the in-flight position and coalesce later positions")
    onViewingResponse(reply({ ok: true, requestId: requestId - 1, revision: 99 }))
    check(m.viewingBusy and m.cloudProgress.episode.revision = 2, "A stale response cannot change another request")
    onViewingResponse(reply({ ok: true, requestId: requestId, revision: 3 }))
    check(m.viewingSent.position = 165 and m.viewingSent.revision = 3, "The next position uses the acknowledged revision")
    onViewingResponse(reply({ ok: true, requestId: m.viewingRequestId, revision: 4 }))
    check(m.viewingQueue.Count() = 0 and not m.viewingBusy, "Successful writes drain the queue")
    queueViewing({ action: "saved", kind: "watchlist", id: "show", saved: false })
    m.viewingQueue.Push({ action: "state" })
    onViewingResponse(reply({ ok: true, requestId: m.viewingRequestId, revision: 9 }))
    check(m.viewingSent.action = "state", "Saved-list changes refresh canonical state")
    onViewingResponse(reply({ ok: true, requestId: m.viewingRequestId, progress: {}, watchlist: [], favouriteChannels: [] }))
    check(m.viewingQueue.Count() = 0 and not m.viewingBusy, "A queued state read terminates instead of looping")
    cloudSaveProgress("media:episode", 50, 600)
    onViewingResponse(reply({ ok: false, requestId: m.viewingRequestId, status: 409, error: "Newer progress" }))
    check(m.viewingBlocked and m.viewingQueue.Count() = 0, "A conflict never silently overwrites another screen")
    resetViewing()
    check(not m.viewingReady and m.cloudWatchlist.Count() = 0 and m.cloudProgress.Count() = 0 and m.profileGrant = "", "Switching profiles clears private cached viewing and PIN grants")
    startViewing("new-grant")
    onViewingResponse(reply({ ok: false, requestId: m.viewingRequestId, status: 401, error: "Signed out" }))
    check(m.accountSession = invalid and m.kids, "A removed TV loses account access without escaping Kids mode")
    if m.failed > 0 then stop
    print "PASS: profile isolation, resume, coalesced writes, ordered revisions, list refresh, conflicts and remote sign-out"
end sub
function reply(data) as object: return { data: data, GetData: function(): return m.data: end function }: end function
sub cancelTask(name): end sub
sub refreshAccount(): end sub
sub applyTheme(id): end sub
sub renderList(preserve): end sub
sub stopPlayback(): end sub
sub showMessage(title, lines): end sub
sub revokeAccountSession(token): end sub
sub forgetAccount(): resetViewing(): m.accountSession = invalid: end sub
function resolveTheme(id, catalog) as object: return {}: end function
function themeAllowed(theme) as boolean: return true: end function
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
