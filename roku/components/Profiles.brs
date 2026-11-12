sub changeProfile()
    now = CreateObject("roDateTime").AsSeconds()
    blockedUntil = Val(m.registry.Read("pinBlockedUntil"))
    if m.kids and blockedUntil > now
        showMessage("Try again shortly", ["Please wait one minute before trying the parent PIN again."])
        return
    end if
    if m.kids
        m.pinAction = "unlock"
        askPin("Parent PIN", "Enter your 4-digit PIN to leave Kids mode.")
    else if m.registry.Read("parentPinHash") = ""
        m.pinAction = "create"
        askPin("Set a parent PIN", "Choose 4 digits. This PIN will be required to exit Kids mode.")
    else
        setKids(true)
    end if
end sub

function pinHash(pin as string) as string
    bytes = CreateObject("roByteArray")
    bytes.FromAsciiString("tates-tv-parent:" + pin)
    digest = CreateObject("roEVPDigest")
    digest.Setup("sha256")
    digest.Update(bytes)
    return digest.Final()
end function

sub askPin(title as string, message as string)
    dialog = CreateObject("roSGNode", "StandardPinPadDialog")
    dialog.title = title
    dialog.message = [message]
    dialog.buttons = ["Continue", "Cancel"]
    dialog.textEditBox.maxTextLength = 4
    dialog.ObserveField("buttonSelected", "onPin")
    presentDialog(dialog)
end sub

sub onPin(event as object)
    dialog = m.top.dialog
    if event.GetData() <> 0
        m.newPinHash = invalid
        dialog.close = true
        m.menu.SetFocus(true)
        return
    end if
    pin = dialog.pin
    if not CreateObject("roRegex", "^[0-9]{4}$", "").IsMatch(pin)
        dialog.message = ["Enter exactly 4 digits."]
        return
    end if
    hash = pinHash(pin)
    if m.pinAction = "create"
        m.newPinHash = hash
        m.pinAction = "confirm"
        dialog.pin = ""
        dialog.title = "Confirm your parent PIN"
        dialog.message = ["Enter the same 4 digits once more."]
    else if m.pinAction = "confirm"
        if hash <> m.newPinHash
            dialog.pin = ""
            dialog.message = ["Those digits did not match. Try again, or Cancel to start over."]
            return
        end if
        m.registry.Write("parentPinHash", hash)
        m.registry.Flush()
        m.newPinHash = invalid
        dialog.close = true
        setKids(true)
    else if m.pinAction = "unlock"
        if hash = m.registry.Read("parentPinHash")
            m.registry.Delete("pinAttempts")
            m.registry.Delete("pinBlockedUntil")
            dialog.close = true
            setKids(false)
        else
            attempts = Val(m.registry.Read("pinAttempts")) + 1
            m.registry.Write("pinAttempts", attempts.ToStr())
            dialog.pin = ""
            dialog.message = ["That PIN did not match."]
            if attempts >= 5
                untilTime = CreateObject("roDateTime").AsSeconds() + 60
                m.registry.Write("pinBlockedUntil", untilTime.ToStr())
                m.registry.Write("pinAttempts", "0")
                dialog.close = true
                m.menu.SetFocus(true)
                m.status.text = "Please wait one minute before trying the parent PIN again."
            end if
            m.registry.Flush()
        end if
    end if
end sub

sub setKids(enabled as boolean)
    stopPlayback()
    cancelTask("catalogTask")
    m.kids = enabled
    value = "false"
    if enabled then value = "true"
    m.registry.Write("kids", value)
    m.registry.Flush()
    ' Clear the previous audience before a new network request can complete.
    m.catalog = invalid
    m.group = invalid
    m.pendingLaunch = invalid
    m.search = ""
    m.view = "channels"
    buildMenu()
    renderList(false)
    m.menu.SetFocus(true)
    refreshCatalog()
end sub
