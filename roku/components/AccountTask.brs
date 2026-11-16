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
    body = FormatJson(m.top.payload)
    m.top.payload = {}
    m.top.accessToken = ""
    result = { ok: false, status: 0, error: "Unable to connect to your account. Try again shortly. Free viewing is still available." }
    if transfer.AsyncPostFromString(body)
        body = ""
        event = wait(30000, port)
        if type(event) = "roUrlEvent"
            status = event.GetResponseCode()
            response = event.GetString()
            if Len(response) < 150000
                data = ParseJson(response)
                if type(data) = "roAssociativeArray"
                    if data.ok = true or type(data.error) = "roString" then result = data
                end if
            end if
            result.status = status
            if status = 404 then result.error = "This TV account update is not available on the server yet. You can keep watching for free."
        else
            transfer.AsyncCancel()
        end if
    end if
    result.requestId = m.top.requestId
    m.top.response = result
end sub
