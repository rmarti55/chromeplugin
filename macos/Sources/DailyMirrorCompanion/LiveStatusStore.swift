import Foundation

struct LiveStatusSnapshot: Codable {
    var ts: Int64
    var status: String
    var bundleId: String?
    var appName: String?
    var version: String
}

final class LiveStatusStore {
    static let shared = LiveStatusStore()

    static let companionVersion = "0.1.0"
    static let staleThresholdMs: Int64 = 15_000

    private let queue = DispatchQueue(label: "com.dailymirror.live", qos: .utility)
    private let fileURL: URL

    private init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("DailyMirror", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("live.json")
    }

    func write(status: String, bundleId: String?, appName: String?) {
        let snapshot = LiveStatusSnapshot(
            ts: Int64(Date().timeIntervalSince1970 * 1000),
            status: status,
            bundleId: bundleId,
            appName: appName,
            version: Self.companionVersion
        )
        queue.sync {
            guard let data = try? JSONEncoder().encode(snapshot) else { return }
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    func read() -> LiveStatusSnapshot? {
        queue.sync {
            guard let data = try? Data(contentsOf: fileURL),
                  let snapshot = try? JSONDecoder().decode(LiveStatusSnapshot.self, from: data) else {
                return nil
            }
            return snapshot
        }
    }

    /// Response shape for native messaging GET_LIVE.
    static func bridgeResponse() -> [String: Any] {
        guard let snapshot = shared.read() else {
            return ["ok": false, "reason": "missing"]
        }
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if now - snapshot.ts > staleThresholdMs {
            return ["ok": false, "reason": "stale", "ts": snapshot.ts]
        }
        return [
            "ok": true,
            "status": snapshot.status,
            "bundleId": snapshot.bundleId as Any,
            "appName": snapshot.appName as Any,
            "ts": snapshot.ts,
            "version": snapshot.version,
        ]
    }
}
