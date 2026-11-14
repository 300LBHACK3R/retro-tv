sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    input = CreateObject("roInput")
    input.SetMessagePort(port)
    scene = screen.CreateScene("TatesScene")
    screen.Show()
    if args <> invalid then scene.launch = args
    ' Normal launches have a usable, packaged home screen without waiting for the feed.
    hasDeepLink = false
    if args <> invalid
        hasDeepLink = args.DoesExist("contentId") and args.DoesExist("mediaType")
    end if
    if not hasDeepLink then scene.CallFunc("markLaunchComplete")

    while true
        event = wait(0, port)
        if type(event) = "roSGScreenEvent"
            if event.IsScreenClosed() then return
        else if type(event) = "roInputEvent"
            if event.IsInput() then scene.launch = event.GetInfo()
        end if
    end while
end sub
