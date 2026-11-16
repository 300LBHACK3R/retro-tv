sub init()
    m.watch = m.top.FindNode("watch")
    m.signin = m.top.FindNode("signin")
    m.create = m.top.FindNode("create")
    m.top.FindNode("homeBuildLabel").text = "v" + CreateObject("roAppInfo").GetVersion()
    m.profileMode = false
    m.portraits = ParseJson(ReadAsciiFile("pkg:/data/portraits.json"))
    m.selected = 0
    updateProfile()
    updateSelection()
end sub

sub reset()
    m.profileMode = false
    m.profiles = []
    m.selected = 0
    for each card in [m.watch, m.signin, m.create]
        card.visible = true
    end for
    m.watch.translation = [190,318]
    m.signin.translation = [510,318]
    m.create.translation = [830,318]
    m.watch.portrait = "pkg:/images/profile-sun.png"
    m.signin.portrait = "pkg:/images/profile-sun.png"
    m.create.portrait = ""
    m.watch.add = false
    m.signin.add = false
    m.create.add = true
    m.top.FindNode("homeHelp").text = "Left / Right to choose   •   OK to select"
    updateProfile()
    updateSelection()
    m.top.SetFocus(true)
end sub

sub updateProfile()
    if m.watch = invalid or m.profileMode = true then return
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
    m.top.FindNode("overlay").color = Left(themeColor("appBg", "0x090F18FF"), 8) + "55"
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
    if m.profileMode = true then return profileKeyEvent(key)
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

' Reuse the home cards instead of a system dialog. At most three portraits are
' rendered at once, so larger households remain readable on a 720p screen.
sub showProfiles(profiles as object, activeId as string)
    m.profileMode = true
    m.profiles = profiles
    m.selected = 0
    for i = 0 to profiles.Count() - 1
        if profiles[i].id = activeId then m.selected = i
    end for
    m.top.FindNode("homeSubtitle").text = "Pick your profile. Settle into something good."
    renderProfiles()
    m.top.SetFocus(true)
end sub

sub renderProfiles()
    cards = [m.watch, m.signin, m.create]
    count = m.profiles.Count()
    pageStart = Int(m.selected / 3) * 3
    visibleCount = count - pageStart
    if visibleCount > 3 then visibleCount = 3
    left = (1280 - visibleCount * 320 + 60) / 2
    for i = 0 to 2
        card = cards[i]
        card.visible = i < visibleCount
        if card.visible
            profile = m.profiles[pageStart + i]
            card.translation = [left + i * 320, 318]
            card.title = profile.name
            card.subtitle = "Full lineup"
            if profile.kids then card.subtitle = "Kids • Approved shows only"
            card.portrait = "pkg:/images/profile-sun.png"
            if m.portraits <> invalid
                if profile.avatar <> invalid
                    if m.portraits.DoesExist(profile.avatar) then card.portrait = m.portraits[profile.avatar]
                end if
            end if
            card.add = false
            card.selected = pageStart + i = m.selected
        end if
    end for
    help = "Left / Right to choose   •   OK to watch   •   Back to return"
    if count > 3 then help = (m.selected + 1).ToStr() + " of " + count.ToStr() + "   •   " + help
    if count = 0 then help = "No profiles available. Manage profiles at tatestv.ca/account.   •   Back to return"
    m.top.FindNode("homeHelp").text = help
end sub

function profileKeyEvent(key as string) as boolean
    count = m.profiles.Count()
    if key = "left" or key = "right"
        if key = "left" and m.selected > 0 then m.selected--
        if key = "right" and m.selected < count - 1 then m.selected++
        renderProfiles()
    else if key = "OK"
        if count > 0 then m.top.selectedProfile = m.profiles[m.selected].id
    else if key = "back"
        m.top.action = "cancelProfiles"
    end if
    return true
end function
