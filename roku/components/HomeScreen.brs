sub init()
    m.watch = m.top.FindNode("watch")
    m.create = m.top.FindNode("create")
    m.chooser = m.top.FindNode("chooser")
    m.account = m.top.FindNode("account")
    m.top.FindNode("homeBuildLabel").text = "v" + CreateObject("roAppInfo").GetVersion()
    m.selected = 0
    updateProfile()
    updateAccent()
end sub

sub reset()
    m.account.visible = false
    m.chooser.visible = true
    m.selected = 0
    updateSelection()
    m.top.SetFocus(true)
end sub

sub updateProfile()
    m.watch.subtitle = "Jump into the full lineup"
    if m.top.kids then m.watch.subtitle = "Kids • Approved shows only"
end sub

sub updateAccent()
    m.watch.accent = m.top.accent
    m.create.accent = m.top.accent
    updateSelection()
end sub

sub updateSelection()
    m.watch.selected = m.selected = 0
    m.create.selected = m.selected = 1
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if m.account.visible
        if key = "back" or key = "OK"
            m.account.visible = false
            m.chooser.visible = true
        end if
        return true
    end if
    if key = "left" or key = "right"
        if key = "left" then m.selected = 0 else m.selected = 1
        updateSelection()
        return true
    else if key = "OK"
        if m.selected = 0
            m.top.action = "watch"
        else if m.top.kids
            m.top.action = "parentAccount"
        else
            m.chooser.visible = false
            m.account.visible = true
        end if
        return true
    end if
    ' Back may exit the app; other keys must not reach the hidden TV browser.
    return key <> "back"
end function
