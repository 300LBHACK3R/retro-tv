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
    storeEdition = CreateObject("roAppInfo").GetValue("ttv_store_edition") = "1"
    transfer.SetUrl(rokuApiUrl(m.top.path, zone, storeEdition))
    result = { ok: false, error: "Unable to connect. Check your connection and try Refresh." }
    if transfer.AsyncGetToString()
        event = wait(15000, port)
        if type(event) = "roUrlEvent"
            if event.GetResponseCode() = 200
                body = event.GetString()
                if Len(body) < 4000000
                    data = ParseJson(body)
                    if acceptsRokuApiResult(data, storeEdition) then result = data
                end if
            end if
        else
            transfer.AsyncCancel()
        end if
    end if
    result.requestId = m.top.requestId
    m.top.response = result
end sub

function rokuApiUrl(path as string, zone as string, storeEdition as boolean) as string
    path = path + "&tz=" + zone.EncodeUriComponent()
    if storeEdition then path = path + "&edition=store"
    return "https://www.tatestv.ca/api/roku/" + path
end function

function acceptsRokuApiResult(data as dynamic, storeEdition as boolean) as boolean
    if type(data) <> "roAssociativeArray" then return false
    if data.ok <> true then return false
    ' An older server may ignore edition=store and return its regular lineup.
    if storeEdition and data.edition <> "store" then return false
    return true
end function
