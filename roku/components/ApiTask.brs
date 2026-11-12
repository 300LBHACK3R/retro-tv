sub init()
    m.top.functionName = "fetchJson"
end sub

sub fetchJson()
    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.SetMessagePort(port)
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.EnablePeerVerification(true)
    transfer.EnableHostVerification(true)
    transfer.AddHeader("Accept", "application/json")
    zone = CreateObject("roDeviceInfo").GetTimeZone()
    transfer.SetUrl("https://www.tatestv.ca/api/roku/" + m.top.path + "&tz=" + zone.EncodeUriComponent())
    result = { ok: false, error: "Unable to connect. Check your connection and try Refresh." }
    if transfer.AsyncGetToString()
        event = wait(15000, port)
        if type(event) = "roUrlEvent"
            if event.GetResponseCode() = 200
                body = event.GetString()
                if Len(body) < 4000000
                    data = ParseJson(body)
                    if type(data) = "roAssociativeArray"
                        if data.ok = true then result = data
                    end if
                end if
            end if
        else
            transfer.AsyncCancel()
        end if
    end if
    result.requestId = m.top.requestId
    m.top.response = result
end sub
