import AppKit
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
    @State private var openAtLogin = LoginItemManager.isEnabled
    @State private var loginItemError: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Daily Mirror")
                .font(.headline)
                .foregroundStyle(.primary)

            statusRow
            bridgeRow

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

            Toggle("Open at Login", isOn: $openAtLogin)
                .font(.caption)
                .onChange(of: openAtLogin) { enabled in
                    do {
                        try LoginItemManager.setEnabled(enabled)
                        loginItemError = nil
                    } catch {
                        loginItemError = error.localizedDescription
                        openAtLogin = LoginItemManager.isEnabled
                    }
                }

            if let loginItemError {
                Text(loginItemError)
                    .font(.caption2)
                    .foregroundStyle(.red)
            }

            HStack(spacing: 8) {
                Button("Open data folder") {
                    NSWorkspace.shared.open(BridgeStatus.dataDirectoryURL)
                }
                .font(.caption)

                Button("Copy install hint") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(BridgeStatus.installHint, forType: .string)
                }
                .font(.caption)
            }

            Divider()

            HStack {
                Text("v\(MirrorConstants.companionVersion)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Spacer()
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
        }
        .padding(14)
        .frame(width: 300)
        .onAppear {
            openAtLogin = LoginItemManager.isEnabled
            tracker.refreshBridgeStatus()
        }
    }

    private var statusRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusLabel)
                .font(.caption.weight(.medium))
                .foregroundStyle(.primary)
        }
    }

    private var bridgeRow: some View {
        Text(tracker.bridgeStatus)
            .font(.caption)
            .foregroundStyle(bridgeColor)
    }

    private var statusLabel: String {
        switch tracker.captureStatus {
        case "capturing":
            return "Capturing desktop activity"
        case "idle":
            return "Idle — clocks paused"
        case "locked":
            return "Screen locked"
        default:
            return "Starting tracker…"
        }
    }

    private var statusColor: Color {
        switch tracker.captureStatus {
        case "capturing":
            return .green
        case "idle":
            return .yellow
        case "locked":
            return .orange
        default:
            return .gray
        }
    }

    private var bridgeColor: Color {
        switch BridgeStatus.evaluate() {
        case .installed:
            return .secondary
        default:
            return .orange
        }
    }
}
