sub main()
    _brs_.mockFunction("CreateObject", function(kind, name = invalid)
        if kind = "roDateTime" then return { AsSeconds: function(): return 1000: end function }
        return testNode()
    end function)
    resetAccounts()
    check(not validAccountSession(invalid) and not validAccountSession({ refreshToken: "short" }), "Malformed registry data cannot become an account session")
    session = { accessToken: "access-token-one", refreshToken: "refresh-token-one", expiresAt: 5000 }
    check(validAccountSession(session), "Provider session accepted")
    saveAccountSession(session)
    check(ParseJson(m.registry.saved.accountSession).refreshToken = session.refreshToken, "Rotating credentials are written as one complete registry value")
    m.accountTask = testNode()
    m.accountAction = "refresh"
    m.accountRequestId = 4
    m.accountBusy = true
    m.accountForeground = false
    onAccountResponse(event({ ok: false, status: 503, requestId: 4, error: "Offline" }))
    check(m.accountSession <> invalid, "A temporary outage retains the saved sign-in")
    m.accountTask = testNode()
    m.accountBusy = true
    onAccountResponse(event({ ok: false, status: 401, requestId: 4, error: "Expired" }))
    check(m.accountSession = invalid and m.registry.saved.accountSession = invalid, "Invalid refresh credentials are forgotten")
    check(m.kids, "Expired sign-in does not remove the Kids restriction")

    resetAccounts()
    saveAccountSession(session)
    m.accountTask = testNode()
    m.accountAction = "state"
    m.accountRequestId = 4
    onAccountResponse(event({ ok: false, status: 401, requestId: 4, error: "Expired" }))
    check(m.accountAction = "refresh" and m.accountRefreshRetried, "Rejected access credentials trigger one refresh")
    m.accountAction = "state"
    onAccountResponse(event({ ok: false, status: 401, requestId: m.accountRequestId, error: "Expired" }))
    check(m.accountSession = invalid and not m.accountBusy, "A second unauthorized response ends the retry without a loop")

    resetAccounts()
    saveAccountSession(session)
    m.accountTask = testNode()
    m.accountAction = "refresh"
    m.accountRequestId = 7
    m.accountBusy = true
    m.accountForeground = false
    m.accountCanceled = true
    rotated = { accessToken: "access-token-two", refreshToken: "refresh-token-two", expiresAt: 6000 }
    onAccountResponse(event({ ok: true, session: rotated, requestId: 7 }))
    check(m.accountSession.refreshToken = rotated.refreshToken, "Cancel cannot discard a rotated refresh credential")
    check(not m.accountBusy, "Completed refresh releases the single-flight lock")

    resetAccounts()
    m.accountTask = testNode()
    m.accountAction = "signin"
    m.accountRequestId = 8
    m.accountBusy = true
    m.accountCanceled = true
    onAccountResponse(event({ ok: true, session: session, requestId: 8 }))
    check(m.accountSession = invalid and m.signoutTask.accessToken = session.accessToken, "Canceled sign-in revokes its new session instead of signing the TV in")
    check(m.registry.saved.accountSession = invalid, "Canceled sign-in leaves no credentials in the registry")
    m.accountBusy = true
    onAccountResponse(event({ ok: true, session: session, requestId: 6 }))
    check(m.accountBusy and m.accountSession = invalid, "Stale responses cannot replace the active request")

    resetAccounts()
    saveAccountSession(session)
    m.registry.saved.kidsAccountOwner = "parent-one"
    acceptAccount({ user: { id: "someone-else", email: "other@example.com" }, profiles: [], parentPinRequired: false, member: false })
    check(m.account = invalid and m.kids, "Signing into another household cannot unlock an account's Kids mode")

    resetAccounts()
    m.kids = false
    m.account = { user: { id: "parent-one" }, parentPinRequired: true, profiles: [] }
    activateAccountProfile({ id: "kids", name: "Kids", kids: true })
    check(m.kids and m.registry.saved.kidsAccountOwner = "parent-one", "A shared parent-PIN profile remembers its owner across launch/session expiry")
    activateAccountProfile({ id: "main", name: "Main", kids: false })
    check(not m.kids and m.registry.saved.kidsAccountOwner = invalid, "An authorized adult selection removes the Kids owner lock")
    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: native session rotation, cancellation, outages, stale responses and account-bound Kids locking"
end sub
sub resetAccounts()
    m.top = testNode()
    m.top.dialog = invalid
    m.home = testNode()
    m.registry = { saved: {}, Read: function(key): if m.saved[key] = invalid then return ""
        return m.saved[key]
        end function, Write: sub(key, value): m.saved[key] = value: end sub,
        Delete: sub(key): m.saved.Delete(key): end sub, Flush: sub(): end sub }
    m.kids = true
    m.account = invalid
    m.accountSession = invalid
    m.authStage = ""
    m.accountCanceled = false
    m.accountForeground = false
    m.accountBusy = false
    m.accountRefreshRetried = false
    m.sequence = 0
    m.activeAccountProfile = invalid
    m.afterAccountRefresh = invalid
end sub
function testNode() as object
    return { UnobserveField: sub(field): end sub, ObserveField: sub(field, callback): end sub,
        AddFields: sub(fields): m.Append(fields): end sub, HasField: function(field): return m.DoesExist(field): end function }
end function
function event(data) as object
    return { data: data, GetData: function(): return m.data: end function }
end function
sub buildMenu(): end sub
sub restoreFocus(): end sub
sub showMessage(title, lines): end sub
sub showBrowser(): end sub
sub enterViewer(): end sub
sub applyTheme(id): end sub
sub setKids(enabled): m.kids = enabled: end sub
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
