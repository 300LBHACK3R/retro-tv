sub main()
    m.top = { kids: false, signedIn: false, action: "" }
    m.watch = {}
    m.signin = {}
    m.create = {}
    m.selected = 0
    check(onKeyEvent("right", true) and m.signin.selected, "Right highlights Sign in")
    check(onKeyEvent("OK", true) and m.top.action = "signin", "Sign in opens on-device authentication")
    check(onKeyEvent("right", true) and m.create.selected, "Right highlights Create account")
    check(onKeyEvent("OK", true) and m.top.action = "signup", "Create account opens on-device signup")
    onKeyEvent("right", true)
    check(m.selected = 2, "Right cannot move off the home cards")
    m.top.signedIn = true
    check(onKeyEvent("OK", true) and m.top.action = "account", "Signed-in viewers have an account card")
    onKeyEvent("left", true)
    check(onKeyEvent("OK", true) and m.top.action = "profiles", "Signed-in viewers can choose a household profile")
    onKeyEvent("left", true)
    check(onKeyEvent("OK", true) and m.top.action = "watch", "Free viewing remains available")
    m.top.action = ""
    check(not onKeyEvent("OK", false) and m.top.action = "", "Key releases never repeat actions")
    check(not onKeyEvent("back", true), "Back on Home may exit through Roku")
    check(onKeyEvent("play", true), "Home consumes transport keys before they reach the hidden viewer")
    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: guest and signed-in home cards, bounded focus and free viewing"
end sub
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
