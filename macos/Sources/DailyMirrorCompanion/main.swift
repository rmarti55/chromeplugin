import AppKit

if CommandLine.arguments.contains("--native-host") {
    NativeMessagingHost.run()
} else {
    DailyMirrorApp.main()
}
