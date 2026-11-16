' Exercise the actual channel-strip renderer; navigation is covered separately.
sub main()
    m.top = node()
    m.top.focused = true
    m.top.HasFocus = function()
        return m.focused
    end function
    m.top.channels = [{ id: "channel:1", number: 1, title: "Station One" }, { id: "channel:2", number: 2, title: "Station Two" }]
    m.top.channelId = "channel:1"
    m.ids = ["channel:1", "channel:2"]
    m.index = 1
    catalog = ParseJson(ReadAsciiFile("pkg:/data/themes.json"))
    for each theme in catalog.themes
        m.top.themeColors = theme.colors
        m.top.focused = true
        render()
        playing = m.top.children[0]
        focused = m.top.children[1]
        check(playing.children[1].text = "CH 1 • LIVE", "Playing station stays marked while browsing")
        check(playing.children[0].color = theme.colors.guideCurrentBg and playing.children[1].color = theme.colors.onPrimary, "Playing station uses readable current-channel colours")
        check(focused.children[0].color = theme.colors.guideActiveBg and focused.color = theme.colors.onPrimary, "Remote focus uses a contrasting outline in every theme")
        m.top.focused = false
        render()
        check(m.top.children[1].color = theme.colors.border and m.top.children[1].children[0].color = theme.colors.guideRowBg, "Leaving the strip removes its selection highlight")
        check(m.top.children[1].children[1].color = theme.colors.text, "Unfocused rows regain the correct light or dark text")
    end for
    m.top.channels = []
    render()
    check(m.top.children.Count() = 0, "Empty audiences cannot retain old channel cards")
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: channel-strip rendering, distinct remote focus, playing state and empty audience in all packaged themes"
end sub

function node() as object
    return {
        children: [], font: {}
        GetChildCount: function()
            return m.children.Count()
        end function
        RemoveChildrenIndex: sub(count, index)
            m.children = []
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
