import SwiftUI

struct DailyMirrorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var tracker = AppTracker.shared

    var body: some Scene {
        MenuBarExtra("Daily Mirror", systemImage: "clock.arrow.circlepath") {
            MenuBarView()
                .environmentObject(tracker)
        }
        .menuBarExtraStyle(.menu)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        AppTracker.shared.start()
    }
}

struct MenuBarView: View {
    @EnvironmentObject var tracker: AppTracker

    var body: some View {
        Text("Device presence: \(SessionDeriver.formatDuration(tracker.todayPresenceSeconds))")
        Text("Active use: \(SessionDeriver.formatDuration(tracker.todayActiveSeconds))")

        if !tracker.topApps.isEmpty {
            Divider()
            Section("Other apps today") {
                ForEach(tracker.topApps.prefix(6), id: \.bundleId) { app in
                    Text("\(app.name) — \(SessionDeriver.formatDuration(app.presenceSeconds))")
                }
            }
        }

        Divider()
        Button("Quit Daily Mirror") {
            NSApplication.shared.terminate(nil)
        }
    }
}
