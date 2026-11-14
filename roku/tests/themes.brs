' Run with Themes.brs, ThemeStyle.brs and TatesScene.brs, rooted at roku/.
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
    for each id in ["home", "menu", "guide", "channels", "libraryGrid", "playerFocus", "liveStage", "emptyMessage", "heading"]
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
    check(m.entries.Count() = 7, "All seven free website themes are selectable")
    for i = 0 to m.entries.Count() - 1
        expected = m.entries[i]
        m.libraryGrid.itemSelected = i
        m.libraryGrid.itemFocused = i
        onGridSelected()
        check(m.registry.saved = expected.id and m.registry.flushes = i + 1, "Selecting a theme saves its canonical ID")
        check(m.libraryGrid.jumpToItem = i, "Changing colours preserves the chosen grid item")
        check(m.libraryGrid.content.children[i].themeBadge = "Selected", "The applied theme is visibly marked")
        marked = 0
        for each item in m.libraryGrid.content.children
            if item.themeBadge = "Selected" then marked++
        end for
        check(marked = 1, "Only the active theme is marked Selected")
        m.themeId = ""
        applyTheme(m.registry.Read("theme"))
        check(m.themeId = expected.id, "Reopening restores every saved free theme")
        check(m.video.control = "play" and m.video.position = 73, "Changing themes leaves the playing video alone")
    end for
    applyTheme("telus-2008-inspired")
    renderList(false)
    check(m.libraryGrid.jumpToItem = 6, "Opening Themes highlights the current choice")
    check(m.menu.color = "0x10233BFF" and m.menu.focusedColor = "0xFFFFFFFF", "Bright Cable uses dark text and white focused text")
    check(not m.top.FindNode("room").visible, "A guide thumbnail is never used as the room backdrop")
    check(m.top.palette.colors.DialogTextColor = "0x10233BFF", "Keyboard and PIN dialogs receive the light palette")
    applyTheme("halloween-haunted-arcade")
    check(m.top.FindNode("room").visible and Instr(1, m.top.FindNode("room").uri, "haunted-arcade") > 0, "Seasonal themes use their own packaged room artwork")
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: seven free themes, legacy preferences, saved selection, light palette and uninterrupted playback"
end sub

function node() as object
    return {
        children: []
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
