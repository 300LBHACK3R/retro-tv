sub main()
    m.top = { enabled: false, nodes: {}, FindNode: function(id)
        if m.nodes[id] = invalid then m.nodes[id] = node()
        return m.nodes[id]
    end function }
    init()
    check(m.top.FindNode("snow").children.Count() = 32, "Snow uses a bounded number of sprites")
    check(not m.top.visible and m.top.FindNode("fall").control = "stop", "Motion starts dormant")
    m.top.enabled = true
    updateMotion()
    check(m.top.visible and m.top.FindNode("fall").control = "start" and m.top.FindNode("flicker").control = "start", "Visible winter scene animates snow and light")
    m.top.enabled = false
    updateMotion()
    check(not m.top.visible and m.top.FindNode("fall").control = "stop" and m.top.FindNode("flicker").control = "stop", "Disabling the scene stops both animations")
    if m.failed = true then stop
    print "PASS: bounded snowfall and light animation lifecycle"
end sub
function node() as object
    return { children: [], CreateChild: function(kind)
        child = {}
        m.children.Push(child)
        return child
    end function }
end function
sub check(condition as boolean, description as string)
    if condition then return
    m.failed = true
    print "FAIL: "; description
end sub
