' Exercise real artwork-card reuse and focus with every packaged palette.
sub main()
    m.top = {
        nodes: {}, itemHasFocus: true
        FindNode: function(id)
            if m.nodes[id] = invalid then m.nodes[id] = {}
            return m.nodes[id]
        end function
    }
    catalog = ParseJson(ReadAsciiFile("pkg:/data/themes.json"))
    for each theme in catalog.themes
        m.top.itemContent = { title: theme.title, HDPosterUrl: theme.poster, themeBadge: "Selected", viewerColors: theme.colors }
        updateContent()
        check(m.top.FindNode("poster").uri = theme.poster, "Selected theme keeps its preview artwork")
        check(m.top.FindNode("badgePanel").color = theme.colors.primary and m.top.FindNode("badge").color = theme.colors.onPrimary, "Selected badge remains readable in every palette")
        check(m.top.FindNode("focusFrame").visible and m.top.FindNode("focusFrame").color = theme.colors.primary, "Each preview has its own focus colour")
        m.top.itemContent.themeBadge = "Free"
        updateContent()
        check(m.top.FindNode("badgePanel").color = theme.colors.panelBg and m.top.FindNode("badge").color = theme.colors.textMuted, "Recycled cards clear the former selected badge colours")
        m.top.itemContent = { title: "Library title", HDPosterUrl: "library.jpg", viewerColors: theme.colors }
        updateContent()
        check(not m.top.FindNode("badge").visible and not m.top.FindNode("badgePanel").visible, "Library cards never inherit a theme badge")
        m.top.itemHasFocus = false
        showFocus()
        check(not m.top.FindNode("focusFrame").visible, "Moving away removes focus")
        m.top.itemContent = invalid
        updateContent()
        m.top.itemHasFocus = true
        showFocus()
        check(m.top.FindNode("title").text = "" and m.top.FindNode("poster").uri = "" and not m.top.FindNode("focusFrame").visible, "Empty reused cells cannot display stale artwork, titles or focus")
    end for
    if m.failed <> invalid
        print "FAILED:"; m.failed
        stop
    end if
    print "PASS: all packaged preview palettes, selected badges, library reuse and empty-cell focus"
end sub

sub check(condition as boolean, description as string)
    if condition then return
    if m.failed = invalid then m.failed = 0
    m.failed++
    print "FAIL: "; description
end sub
