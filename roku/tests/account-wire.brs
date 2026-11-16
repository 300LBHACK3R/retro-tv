sub main()
    ' Explicitly reproduce physical Roku's lowercase keys. brs 0.45.0 preserves
    ' unquoted literal spelling, so camelCase fixtures would hide this defect.
    payload = { action: "progress", refreshtoken: "refresh-fixture", profileid: "main", mediaid: "episode-one", playbackid: "playback-fixture", themeid: "neon-noel", position: 25, revision: 3, sequence: 4, saved: true }
    payload.profilegrant = "grant-fixture"
    before = FormatJson(payload)
    wire = FormatJson(accountWirePayload(payload))
    for each key in ["refreshToken", "profileId", "profileGrant", "mediaId", "playbackId", "themeId"]
        check(Instr(1, wire, Chr(34) + key + Chr(34)) > 0, "JSON preserves " + key)
        check(Instr(1, wire, Chr(34) + LCase(key) + Chr(34)) = 0, "JSON omits lowercase alias for " + key)
    end for
    check(FormatJson(payload) = before, "Encoding does not change the queued request")
    decoded = ParseJson(wire)
    check(decoded.position = 25 and decoded.revision = 3 and decoded.saved = true, "Numbers and booleans retain their JSON types")
    quoted = { "profileId": "main", "refreshToken": "refresh-fixture" }
    check(FormatJson(accountWirePayload(quoted)) = FormatJson(quoted), "Already-canonical keys are preserved")
    ' brs 0.45.0 does not emulate FormatJson escaping; retain the platform
    ' serializer and verify that our key normalization never changes values.
    password = "Fixture Case-Sensitive & 42"
    credentials = ParseJson(FormatJson(accountWirePayload({ action: "signin", email: "fixture@example.invalid", password: password })))
    check(credentials.password = password and credentials.email = "fixture@example.invalid", "Credential values are not changed by key normalization")

    missing = accountTransferResult(404, FormatJson({ ok: false, error: "That profile is no longer available. Refresh your account." }))
    check(missing.ok = false and missing.status = 404 and missing.error = "That profile is no longer available. Refresh your account.", "A profile 404 keeps the actionable server error")
    offline = accountTransferResult(503, FormatJson({ ok: false, error: "Saved viewing is temporarily unavailable." }))
    check(offline.error = "Saved viewing is temporarily unavailable.", "JSON errors are accepted for intrinsic and boxed strings")
    absent = accountTransferResult(404, "<html>Not found</html>")
    check(absent.ok = false and Instr(1, absent.error, "server yet") = 0, "A missing route does not claim the deployment is unpublished")
    success = accountTransferResult(200, FormatJson({ ok: true, profile: { id: "main" } }))
    check(success.ok = true and success.profile.id = "main", "Successful response data is retained")
    failedStatus = accountTransferResult(500, FormatJson({ ok: true }))
    check(failedStatus.ok = false and Len(failedStatus.error) > 0, "An HTTP failure cannot be treated as a successful request")
    if m.failed > 0 then stop
    print "PASS: exact API JSON keys, credential preservation, typed values and actionable account errors"
end sub

sub check(condition as boolean, description as string)
    if m.failed = invalid then m.failed = 0
    if condition then return
    m.failed++
    print "FAIL: "; description
end sub
