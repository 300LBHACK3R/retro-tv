' Exercises the same response marker gate used by the native network task.
sub main()
    for each path in ["catalog?audience=all", "guide?audience=all", "play?audience=all&id=channel%3A1"]
        ordinaryUrl = rokuApiUrl(path, "America/Edmonton", false)
        publicUrl = rokuApiUrl(path, "America/Edmonton", true)
        check(publicUrl = ordinaryUrl + "&edition=store", "Store request selects its release for " + path)
        check(Instr(1, ordinaryUrl, "edition=") = 0, "Dev request keeps its current feed for " + path)
    end for
    check(acceptsRokuApiResult({ ok: true }, false), "Dev accepts a standard success")
    check(not acceptsRokuApiResult({ ok: true }, true), "Store rejects a success from an older server without an edition marker")
    check(not acceptsRokuApiResult({ ok: true, edition: "dev" }, true), "Store rejects a wrong edition")
    check(not acceptsRokuApiResult({ ok: false, edition: "store" }, true), "Store rejects an explicit API failure")
    check(not acceptsRokuApiResult(invalid, true), "Store rejects malformed responses")
    check(acceptsRokuApiResult({ ok: true, edition: "store" }, true), "Store accepts only its exact successful edition")
    if m.failed <> invalid then stop
    print "PASS: Roku Store request routing and response isolation"
end sub

sub check(condition as boolean, description as string)
    if condition then return
    m.failed = true
    print "FAIL: "; description
end sub
