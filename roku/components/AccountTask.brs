sub init()
    m.top.functionName = "sendAccountRequest"
end sub

sub sendAccountRequest()
    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.SetMessagePort(port)
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.EnablePeerVerification(true)
    transfer.EnableHostVerification(true)
    transfer.RetainBodyOnError(true)
    transfer.AddHeader("Accept", "application/json")
    transfer.AddHeader("Content-Type", "application/json")
    if m.top.accessToken <> "" then transfer.AddHeader("Authorization", "Bearer " + m.top.accessToken)
    path = "/api/roku/account"
    if m.top.endpoint = "viewing" then path = "/api/roku/viewing"
    if m.top.endpoint = "diagnostics" then path = "/api/diagnostics"
    transfer.SetUrl("https://www.tatestv.ca" + path)
    body = FormatJson(accountWirePayload(m.top.payload))
    m.top.payload = {}
    m.top.accessToken = ""
    result = { ok: false, status: 0, error: "Unable to connect to your account. Try again shortly. Free viewing is still available." }
    if transfer.AsyncPostFromString(body)
        body = ""
        event = wait(30000, port)
        if type(event) = "roUrlEvent"
            result = accountTransferResult(event.GetResponseCode(), event.GetString())
        else
            transfer.AsyncCancel()
        end if
    end if
    result.requestId = m.top.requestId
    m.top.response = result
end sub

' Unquoted AA keys and dot assignments are lowercased by BrightScript.
' Restore the API's exact JSON spelling here, after the SceneGraph task handoff.
' Bracket insertion preserves case; delete first so an existing lowercase key
' cannot retain its spelling in a case-insensitive associative array.
function accountWirePayload(payload as object) as object
    wire = {}
    for each key in payload
        wire[key] = payload[key]
    end for
    for each key in ["refreshToken", "profileId", "profileGrant", "mediaId", "playbackId", "themeId"]
        if wire.DoesExist(key)
            value = wire[key]
            wire.Delete(key)
            wire[key] = value
        end if
    end for
    return wire
end function

function accountTransferResult(status as integer, response as string) as object
    fallback = "Unable to connect to your account. Try again shortly. Free viewing is still available."
    result = { ok: false, error: fallback }
    serverError = false
    if Len(response) < 150000 and Left(response.Trim(), 1) = "{"
        data = ParseJson(response)
        if type(data) = "roAssociativeArray"
            if type(data.error) = "roString" or type(data.error) = "String"
                serverError = Len(data.error) > 0
            end if
            if data.ok = true or serverError then result = data
        end if
    end if
    result.status = status
    if status < 200 or status >= 300 then result.ok = false
    if result.ok <> true and not serverError
        result.error = fallback
        if status = 404 then result.error = "The TV account connection could not be found. Please try again shortly."
    end if
    return result
end function
