import SwiftUI

struct DailyMirrorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var tracker = AppTracker.shared

    var body: some Scene {
        MenuBarExtra("Daily Mirror", systemImage: "clock.arrow.circlepath") {
            MenuBarView()
                .environmentObject(tracker)
        }
        .menuBarExtraStyle(.window)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        AppTracker.shared.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        Task { await CloudKitSync.shared.uploadTodayIfNeeded() }
    }
}

struct MenuBarView: View {
    @EnvironmentObject var tracker: AppTracker

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Daily Mirror")
                .font(.headline)
            Text("Device presence: \(SessionDeriver.formatDuration(tracker.todayPresenceSeconds))")
                .font(.subheadline)
            Text("Active use: \(SessionDeriver.formatDuration(tracker.todayActiveSeconds))")
                .font(.caption)
                .foregroundStyle(.secondary)

            if !tracker.topApps.isEmpty {
                Divider()
                Text("Other apps today")
                    .font(.caption.bold())
                ForEach(tracker.topApps.prefix(6), id: \.bundleId) { app in
                    HStack {
                        Text(app.name)
                        Spacer()
                        Text(SessionDeriver.formatDuration(app.presenceSeconds))
                            .foregroundStyle(.secondary)
                    }
                    .font(.caption)
                }
            }

            Divider()
            Text("Chrome site detail stays in the extension dashboard.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: 280)
    }
}
