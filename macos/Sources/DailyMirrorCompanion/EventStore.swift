import Foundation

struct MirrorEvent: Codable {
    var ts: Int64
    var type: String
    var bundleId: String?
    var appName: String?
}

final class EventStore {
    static let shared = EventStore()

    private let queue = DispatchQueue(label: "com.dailymirror.events", qos: .utility)
    private let fileURL: URL

    private init() {
        fileURL = MirrorPaths.dailyMirrorDirectory.appendingPathComponent("events.jsonl")
        pruneOldEvents()
    }

    func append(_ event: MirrorEvent) {
        queue.sync {
            guard let line = try? JSONEncoder().encode(event),
                  var str = String(data: line, encoding: .utf8) else { return }
            str.append("\n")
            guard let payload = str.data(using: .utf8) else { return }
            if FileManager.default.fileExists(atPath: fileURL.path) {
                if let handle = try? FileHandle(forWritingTo: fileURL) {
                    handle.seekToEndOfFile()
                    handle.write(payload)
                    try? handle.close()
                }
            } else {
                try? payload.write(to: fileURL, options: .atomic)
            }
        }
    }

    func events(from startTs: Int64, to endTs: Int64) -> [MirrorEvent] {
        queue.sync {
            guard let data = try? String(contentsOf: fileURL, encoding: .utf8) else { return [] }
            let cutoff = Int64(Date().timeIntervalSince1970 * 1000) - Int64(MirrorConstants.retentionDays * 24 * 60 * 60 * 1000)
            return data
                .split(separator: "\n", omittingEmptySubsequences: true)
                .compactMap { line -> MirrorEvent? in
                    guard let ev = try? JSONDecoder().decode(MirrorEvent.self, from: Data(line.utf8)) else { return nil }
                    return ev.ts >= max(startTs, cutoff) && ev.ts < endTs ? ev : nil
                }
                .sorted { $0.ts < $1.ts }
        }
    }

    func lastEvent(before ts: Int64) -> MirrorEvent? {
        queue.sync {
            guard let data = try? String(contentsOf: fileURL, encoding: .utf8) else { return nil }
            return data
                .split(separator: "\n", omittingEmptySubsequences: true)
                .compactMap { try? JSONDecoder().decode(MirrorEvent.self, from: Data($0.utf8)) }
                .filter { $0.ts < ts }
                .max(by: { $0.ts < $1.ts })
        }
    }

    func lastEvent() -> MirrorEvent? {
        queue.sync {
            guard let data = try? String(contentsOf: fileURL, encoding: .utf8) else { return nil }
            return data
                .split(separator: "\n", omittingEmptySubsequences: true)
                .compactMap { try? JSONDecoder().decode(MirrorEvent.self, from: Data($0.utf8)) }
                .max(by: { $0.ts < $1.ts })
        }
    }

    private func pruneOldEvents() {
        queue.async {
            let cutoff = Int64(Date().timeIntervalSince1970 * 1000) - Int64(MirrorConstants.retentionDays * 24 * 60 * 60 * 1000)
            guard let data = try? String(contentsOf: self.fileURL, encoding: .utf8) else { return }
            let kept = data
                .split(separator: "\n", omittingEmptySubsequences: true)
                .filter { line in
                    guard let ev = try? JSONDecoder().decode(MirrorEvent.self, from: Data(line.utf8)) else { return false }
                    return ev.ts >= cutoff
                }
                .joined(separator: "\n")
            let out = kept.isEmpty ? "" : kept + "\n"
            try? out.write(to: self.fileURL, atomically: true, encoding: .utf8)
        }
    }
}

func dayBounds(for dateStr: String) -> (start: Int64, end: Int64)? {
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    fmt.timeZone = .current
    guard let startDate = fmt.date(from: dateStr) else { return nil }
    let start = Int64(startDate.timeIntervalSince1970 * 1000)
    guard let endDate = Calendar.current.date(byAdding: .day, value: 1, to: startDate) else { return nil }
    let end = Int64(endDate.timeIntervalSince1970 * 1000)
    return (start, end)
}

func todayDateStr() -> String {
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    fmt.timeZone = .current
    return fmt.string(from: Date())
}

func formatHourLabel(_ ts: Int64) -> String {
    let d = Date(timeIntervalSince1970: TimeInterval(ts) / 1000)
    let h = Calendar.current.component(.hour, from: d)
    let ap = h < 12 ? "am" : "pm"
    let hr = h % 12 == 0 ? 12 : h % 12
    return "\(hr)\(ap)"
}
