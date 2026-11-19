' Run with Themes.brs, ThemeStyle.brs and TatesScene.brs, rooted at dist/staging.
' Actual selection/persistence functions run against the generated theme catalogue.
sub main()
    _brs_.mockFunction("CreateObject", function(kind, name)
        return node()
    end function)
    m.top = node()
    m.top.nodes = {}
    m.top.FindNode = function(id)
        if m.nodes[id] = invalid then m.nodes[id] = node()
        return m.nodes[id]
    end function
    for each id in ["home", "menu", "guide", "channels", "libraryGrid", "playerFocus", "liveStage", "emptyMessage", "heading", "profileLabel"]
        m[id] = m.top.FindNode(id)
    end for
    m.registry = {
        saved: "retro", flushes: 0
        Read: function(key)
            return m.saved
        end function
        Write: sub(key, value)
            m.saved = value
        end sub
        Flush: sub()
            m.flushes++
        end sub
    }
    m.fullscreen = false
    m.guide.visible = false
    m.view = "themes"
    m.entries = []
    m.libraryGrid.itemFocused = 0
    m.video = { control: "play", position: 73 }
    applyTheme(m.registry.Read("theme"))
    check(m.themeId = "shaw-2006", "Existing Classic Blue preferences migrate to Classic Cable")
    applyTheme("christmas")
    check(m.themeId = "christmas-96-living-room", "Existing Christmas preferences keep Christmas")
    applyTheme("missing-theme")
    check(m.themeId = "christmas-96-living-room", "An unavailable saved theme safely uses the free default")
    renderList(false)
    check(m.entries.Count() = 15, "All fifteen website themes have native TV designs")
    applyTheme("christmas-neon-noel")
    check(m.themeId = m.themeCatalog.defaultId, "A guest cannot activate premium Neon Noel")
    owned = []
    for each theme in m.themeCatalog.themes
        owned.Push(theme.id)
    end for
    m.account = { ownedThemeIds: owned, purchasedThemeIds: owned, member: false }
    applyTheme("christmas-2005-home")
    check(m.top.FindNode("winterMotion").enabled and not m.top.FindNode("guideWinterMotion").enabled, "Owned winter motion starts only on the visible screen")
    m.guide.visible = true
    applyTheme("christmas-2005-home")
    check(not m.top.FindNode("winterMotion").enabled and m.top.FindNode("guideWinterMotion").enabled, "Opening guide transfers motion to its backdrop")
    m.guide.visible = false
    m.fullscreen = true
    applyTheme("christmas-2005-home")
    check(not m.top.FindNode("winterMotion").enabled and not m.top.FindNode("guideWinterMotion").enabled, "Fullscreen video suspends decorative work")
    m.fullscreen = false
    for i = 0 to m.entries.Count() - 1
        expected = m.entries[i]
        m.libraryGrid.itemSelected = i
        m.libraryGrid.itemFocused = i
        onGridSelected()
        check(m.registry.saved = expected.id and m.registry.flushes = i + 1, "Selecting a theme saves its canonical ID")
        check(m.libraryGrid.jumpToItem = i, "Changing colours preserves the chosen grid item")
        check(m.libraryGrid.content.children[i].themeBadge = "Selected", "The applied theme is visibly marked")
        check(m.home.themeColors.primary = expected.colors.primary and m.guide.themeColors.guideRowBg = expected.colors.guideRowBg and m.channels.themeColors.primary = expected.colors.primary, "Every themed screen receives the selected palette")
        check(m.top.FindNode("room").uri = expected.background and m.top.FindNode("guideRoom").uri = expected.background, "Viewer and guide share the selected backdrop")
        check(m.top.FindNode("guideRoom").opacity = expected.backgroundOpacity, "Guide artwork uses the intended contrast treatment")
        marked = 0
        for each item in m.libraryGrid.content.children
            if item.themeBadge = "Selected" then marked++
        end for
        for j = 0 to m.entries.Count() - 1
            check(m.libraryGrid.content.children[j].viewerColors.primary = m.entries[j].colors.primary, "Each preview card retains its own theme colours")
        end for
        check(marked = 1, "Only the active theme is marked Selected")
        m.themeId = ""
        applyTheme(m.registry.Read("theme"))
        check(m.themeId = expected.id, "Reopening restores every saved free theme")
        check(m.video.control = "play" and m.video.position = 73, "Changing themes leaves the playing video alone")
    end for
    applyTheme("telus-2008-inspired")
    renderList(false)
    check(m.entries[m.libraryGrid.jumpToItem].id = "telus-2008-inspired", "Opening Themes highlights the current choice")
    check(m.menu.color = "0x10233BFF" and m.menu.focusedColor = "0xFFFFFFFF", "Bright Cable uses dark text and white focused text")
    check(Instr(1, m.top.FindNode("room").uri, "theme-backdrop-telus") > 0 and m.top.FindNode("room").opacity = 1, "Bright Cable gets its own full-screen backdrop, not a guide thumbnail")
    check(m.top.palette.colors.DialogTextColor = "0x10233BFF", "Keyboard and PIN dialogs receive the light palette")
    applyTheme("halloween-haunted-arcade")
    check(Instr(1, m.top.FindNode("room").uri, "haunted-arcade") > 0, "Seasonal themes use their own packaged room artwork")
    applyTheme("christmas")
    check(m.guide.themeColors.guideRowBg = "0x142A23FF" and m.guide.themeColors.guideHeaderBg = "0x203B31FF", "Christmas carries its green-and-gold style into the guide")
    m.browser = node()
    m.home.visible = true
    applyTheme("christmas")
    check(m.top.FindNode("room").opacity = 0.85, "Refreshing account/theme state keeps the entrance backdrop visible")
    m.profilePickerOpen = true
    m.authStage = ""
    m.accountBusy = false
    restoreFocus()
    check(m.authStage = "profiles" and m.home.focused, "Canceling local PIN setup restores the portrait picker")
    m.home.visible = false
    applyTheme("telus-2008-inspired")
    showBrowser()
    check(m.top.FindNode("room").opacity = 1, "Returning to the viewer preserves the light theme's intended backdrop opacity")
    m.storeEdition = true
    applyTheme("christmas-neon-noel")
    check(m.themeId = m.themeCatalog.defaultId, "Store edition denies a premium theme even with cached entitlements")
    renderList(false)
    check(m.entries.Count() = 7, "Store edition only lists the free themes")
    m.account = invalid
    m.kids = false
    buildMenu()
    check(m.menuActions.Count() = 7 and m.menuActions[4] = "themes", "Store menu retains free themes and excludes household/PIN access")
    m.catalog = { channels: [{ id: "channel:1", number: 1 }], library: [{ id: "series:show", type: "show", title: "Show", items: [{ id: "media:one", mediaType: "episode", duration: 50, title: "Episode" }] }] }
    m.pendingLaunch = { id: "channel:1", mediaType: "livefeed" }
    dispatchLaunch()
    check(m.requested = "channel:1" and m.fullscreen, "Store livefeed links immediately start live television")
    m.pendingLaunch = { id: "media:one", mediaType: "shortformvideo" }
    dispatchLaunch()
    check(m.requested = "media:one" and m.fullscreen, "Store short-form link goes directly to playback")
    m.pendingLaunch = { id: "series:show", mediaType: "series" }
    dispatchLaunch()
    check(m.requested = "media:one" and m.fullscreen, "Store series links go directly to a selected episode")
    m.requested = ""
    m.pendingLaunch = { id: "media:one", mediaType: "unsupported" }
    dispatchLaunch()
    check(m.home.visible and not m.browser.visible and m.requested = "", "Wrong media type returns to Home without playback")
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: native themes, legacy preferences, uninterrupted playback, Store menu and platform deep links"
end sub

function node() as object
    return {
        children: []
        SetFocus: sub(value): m.focused = value: end sub
        CallFunc: sub(name): end sub
        AddField: sub(name, kind, notify)
        end sub
        CreateChild: function(kind)
            child = node()
            m.children.Push(child)
            return child
        end function
    }
end function

sub check(condition as boolean, description as string)
    if condition then return
    if m.failed = invalid then m.failed = 0
    m.failed++
    print "FAIL: "; description
end sub

function cloudProfile() as boolean: return false: end function
sub requestPlayback(id as string): m.requested = id: end sub
sub dismissGuide(): end sub
sub stopPlayback(): m.fullscreen = false: end sub
function storeSeriesEpisode(group as object) as dynamic: return group.items[0]: end function
sub updateNowNext(): end sub
function arrayHas(values, id) as boolean
 for each value in values
  if value = id then return true
 end for
 return false
end function
