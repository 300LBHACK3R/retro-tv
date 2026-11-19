' Run with brs 0.45.0 and components/Playback.brs. Hash and registry are mocked.
sub main()
    m.failures = 0
    m.now = 1795089600
    m.scope = "ttv-progress-all"
    m.sections = { "ttv-progress-all": {}, "ttv-progress-kids": {}, "ttv-store-progress": {} }
    m.space = 32768
    _brs_.mockFunction("localBookmarkKey", function(id)
        return "k" + Right(id, 15)
    end function)
    _brs_.mockFunction("CreateObject", function(kind, name = invalid)
        if kind = "roRegistrySection" then return testRegistry(name)
        if kind = "roRegistry" then return { GetSpaceAvailable: function(): return globalAA().space: end function }
        if kind = "roDateTime" then return { AsSeconds: function(): return globalAA().now: end function }
        return invalid
    end function)
    m.globalAA = m

    guest = m.sections[m.scope]
    guest["media:legacy"] = "124:1795089540"
    guest["media:untimed"] = "105"
    check(readProgressPosition("media:legacy") = 124, "Existing decimal records resume after an upgrade")
    check(readProgressPosition("media:untimed") = 105, "Existing records without timestamps still resume")
    writeLocalProgress("media:legacy", 126)
    check(readProgressPosition("media:legacy") = 126 and not guest.DoesExist("media:legacy"), "Writing migrates a legacy record atomically")
    for index = 1 to 450
        writeLocalProgress("media:programme-" + index.ToStr(), 111)
    end for
    check(readProgressPosition("media:programme-1") = 111, "Saving more than 30 titles does not evict recent bookmarks")
    m.scope = "ttv-progress-kids"
    check(readProgressPosition("media:programme-1") = invalid, "Guest bookmark scopes stay separate")
    writeLocalProgress("media:programme-1", 191)
    check(readProgressPosition("media:programme-1") = 191, "The Kids profile keeps its own resume point")
    m.scope = "ttv-progress-all"
    check(readProgressPosition("media:programme-1") = 111, "The main profile keeps its own resume point")

    m.now = m.now - 30 * 86400 - 1
    writeLocalProgress("media:expired", 210)
    m.now = m.now + 1
    writeLocalProgress("media:boundary", 211)
    m.now = m.now + 30 * 86400
    m.space = 4000
    writeLocalProgress("media:under-pressure", 212)
    check(readProgressPosition("media:expired") = invalid, "Space pressure prunes records past 30 days")
    check(readProgressPosition("media:boundary") = 211, "A bookmark exactly 30 days old is still protected")
    check(readProgressPosition("media:programme-1") = 111, "Recent bookmarks are not evicted when the registry is full")
    check(readProgressPosition("media:under-pressure") = invalid, "An exhausted registry does not discard a recent entry to fit a new one")

    m.space = 32000
    m.fullStoreEdition = true
    clearProgress("media:programme-1")
    check(readProgressPosition("media:programme-1") = -1, "Finished episodes keep a smart bookmark")
    m.cloudMode = true
    m.cloudProgress = { "programme-1": { position: 305 } }
    check(readProgressPosition("media:programme-1") = 305, "A signed-in profile uses its cloud bookmark")
    check(readProgressPosition("media:programme-2") = invalid, "Signed-in playback cannot see guest records")
    if m.failures > 0 then stop
    print "PASS: guest bookmark minimum retention, profile isolation, legacy migration and completion markers"
end sub

function globalAA() as object
    return GetGlobalAA().globalAA
end function

function testRegistry(name as string) as object
    return { values: globalAA().sections[name],
        GetKeyList: function(): return m.values.Keys(): end function,
        Read: function(id)
            value = m.values[id]
            if value = invalid then return ""
            return value
        end function,
        Write: function(id,value)
            m.values[id] = value
            return true
        end function,
        Delete: function(id)
            return m.values.Delete(id)
        end function,
        Flush: function(): return true: end function }
end function

function audience() as string
    if m.scope = "ttv-progress-kids" then return "kids"
    return "all"
end function

function cloudProfile() as boolean
    return m.cloudMode = true
end function

sub check(ok as boolean, message as string)
    if ok then return
    m.failures++
    print "FAIL: "; message
end sub
