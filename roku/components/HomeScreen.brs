sub init()
    m.watch = m.top.FindNode("watch")
    m.signin = m.top.FindNode("signin")
    m.create = m.top.FindNode("create")
    m.top.FindNode("homeBuildLabel").text = "v" + CreateObject("roAppInfo").GetVersion()
    m.selected = 0
    updateProfile()
    updateSelection()
end sub

sub reset()
    m.selected = 0
    updateSelection()
    m.top.SetFocus(true)
end sub

sub updateProfile()
    if m.watch = invalid then return
    m.watch.title = "Watch for free"
    m.watch.subtitle = "Jump into the full lineup"
    if m.top.kids then m.watch.subtitle = "Kids • Approved shows only"
    m.signin.title = "Sign in"
    m.signin.subtitle = "Your existing Tate's TV account"
    m.create.title = "Create account"
    m.create.subtitle = "Sign up here with your remote"
    subtitle = "Settle into something good. No account needed to watch."
    if m.top.signedIn
        m.signin.title = "Choose profile"
        m.signin.subtitle = "Your Tate's TV household"
        m.create.title = "Account"
        m.create.subtitle = "Membership and sign out"
        subtitle = "One Tate's TV account. At home on every screen."
    end if
    m.top.FindNode("homeSubtitle").text = subtitle
end sub

sub updateColors()
    paintTheme({ homeTitle: "text", homeSubtitle: "textMuted", homeHelp: "primary", homeBuildLabel: "textMuted", accountStatusLabel: "textMuted" })
    m.top.FindNode("overlay").color = Left(themeColor("appBg", "0x090F18FF"), 8) + "66"
    for each card in [m.watch, m.signin, m.create]
        card.themeColors = m.top.themeColors
    end for
end sub

sub updateSelection()
    m.watch.selected = m.selected = 0
    m.signin.selected = m.selected = 1
    m.create.selected = m.selected = 2
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "left" or key = "right"
        if key = "left" and m.selected > 0 then m.selected--
        if key = "right" and m.selected < 2 then m.selected++
        updateSelection()
        return true
    else if key = "OK"
        actions = ["watch", "signin", "signup"]
        if m.top.signedIn then actions = ["watch", "profiles", "account"]
        m.top.action = actions[m.selected]
        return true
    end if
    return key <> "back"
end function
