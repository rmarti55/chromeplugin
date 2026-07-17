import SwiftUI

struct DailyMirrorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var tracker = AppTracker.shared

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
}

struct MenuBarView: View {
    @EnvironmentObject var tracker: AppTracker

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Daily Mirror")
                .font(.headline)
                .foregroundStyle(.primary)

            VStack(alignment: .leading, spacing: 4) {
                Label {
                    Text(SessionDeriver.formatDuration(tracker.todayPresenceSeconds))
                        .foregroundStyle(.primary)
                } icon: {
                    Text("In front")
                        .foregroundStyle(.secondary)
                        .frame(width: 64, alignment: .leading)
                }
                Label {
                    Text(SessionDeriver.formatDuration(tracker.todayActiveSeconds))
                        .foregroundStyle(.primary)
                } icon: {
                    Text("In use")
                        .foregroundStyle(.secondary)
                        .frame(width: 64, alignment: .leading)
                }
            }
            .font(.subheadline)

            if !tracker.topApps.isEmpty {
                Divider()
                Text("Other apps today")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(tracker.topApps.prefix(6), id: \.bundleId) { app in
                    HStack {
                        Text(app.name)
                            .foregroundStyle(.primary)
                        Spacer()
                        Text(SessionDeriver.formatDuration(app.presenceSeconds))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .font(.caption)
                }
            }

            Divider()
            HStack {
                Spacer()
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
        }
        .padding(14)
        .frame(width: 260)
    }
}
