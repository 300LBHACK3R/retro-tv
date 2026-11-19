sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    input = CreateObject("roInput")
    input.SetMessagePort(port)
    deviceInfo = CreateObject("roDeviceInfo")
    memoryMonitor = CreateObject("roAppMemoryMonitor")
    ' The full set of memory queries is available starting with Roku OS 13.
    if memoryMonitor <> invalid and Val(deviceInfo.GetOSVersion().major) >= 13
        memoryMonitor.SetMessagePort(port)
        if not memoryMonitor.EnableMemoryWarningEvent(true) then memoryMonitor = invalid
    else
        memoryMonitor = invalid
    end if
    if memoryMonitor = invalid
        deviceInfo.SetMessagePort(port)
        deviceInfo.EnableLowGeneralMemoryEvent(true)
    end if
    scene = screen.CreateScene("TatesScene")
    screen.Show()
    scene.CallFunc("startApp", args)

    while true
        event = wait(0, port)
        eventType = type(event)
        if eventType = "roSGScreenEvent"
            if event.IsScreenClosed() then return
        else if eventType = "roInputEvent"
            if event.IsInput() then scene.launch = event.GetInfo()
        else if eventType = "roAppMemoryNotificationEvent" and memoryMonitor <> invalid
            usedPercent = event.GetInfo().Lookup("memoryUsagePercent")
            if usedPercent = invalid then usedPercent = memoryMonitor.GetMemoryLimitPercent()
            availableKb = memoryMonitor.GetChannelAvailableMemory()
            if usedPercent >= 80 or (availableKb >= 0 and availableKb <= 8192)
                print "Memory pressure. Used percent: "; usedPercent; " available KB: "; availableKb; " limits: "; memoryMonitor.GetChannelMemoryLimit()
                scene.CallFunc("releaseInactiveMemory")
            end if
        else if eventType = "roDeviceInfoEvent"
            level = event.GetInfo().Lookup("generalMemoryLevel")
            if level = "low" or level = "critical" then scene.CallFunc("releaseInactiveMemory")
        end if
    end while
end sub
