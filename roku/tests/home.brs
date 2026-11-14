' Run with brs and components/HomeScreen.brs. Card fields are mocked.
sub main()
    m.top = { kids: false, action: "" }
    m.watch = {}
    m.create = {}
    m.account = { visible: false }
    m.chooser = { visible: true }
    m.selected = 0
    check(onKeyEvent("right", true) and m.create.selected, "Right highlights Create account")
    check(onKeyEvent("OK", true) and m.account.visible and not m.chooser.visible, "Create account opens the website signup QR")
    check(onKeyEvent("back", true) and not m.account.visible and m.chooser.visible, "Back from QR restores the cards")
    check(m.selected = 1, "Closing the QR preserves its selected card")
    check(onKeyEvent("left", true) and m.watch.selected, "Left highlights free viewing")
    check(onKeyEvent("OK", true) and m.top.action = "watch", "Free viewing emits the autoplay entry action")
    m.top.action = ""
    check(not onKeyEvent("OK", false) and m.top.action = "", "A key release never repeats entry")
    m.top.kids = true
    onKeyEvent("right", true)
    onKeyEvent("OK", true)
    check(m.top.action = "parentAccount" and not m.account.visible, "Kids cannot open the account QR without leaving Kids mode")
    check(not onKeyEvent("back", true), "Back on Home may exit through Roku")
    check(onKeyEvent("play", true), "Home consumes transport keys before they reach the hidden viewer")
    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: home cards, account QR and Kids restriction"
end sub
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
