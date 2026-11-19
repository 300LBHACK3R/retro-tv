sub main()
    m.top = { kids: false, signedIn: false, action: "", nodes: {},
        FindNode: function(id): if m.nodes[id] = invalid then m.nodes[id] = {}
            return m.nodes[id]
        end function,
        SetFocus: sub(value): end sub }
    m.portraits = { sun: "pkg:/images/profile-sun.png", flower: "pkg:/images/profile-flower.png" }
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
    profiles = [
        { id: "main", name: "Main", kids: false, avatar: "sun" },
        { id: "kids", name: "Kids", kids: true, avatar: "flower" },
        { id: "third", name: "Third", kids: false, avatar: "missing" },
        { id: "fourth", name: "Fourth", kids: false, avatar: "sun" },
        { id: "fifth", name: "Fifth", kids: false, avatar: "sun" }
    ]
    showProfiles(profiles, "kids")
    check(m.selected = 1 and m.signin.selected and m.signin.portrait = m.portraits.flower, "Account picker restores the active portrait and highlight")
    check(m.signin.subtitle = "Kids • Approved shows only" and not m.create.add, "Household cards use audience labels and real portraits")
    check(m.create.portrait = "pkg:/images/profile-sun.png", "Unknown portrait IDs fall back safely")
    check(onKeyEvent("OK", true) and m.top.selectedProfile = "kids", "OK emits the profile ID, never a page index")
    onKeyEvent("right", true)
    onKeyEvent("right", true)
    check(m.watch.title = "Fourth" and m.watch.selected and not m.create.visible, "Fourth profile moves to a centered second page")
    onKeyEvent("right", true)
    onKeyEvent("right", true)
    check(m.selected = 4 and m.signin.selected, "Account focus stops at the last profile")
    onKeyEvent("OK", true)
    check(m.top.selectedProfile = "fifth", "Second-page selection resolves the correct household profile")
    check(onKeyEvent("back", true) and m.top.action = "cancelProfiles", "Back closes the picker instead of exiting Roku")
    reset()
    check(not m.profileMode and m.create.visible and m.create.add and m.signin.title = "Choose profile", "Returning home restores all action cards")
    showProfiles([], "")
    m.top.selectedProfile = ""
    onKeyEvent("OK", true)
    check(m.top.selectedProfile = "" and not m.watch.visible, "An empty household cannot submit a phantom profile")
    m.top.storeEdition = true
    reset()
    check(m.watch.visible and m.watch.selected and m.watch.translation[0] = 510, "Store Home centers the guest card")
    check(not m.signin.visible and not m.create.visible, "Store Home suppresses account entry")
    onKeyEvent("right", true)
    check(onKeyEvent("OK", true) and m.top.action = "watch", "Store guest entry cannot switch to account actions")
    showProfiles(profiles, "kids")
    check(not m.profileMode and not onKeyEvent("back", true), "Store Home bypasses account profiles and leaves Back to Roku")
    if m.failed > 0
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: guest and signed-in home cards, bounded focus and Store guest entry"
end sub
sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
