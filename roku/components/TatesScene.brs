sub init()
    for each id in ["menu", "list", "status", "heading", "profileLabel", "artwork", "detailTitle", "detail", "video", "refreshTimer", "segmentTimer"]
        m[id] = m.top.FindNode(id)
    end for
    m.registry = CreateObject("roRegistrySection", "tates-tv-v1")
    m.kids = m.registry.Read("kids") = "true"
    m.catalog = invalid
    m.entries = []
    m.view = "channels"
    m.group = invalid
    m.search = ""
    m.pendingLaunch = invalid
    m.playing = invalid
    m.isLoadingPlayback = false
    m.sequence = 0
    m.launchComplete = false
    m.dialogSequence = 0
    m.menu.ObserveField("itemSelected", "onMenuSelected")
    m.list.ObserveField("itemSelected", "onItemSelected")
    m.list.ObserveField("itemFocused", "onItemFocused")
    m.video.ObserveField("state", "onVideoState")
    m.video.ObserveField("position", "onVideoPosition")
    m.refreshTimer.ObserveField("fire", "onRefresh")
    m.segmentTimer.ObserveField("fire", "onSegmentEnd")
    applyTheme(m.registry.Read("theme"))
    buildMenu()
    m.menu.SetFocus(true)
    refreshCatalog()
    m.refreshTimer.control = "start"
end sub

function audience() as string
    if m.kids then return "kids"
    return "all"
end function

function encoded(value as string) as string
    return value.EncodeUriComponent()
end function

sub cancelTask(name as string)
    if m[name] <> invalid
        m[name].UnobserveField("response")
        m[name].control = "stop"
        m[name] = invalid
    end if
end sub

sub refreshCatalog()
    cancelTask("catalogTask")
    m.status.text = "Updating your TV listings..."
    task = CreateObject("roSGNode", "ApiTask")
    task.path = "catalog?audience=" + audience()
    m.sequence++
    m.catalogRequest = m.sequence
    task.requestId = m.sequence
    task.ObserveField("response", "onCatalog")
    m.catalogTask = task
    task.control = "run"
end sub

sub onCatalog(event as object)
    data = event.GetData()
    if data.requestId <> m.catalogRequest then return
    if data.ok <> true
        m.status.text = data.error
        markLaunchComplete()
        return
    end if
    if data.audience <> audience() then return
    if type(data.channels) <> "roArray" or type(data.library) <> "roArray"
        m.status.text = "Listings could not be read. Choose Refresh to try again."
        markLaunchComplete()
        return
    end if
    m.catalog = data
    if m.kids and m.view = "channels" and data.channels.Count() = 0 then m.view = "library"
    if m.view = "episodes" and m.group <> invalid
        previousId = m.group.id
        m.group = invalid
        for each group in data.library
            if group.id = previousId then m.group = group
        end for
        if m.group = invalid then m.view = "library"
    end if
    m.status.text = "Free viewing • Updated from Tate's TV"
    if m.kids then m.status.text = "Kids mode • Only your approved lineup"
    renderList(true)
    if m.pendingLaunch <> invalid then dispatchLaunch()
    if not m.isLoadingPlayback then markLaunchComplete()
end sub

sub markLaunchComplete()
    if m.launchComplete then return
    m.top.SignalBeacon("AppLaunchComplete")
    m.launchComplete = true
end sub

sub buildMenu()
    content = CreateObject("roSGNode", "ContentNode")
    labels = ["Live TV", "Library", "Search", "Kids mode", "Themes", "Refresh", "Help"]
    if m.kids then labels[3] = "Exit Kids"
    for each label in labels
        node = content.CreateChild("ContentNode")
        node.title = label
    end for
    m.menu.content = content
    m.profileLabel.text = "HOUSEHOLD"
    if m.kids then m.profileLabel.text = "KIDS • PIN LOCKED"
end sub

sub onMenuSelected()
    index = m.menu.itemSelected
    if index = 0
        m.view = "channels"
        m.group = invalid
        m.search = ""
        renderList(false)
    else if index = 1
        m.view = "library"
        m.group = invalid
        m.search = ""
        renderList(false)
    else if index = 2
        showSearch()
        return
    else if index = 3
        changeProfile()
        return
    else if index = 4
        m.view = "themes"
        renderList(false)
    else if index = 5
        refreshCatalog()
        return
    else if index = 6
        showMessage("Welcome to Tate's TV", ["Choose Live TV for the shared schedule, or Library to watch from the beginning.", "Kids mode requires a parent PIN to exit. Themes and viewing progress are saved on this Roku.", "Support and privacy: tatestv.ca/help • tatestv.ca/privacy"])
        return
    end if
    if m.entries.Count() > 0 then m.list.SetFocus(true)
end sub

sub renderList(preserve as boolean)
    selected = 0
    selectedId = ""
    if preserve and m.entries.Count() > 0
        selected = m.list.itemFocused
        if selected >= 0 and selected < m.entries.Count() then selectedId = m.entries[selected].id
    end if
    m.entries = []
    m.heading.text = "Good TV. Your way."
    if m.view = "themes"
        m.heading.text = "Make yourself at home."
        m.entries = [{ id: "christmas", title: "Christmas '96", description: "Warm Christmas colours, blue cable guide and brass controls. Free." }, { id: "retro", title: "Classic Blue", description: "A familiar blue TV guide with clear, high-contrast controls. Free." }]
    else if m.catalog <> invalid
        if m.view = "channels"
            m.heading.text = "On now. Up next."
            m.entries = m.catalog.channels
        else if m.view = "episodes" and m.group <> invalid
            m.heading.text = m.group.title
            m.entries = m.group.items
        else
            m.heading.text = "Your library. Your evening."
            for each group in m.catalog.library
                if m.search = "" or Instr(1, LCase(group.title), LCase(m.search)) > 0 then m.entries.Push(group)
            end for
        end if
    end if
    content = CreateObject("roSGNode", "ContentNode")
    selected = 0
    for index = 0 to m.entries.Count() - 1
        entry = m.entries[index]
        node = content.CreateChild("ContentNode")
        node.title = entry.title
        if m.view = "channels" then node.title = entry.number.ToStr() + "  " + entry.title
        if entry.id = selectedId then selected = index
    end for
    m.list.content = content
    if m.entries.Count() > 0
        m.list.jumpToItem = selected
        showDetail(selected)
    else
        m.artwork.uri = "pkg:/images/logo.png"
        m.detailTitle.text = "More good TV is on the way."
        m.detail.text = "Nothing available here yet. Choose Refresh to check again."
    end if
end sub

sub onItemFocused()
    showDetail(m.list.itemFocused)
end sub

sub showDetail(index as integer)
    if index < 0 or index >= m.entries.Count() then return
    entry = m.entries[index]
    m.artwork.uri = "pkg:/images/logo.png"
    if entry.poster <> invalid and entry.poster <> "" then m.artwork.uri = entry.poster
    m.detailTitle.text = entry.title
    m.detail.text = ""
    if entry.description <> invalid then m.detail.text = entry.description
    if m.view = "channels"
        m.detailTitle.text = "Now: " + entry.now
        m.detail.text = "Next: " + entry.next
    else if m.view = "library"
        m.detail.text = entry.items.Count().ToStr() + " programme(s) • OK to browse"
    else if m.view = "episodes"
        m.detail.text = Int(entry.duration / 60).ToStr() + " minutes • OK to play"
    end if
end sub

sub onItemSelected()
    index = m.list.itemSelected
    if index < 0 or index >= m.entries.Count() then return
    entry = m.entries[index]
    if m.view = "themes"
        applyTheme(entry.id)
        m.registry.Write("theme", entry.id)
        m.registry.Flush()
    else if m.view = "library"
        m.group = entry
        m.view = "episodes"
        renderList(false)
    else
        requestPlayback(entry.id)
    end if
end sub

sub applyTheme(theme as string)
    m.top.FindNode("room").visible = theme <> "retro"
    if theme = "retro"
        background = "0x071C36FF"
        menu = "0x123663FF"
        accent = "0x80E5FFFF"
    else
        background = "0x10271FFF"
        menu = "0x193B2FFF"
        accent = "0xE7C584FF"
    end if
    m.top.FindNode("background").color = background
    m.top.FindNode("menuPanel").color = menu
    m.top.FindNode("accent").color = accent
    m.menu.focusBitmapBlendColor = accent
    m.list.focusBitmapBlendColor = accent
    m.top.FindNode("hint").color = accent
    palette = CreateObject("roSGNode", "RSGPalette")
    palette.colors = {
        DialogBackgroundColor: background
        DialogTextColor: "0xFFF3D8FF"
        DialogFocusColor: accent
        DialogFocusItemColor: "0x102035FF"
        DialogItemColor: accent
        DialogSecondaryTextColor: "0xD5DDDBFF"
        DialogSecondaryItemColor: accent
        DialogInputFieldColor: menu
        DialogKeyboardColor: menu
        DialogFootprintColor: menu
    }
    m.top.palette = palette
end sub

sub showSearch()
    dialog = CreateObject("roSGNode", "StandardKeyboardDialog")
    dialog.title = "Find your next favourite"
    dialog.buttons = ["Search", "Cancel"]
    dialog.ObserveField("buttonSelected", "onSearch")
    presentDialog(dialog)
end sub

sub onSearch(event as object)
    dialog = m.top.dialog
    if event.GetData() = 0
        m.search = Left(dialog.text, 100)
        m.view = "library"
        m.group = invalid
        renderList(false)
    end if
    dialog.close = true
    if m.entries.Count() > 0 then m.list.SetFocus(true) else m.menu.SetFocus(true)
end sub

sub showMessage(title as string, lines as object)
    dialog = CreateObject("roSGNode", "StandardMessageDialog")
    dialog.title = title
    dialog.message = lines
    dialog.buttons = ["OK"]
    dialog.ObserveField("buttonSelected", "closeMessage")
    presentDialog(dialog)
end sub

sub presentDialog(dialog as object)
    m.dialogSequence++
    dialog.id = "dialog-" + m.dialogSequence.ToStr()
    dialog.ObserveField("wasClosed", "onDialogClosed")
    m.top.dialog = dialog
end sub

sub onDialogClosed(event as object)
    dialog = m.top.dialog
    if dialog <> invalid
        if dialog.id <> event.GetNode() then return
    end if
    m.top.dialog = invalid
    m.newPinHash = invalid
    if m.video.visible
        m.video.SetFocus(true)
    else if m.entries.Count() > 0 and m.view <> "channels"
        m.list.SetFocus(true)
    else
        m.menu.SetFocus(true)
    end if
end sub

sub closeMessage()
    m.top.dialog.close = true
    m.menu.SetFocus(true)
end sub

sub onRefresh()
    if not m.video.visible and not m.isLoadingPlayback and m.top.dialog = invalid then refreshCatalog()
end sub

sub onLaunch()
    args = m.top.launch
    if args = invalid then return
    if type(args.contentId) <> "roString" and type(args.contentId) <> "String" then return
    if type(args.mediaType) <> "roString" and type(args.mediaType) <> "String" then return
    if Len(args.contentId) > 255 then return
    if m.top.dialog <> invalid then m.top.dialog.close = true
    m.pendingLaunch = { id: args.contentId, mediaType: LCase(args.mediaType) }
    if m.catalog <> invalid then dispatchLaunch()
end sub

sub dispatchLaunch()
    link = m.pendingLaunch
    m.pendingLaunch = invalid
    if link.mediaType = "live"
        for each channel in m.catalog.channels
            if channel.id = link.id
                requestPlayback(channel.id)
                return
            end if
        end for
    else
        for each group in m.catalog.library
            if link.mediaType = "series" and group.id = link.id
                stopPlayback()
                m.view = "episodes"
                m.group = group
                renderList(false)
                m.list.SetFocus(true)
                return
            end if
            for each item in group.items
                if item.id = link.id
                    if link.mediaType = "series"
                        stopPlayback()
                        m.view = "episodes"
                        m.group = group
                        renderList(false)
                        m.list.SetFocus(true)
                    else if link.mediaType = item.mediaType or link.mediaType = "short-form"
                        requestPlayback(item.id)
                    end if
                    return
                end if
            end for
        end for
    end if
    showMessage("Programme unavailable", ["This programme is not available in the current profile."])
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "back"
        if m.video.visible or m.isLoadingPlayback
            stopPlayback()
            return true
        else if m.view = "episodes" and m.list.HasFocus()
            m.view = "library"
            m.group = invalid
            renderList(false)
            return true
        else if m.list.HasFocus()
            m.menu.SetFocus(true)
            return true
        end if
        return false
    end if
    if m.video.visible then return false
    if key = "left" and m.list.HasFocus()
        m.menu.SetFocus(true)
        return true
    else if key = "right" and m.menu.HasFocus() and m.entries.Count() > 0
        m.list.SetFocus(true)
        return true
    else if key = "options"
        showSearch()
        return true
    end if
    return false
end function
