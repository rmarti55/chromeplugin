import AppKit
import CoreGraphics
import Foundation

final class AppTracker: ObservableObject {
    static let shared = AppTracker()

    @Published private(set) var todayPresenceSeconds = 0
    @Published private(set) var todayActiveSeconds = 0
    @Published private(set) var topApps: [AppSession] = []

    private var idleTimer: Timer?
    private var isIdle = false
    private var isLocked = false
    private var currentBundleId: String?
    private var refreshTimer: Timer?

    private init() {}

    func start() {
        recordFrontmost(reason: "launch")
        subscribeWorkspace()
        subscribeLockSleep()
        idleTimer = Timer.scheduledTimer(withTimeInterval: MirrorConstants.idlePollInterval, repeats: true) { [weak self] _ in
            self?.checkIdle()
        }
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.refreshToday()
        }
        refreshToday()
    }

    private func subscribeWorkspace() {
        let nc = NSWorkspace.shared.notificationCenter
        nc.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else { return }
            self?.handleActivate(app: app)
        }
        nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.recordFrontmost(reason: "wake")
        }
        nc.addObserver(forName: NSWorkspace.sessionDidBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.isLocked = false
            self?.append(type: "active")
            self?.recordFrontmost(reason: "session_active")
        }
        nc.addObserver(forName: NSWorkspace.sessionDidResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.handleLock()
        }
        nc.addObserver(forName: NSWorkspace.screensDidSleepNotification, object: nil, queue: .main) { [weak self] _ in
            self?.handleLock()
        }
    }

    private func subscribeLockSleep() {
        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(forName: NSNotification.Name("com.apple.screenIsLocked"), object: nil, queue: .main) { [weak self] _ in
            self?.handleLock()
        }
        dnc.addObserver(forName: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil, queue: .main) { [weak self] _ in
            self?.isLocked = false
            self?.append(type: "active")
            self?.recordFrontmost(reason: "unlock")
        }
    }

    private func handleActivate(app: NSRunningApplication) {
        isIdle = false
        guard let bid = app.bundleIdentifier else { return }
        currentBundleId = bid
        append(type: "app_activate", bundleId: bid, appName: app.localizedName ?? bid)
        refreshToday()
        Task { await CloudKitSync.shared.uploadTodayIfNeeded() }
    }

    private func recordFrontmost(reason: String) {
        guard let app = NSWorkspace.shared.frontmostApplication,
              let bid = app.bundleIdentifier else { return }
        currentBundleId = bid
        append(type: "app_activate", bundleId: bid, appName: app.localizedName ?? bid)
    }

    private func handleLock() {
        guard !isLocked else { return }
        isLocked = true
        append(type: "locked")
    }

    private func checkIdle() {
        guard !isLocked else { return }
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .null)
        let threshold = MirrorConstants.idleSeconds
        if idle >= threshold && !isIdle {
            isIdle = true
            append(type: "idle")
        } else if idle < threshold && isIdle {
            isIdle = false
            append(type: "active")
        }
    }

    private func append(type: String, bundleId: String? = nil, appName: String? = nil) {
        let ev = MirrorEvent(
            ts: Int64(Date().timeIntervalSince1970 * 1000),
            type: type,
            bundleId: bundleId ?? currentBundleId,
            appName: appName
        )
        EventStore.shared.append(ev)
    }

    func refreshToday() {
        let date = todayDateStr()
        let deviceId = DeviceIdentity.id
        if let metrics = SessionDeriver.computeDayMetrics(dateStr: date, deviceId: deviceId) {
            todayPresenceSeconds = metrics.presenceSeconds
            todayActiveSeconds = metrics.activeSeconds
            topApps = metrics.apps.filter { !MirrorConstants.chromeBundleIds.contains($0.bundleId) }
        }
    }
}

enum DeviceIdentity {
    private static let key = "deviceId"

    static var id: String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key) { return existing }
        let id = UUID().uuidString
        defaults.set(id, forKey: key)
        return id
    }
}
