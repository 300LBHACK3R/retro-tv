' Device credentials are isolated from the website's cookie session. Passwords
' and email codes live only in the current dialog/request, never the registry.
sub initAccounts()
    m.account = invalid
    m.activeAccountProfile = invalid
    m.accountSession = ParseJson(m.registry.Read("accountSession"))
    if not validAccountSession(m.accountSession) then m.accountSession = invalid
    m.accountBusy = false
    m.authStage = ""
    m.authKind = "signin"
    m.accountCanceled = false
    m.accountRefreshRetried = false
    m.chooseAfterAccount = false
    if m.accountSession <> invalid then accountRequest({ action: "refresh", refreshToken: m.accountSession.refreshToken }, false)
end sub

function validAccountSession(value as dynamic) as boolean
    if type(value) <> "roAssociativeArray" then return false
    if not accountString(value.accessToken) or not accountString(value.refreshToken) then return false
    if Len(value.accessToken) < 10 or Len(value.refreshToken) < 10 then return false
    if value.expiresAt = invalid then return false
    return type(value.expiresAt) = "Integer" or type(value.expiresAt) = "roInt" or type(value.expiresAt) = "Double" or type(value.expiresAt) = "roDouble" or type(value.expiresAt) = "Float" or type(value.expiresAt) = "roFloat" or type(value.expiresAt) = "LongInteger"
end function

function accountString(value as dynamic) as boolean
    return type(value) = "String" or type(value) = "roString"
end function

sub saveAccountSession(session as object)
    m.accountSession = session
    m.registry.Write("accountSession", FormatJson(session))
    m.registry.Flush()
end sub

sub forgetAccount()
    m.accountSession = invalid
    m.account = invalid
    m.activeAccountProfile = invalid
    m.accountRefreshRetried = false
    m.registry.Delete("accountSession")
    m.registry.Flush()
    m.home.signedIn = false
    m.home.accountStatus = ""
    buildMenu()
end sub

sub refreshAccount()
    if m.accountBusy or m.authStage <> "" or m.accountSession = invalid then return
    now = CreateObject("roDateTime").AsSeconds()
    if m.accountSession.expiresAt < now + 120
        accountRequest({ action: "refresh", refreshToken: m.accountSession.refreshToken }, false)
    end if
end sub

sub accountRequest(payload as object, foreground as boolean)
    if m.accountBusy then return
    if m.accountSession <> invalid and payload.action <> "refresh"
        now = CreateObject("roDateTime").AsSeconds()
        if m.accountSession.expiresAt < now + 60
            m.afterAccountRefresh = payload
            accountRequest({ action: "refresh", refreshToken: m.accountSession.refreshToken }, foreground)
            return
        end if
    end if
    m.accountBusy = true
    m.accountCanceled = false
    m.accountForeground = foreground
    m.accountAction = payload.action
    m.sequence++
    m.accountRequestId = m.sequence
    task = CreateObject("roSGNode", "AccountTask")
    task.payload = payload
    task.requestId = m.sequence
    if m.accountSession <> invalid then task.accessToken = m.accountSession.accessToken
    task.ObserveField("response", "onAccountResponse")
    m.accountTask = task
    if foreground
        m.authStage = "waiting"
        accountMessage("Connecting to your account", ["Just a moment..."], ["Cancel"])
    else
        m.home.accountStatus = "Restoring your sign-in..."
    end if
    task.control = "run"
end sub

sub onAccountResponse(event as object)
    data = event.GetData()
    if data.requestId <> m.accountRequestId then return
    action = m.accountAction
    foreground = m.accountForeground
    canceled = m.accountCanceled
    m.accountBusy = false
    m.accountTask.UnobserveField("response")
    m.accountTask.response = {}
    m.accountTask = invalid
    if m.authStage = "waiting" then closeAccountDialog()
    if validAccountSession(data.session)
        if canceled and action <> "refresh"
            revokeAccountSession(data.session.accessToken)
            return
        end if
        saveAccountSession(data.session)
    end if
    if canceled
        m.afterAccountRefresh = invalid
        return
    end if
    if data.ok <> true
        m.afterAccountRefresh = invalid
        if (action = "state" or action = "profile") and data.status = 401 and m.accountSession <> invalid
            if not m.accountRefreshRetried
                m.accountRefreshRetried = true
                m.chooseAfterAccount = foreground
                accountRequest({ action: "refresh", refreshToken: m.accountSession.refreshToken }, foreground)
                return
            end if
            forgetAccount()
        end if
        if action = "refresh" and data.status = 401 then forgetAccount()
        m.home.accountStatus = "Account unavailable • Free viewing is ready"
        if foreground
            m.authStage = "error"
            accountMessage("Let's try that again", [data.error], ["Start again", "Cancel"])
        end if
        return
    end if
    if action = "signup" or action = "recover"
        m.authChallenge = data.challenge
        m.authStage = "code"
        accountKeyboard("Check your email", "Enter the code sent to " + m.authEmail + ". Already have a confirmed account? Cancel and choose Sign in.", "numeric", false, 10)
    else if action = "signin" or action = "verify" or action = "reset"
        m.authChallenge = ""
        m.authCode = ""
        m.chooseAfterAccount = true
        accountRequest({ action: "state" }, true)
    else if action = "refresh"
        nextRequest = m.afterAccountRefresh
        m.afterAccountRefresh = invalid
        if nextRequest <> invalid
            accountRequest(nextRequest, foreground)
        else
            accountRequest({ action: "state" }, foreground)
        end if
    else if action = "state"
        m.accountRefreshRetried = false
        acceptAccount(data.account)
        if m.chooseAfterAccount and foreground
            m.chooseAfterAccount = false
            showAccountProfiles()
        end if
    else if action = "profile"
        m.accountRefreshRetried = false
        acceptAccount(data.account)
        if m.account = invalid then return
        profile = data.profile
        if profile.kids and not m.account.parentPinRequired and m.registry.Read("parentPinHash") = ""
            m.pendingAccountProfile = profile
            m.pinAction = "create"
            askPin("Set a parent PIN", "Choose 4 digits to protect this TV's Kids profile.")
        else
            activateAccountProfile(profile)
        end if
    end if
end sub

sub acceptAccount(account as dynamic)
    if type(account) <> "roAssociativeArray" then return
    if type(account.profiles) <> "roArray" or account.user = invalid then return
    lockOwner = m.registry.Read("kidsAccountOwner")
    if m.kids and lockOwner <> "" and account.user.id <> lockOwner
        token = m.accountSession.accessToken
        forgetAccount()
        revokeAccountSession(token)
        m.chooseAfterAccount = false
        showMessage("Use the parent account", ["This TV is in Kids mode. Sign in to the household account that enabled it."])
        return
    end if
    m.account = account
    m.home.signedIn = true
    label = "Signed in • " + account.user.email
    if account.member then label = "Membership active • " + account.user.email
    m.home.accountStatus = label
    buildMenu()
end sub

sub startAccountAuth(kind as string)
    if m.kids and (kind <> "signin" or m.registry.Read("kidsAccountOwner") = "")
        showMessage("Ask a parent", ["Leave Kids mode with the parent PIN before changing accounts."])
        return
    end if
    if m.accountBusy
        showMessage("Just a moment", ["Your account is connecting. You can keep watching for free while it finishes."])
        return
    end if
    if m.accountSession <> invalid
        m.chooseAfterAccount = true
        accountRequest({ action: "state" }, true)
        return
    end if
    m.authKind = kind
    m.authEmail = ""
    m.authChallenge = ""
    m.authCode = ""
    m.authStage = "emailShare"
    m.accountStore = CreateObject("roSGNode", "ChannelStore")
    info = CreateObject("roSGNode", "ContentNode")
    context = "signin"
    if kind = "signup" then context = "signup"
    info.AddFields({ context: context })
    m.accountStore.requestedUserDataInfo = info
    m.accountStore.requestedUserData = "email"
    m.accountStore.ObserveField("userData", "onAccountEmailShared")
    m.accountStore.command = "getUserData"
end sub

sub onAccountEmailShared(event as object)
    if m.authStage <> "emailShare" then return
    m.accountStore.UnobserveField("userData")
    data = event.GetData()
    if data <> invalid
        if data.email <> invalid then m.authEmail = data.email
    end if
    m.accountStore = invalid
    m.authStage = "email"
    accountKeyboard("Your Tate's TV email", "Use the same email as your website account.", "email", false, 254, m.authEmail)
end sub

sub accountKeyboard(title as string, message as string, domain as string, secure as boolean, maximum as integer, value = "" as string)
    dialog = CreateObject("roSGNode", "StandardKeyboardDialog")
    dialog.title = title
    dialog.message = [message]
    dialog.keyboardDomain = domain
    dialog.textEditBox.maxTextLength = maximum
    dialog.textEditBox.secureMode = secure
    dialog.text = value
    dialog.buttons = ["Continue", "Cancel"]
    if m.authStage = "password" and m.authKind = "signin" then dialog.buttons = ["Sign in", "Forgot password", "Cancel"]
    dialog.ObserveField("buttonSelected", "onAccountDialog")
    dialog.AddFields({ accountDialog: true })
    presentDialog(dialog)
end sub

sub accountMessage(title as string, lines as object, buttons as object)
    dialog = CreateObject("roSGNode", "StandardMessageDialog")
    dialog.title = title
    dialog.message = lines
    dialog.buttons = buttons
    dialog.AddFields({ accountDialog: true })
    dialog.ObserveField("buttonSelected", "onAccountDialog")
    presentDialog(dialog)
end sub

sub closeAccountDialog()
    dialog = m.top.dialog
    m.authStage = ""
    if dialog <> invalid
        if dialog.HasField("accountDialog")
            dialog.close = true
            m.top.dialog = invalid
        end if
    end if
end sub

sub cancelAccountFlow()
    m.accountCanceled = true
    m.chooseAfterAccount = false
    m.afterAccountRefresh = invalid
    m.authEmail = ""
    m.authCode = ""
    m.authChallenge = ""
    closeAccountDialog()
    restoreFocus()
end sub

sub onAccountDialog(event as object)
    dialog = m.top.dialog
    if dialog = invalid then return
    index = event.GetData()
    stage = m.authStage
    if stage = "password" and m.authKind = "signin" and index = 1
        dialog.text = ""
        closeAccountDialog()
        m.authKind = "recover"
        accountRequest({ action: "recover", email: m.authEmail }, true)
        return
    end if
    if stage = "profiles"
        if index >= m.account.profiles.Count()
            cancelAccountFlow()
            return
        end if
        profile = m.account.profiles[index]
        m.requestedAccountProfile = profile.id
        closeAccountDialog()
        if not profile.kids and m.account.parentPinRequired
            m.authStage = "parentPin"
            accountKeyboard("Your account's parent PIN", "Use the parent PIN from your Tate's TV account.", "numeric", true, 8)
        else
            accountRequest({ action: "profile", profileId: profile.id }, true)
        end if
        return
    end if
    if stage = "account"
        closeAccountDialog()
        if index = 0
            m.chooseAfterAccount = true
            accountRequest({ action: "state" }, true)
        else if index = 1
            m.authStage = "signout"
            accountMessage("Sign out of this TV?", ["Your website account will stay signed in. Free viewing will still be available."], ["Sign out", "Cancel"])
        end if
        return
    end if
    if index <> 0 or stage = "waiting"
        if dialog.HasField("text") then dialog.text = ""
        cancelAccountFlow()
        return
    end if
    if stage = "error"
        closeAccountDialog()
        startAccountAuth(m.authKind)
    else if stage = "signout"
        token = m.accountSession.accessToken
        closeAccountDialog()
        forgetAccount()
        revokeAccountSession(token)
        showHome()
    else if stage = "email"
        email = LCase(dialog.text.Trim())
        if not CreateObject("roRegex", "^[^\s@]+@[^\s@]+\.[^\s@]+$", "").IsMatch(email)
            dialog.message = ["Enter a valid email address."]
            return
        end if
        m.authEmail = email
        closeAccountDialog()
        if m.authKind = "signup"
            m.authStage = "adult"
            accountMessage("Create your household account", ["An adult must create and manage this account. Watching TV is free; this does not start a subscription."], ["I am an adult • Continue", "Cancel"])
        else if m.authKind = "recover"
            accountRequest({ action: "recover", email: m.authEmail }, true)
        else
            askAccountPassword()
        end if
    else if stage = "adult"
        closeAccountDialog()
        askAccountPassword()
    else if stage = "password" or stage = "newPassword"
        password = dialog.text
        minimum = 12
        if m.authKind = "signin" then minimum = 1
        if Len(password) < minimum
            dialog.message = ["Use at least " + minimum.ToStr() + " characters."]
            return
        end if
        dialog.text = ""
        closeAccountDialog()
        if stage = "newPassword"
            accountRequest({ action: "reset", challenge: m.authChallenge, code: m.authCode, password: password }, true)
            m.authCode = ""
        else
            accountRequest({ action: m.authKind, email: m.authEmail, password: password, adult: m.authKind = "signup" }, true)
        end if
        password = ""
    else if stage = "code"
        code = dialog.text.Trim()
        if not CreateObject("roRegex", "^[0-9]{6,10}$", "").IsMatch(code)
            dialog.message = ["Enter the 6–10 digit code from your email."]
            return
        end if
        dialog.text = ""
        closeAccountDialog()
        if m.authKind = "recover"
            m.authCode = code
            m.authStage = "newPassword"
            accountKeyboard("Choose a new password", "Use 12–128 characters. This will also be your website password.", "password", true, 128)
        else
            accountRequest({ action: "verify", challenge: m.authChallenge, code: code }, true)
        end if
    else if stage = "parentPin"
        pin = dialog.text
        dialog.text = ""
        closeAccountDialog()
        accountRequest({ action: "profile", profileId: m.requestedAccountProfile, pin: pin }, true)
    end if
end sub

sub askAccountPassword()
    m.authStage = "password"
    message = "Enter your existing Tate's TV password."
    if m.authKind = "signup" then message = "Choose 12–128 characters. This password will also work on the website."
    accountKeyboard("Your Tate's TV password", message, "password", true, 128)
end sub

sub showAccountProfiles()
    if m.account = invalid then return
    if m.kids and not m.account.parentPinRequired and m.registry.Read("parentPinHash") <> ""
        now = CreateObject("roDateTime").AsSeconds()
        if Val(m.registry.Read("pinBlockedUntil")) > now
            showMessage("Try again shortly", ["Please wait one minute before trying the parent PIN again."])
            return
        end if
        m.pinAction = "unlock"
        askPin("Parent PIN", "Enter your 4-digit PIN before switching profiles.")
        return
    end if
    buttons = []
    for each profile in m.account.profiles
        label = profile.name
        if profile.kids then label += " • Kids"
        buttons.Push(label)
    end for
    buttons.Push("Cancel")
    m.authStage = "profiles"
    accountMessage("Who's watching?", ["Choose a profile from your Tate's TV household."], buttons)
end sub

sub activateAccountProfile(profile as object)
    if profile.kids and m.account.parentPinRequired
        m.registry.Write("kidsAccountOwner", m.account.user.id)
    else
        m.registry.Delete("kidsAccountOwner")
    end if
    m.registry.Flush()
    m.activeAccountProfile = profile
    if profile.theme <> invalid then applyTheme(profile.theme)
    showBrowser()
    setKids(profile.kids)
    m.home.kids = m.kids
    enterViewer()
end sub

sub showAccountDetails()
    if m.kids
        showMessage("Ask a parent", ["Leave Kids mode with the parent PIN before changing accounts."])
        return
    end if
    if m.account = invalid then return
    membership = "Free account • Watching is always free."
    if m.account.member then membership = "Membership active • Thanks for supporting Tate's TV."
    m.authStage = "account"
    accountMessage("Your Tate's TV account", [m.account.user.email, membership], ["Refresh profiles", "Sign out", "Back"])
end sub

sub revokeAccountSession(token as string)
    task = CreateObject("roSGNode", "AccountTask")
    task.payload = { action: "signout" }
    task.accessToken = token
    m.signoutTask = task
    task.control = "run"
end sub
