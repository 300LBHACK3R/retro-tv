sub init()
    snow = m.top.FindNode("snow")
    ' Sixteen sprites, duplicated one viewport apart for a seamless slow loop.
    for i = 0 to 15
        for offset = 0 to 1
            flake = snow.CreateChild("Poster")
            flake.uri = "pkg:/images/winter-flake.png"
            flake.width = 3 + (i mod 3)
            flake.height = flake.width
            flake.opacity = 0.25 + (i mod 3) * 0.12
            flake.translation = [(i * 197) mod 1280, (i * 113) mod 720 + offset * 720]
        end for
    end for
    updateMotion()
end sub
sub updateMotion()
    m.top.visible = m.top.enabled
    command = "stop"
    if m.top.enabled then command = "start"
    m.top.FindNode("fall").control = command
    m.top.FindNode("flicker").control = command
end sub
