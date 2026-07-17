import Foundation

struct AppSession: Codable {
    var bundleId: String
    var name: String
    var presenceSeconds: Int
    var activeSeconds: Int
}

struct HourlyAppSlice: Codable {
    var bundleId: String
    var name: String
    var seconds: Int
}

struct TimelineEntry: Codable {
    var hour: String
    var hourStartTs: Int64
    var activity: String
    var total: Int
    var apps: [HourlyAppSlice]
}

struct CategoryBreakdown: Codable {
    var name: String
    var seconds: Int
    var minutes: Int
}

struct DayMetricsPayload: Codable {
    var date: String
    var presenceSeconds: Int
    var activeSeconds: Int
    var apps: [AppSession]
    var timeline: [TimelineEntry]
    var categories: [CategoryBreakdown]
    var deviceId: String
    var syncedDevices: [String]
}

private struct TrackerState {
    var bundleId: String?
    var appName: String?
    var presenceCounting = false
    var activeCounting = false
}

enum SessionDeriver {
    static func eventsForDay(_ dateStr: String, now: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) -> [MirrorEvent] {
        guard let (start, end) = dayBounds(for: dateStr) else { return [] }
        let clipEnd = min(end, now + 1)
        var events = EventStore.shared.events(from: start, to: clipEnd)
        if let preceding = EventStore.shared.lastEvent(before: start) {
            events.insert(preceding, at: 0)
        }
        return events
    }

    static func computeDayMetrics(dateStr: String, deviceId: String, syncedDevices: [String] = []) -> DayMetricsPayload? {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        guard let (start, end) = dayBounds(for: dateStr) else { return nil }
        let events = eventsForDay(dateStr, now: now)
        let apps = computeAppSessions(events: events, dayStart: start, dayEnd: end, now: now)
        let timeline = computeHourly(events: events, dayStart: start, dayEnd: end, now: now)
        let categories = AppCategories.categorize(apps)
        let presenceSeconds = apps.reduce(0) { $0 + $1.presenceSeconds }
        let activeSeconds = apps.reduce(0) { $0 + $1.activeSeconds }
        return DayMetricsPayload(
            date: dateStr,
            presenceSeconds: presenceSeconds,
            activeSeconds: activeSeconds,
            apps: apps.sorted { $0.presenceSeconds > $1.presenceSeconds },
            timeline: timeline,
            categories: categories,
            deviceId: deviceId,
            syncedDevices: syncedDevices
        )
    }

    static func computeAppSessions(events: [MirrorEvent], dayStart: Int64, dayEnd: Int64, now: Int64) -> [AppSession] {
        let clipHi = min(dayEnd, now)
        var byApp: [String: (name: String, presence: Double, active: Double)] = [:]
        var presence = TrackerState()
        var active = TrackerState()
        var lastTs: Int64?

        func touch(_ bundleId: String, _ name: String) {
            if byApp[bundleId] == nil {
                byApp[bundleId] = (name: name, presence: 0, active: 0)
            } else if !name.isEmpty {
                byApp[bundleId]?.name = name
            }
        }

        func accruePresence(until: Int64) {
            guard let last = lastTs, presence.presenceCounting,
                  let bid = presence.bundleId, let name = presence.appName else { return }
            let gap = until - last
            guard gap <= Int64(MirrorConstants.maxGapSeconds * 1000) else { return }
            let a = max(last, dayStart)
            let b = min(until, clipHi)
            guard b > a else { return }
            touch(bid, name)
            byApp[bid]?.presence += Double(b - a) / 1000
        }

        func accrueActive(until: Int64) {
            guard let last = lastTs, active.activeCounting,
                  let bid = active.bundleId, let name = active.appName else { return }
            let gap = until - last
            guard gap <= Int64(MirrorConstants.maxGapSeconds * 1000) else { return }
            let a = max(last, dayStart)
            let b = min(until, clipHi)
            guard b > a else { return }
            touch(bid, name)
            byApp[bid]?.active += Double(b - a) / 1000
        }

        func applyPresence(_ ev: MirrorEvent) {
            switch ev.type {
            case "app_activate":
                if let bid = ev.bundleId {
                    presence.bundleId = bid
                    presence.appName = ev.appName ?? bid
                    presence.presenceCounting = true
                }
            case "app_blur", "locked":
                presence.presenceCounting = false
            case "idle":
                break
            default:
                break
            }
        }

        func applyActive(_ ev: MirrorEvent) {
            switch ev.type {
            case "app_activate":
                if let bid = ev.bundleId {
                    active.bundleId = bid
                    active.appName = ev.appName ?? bid
                    active.activeCounting = true
                }
            case "app_blur", "idle", "locked":
                active.activeCounting = false
            case "active":
                if let bid = active.bundleId ?? presence.bundleId {
                    active.bundleId = bid
                    active.appName = active.appName ?? presence.appName ?? bid
                    active.activeCounting = true
                }
            default:
                break
            }
        }

        for ev in events {
            accruePresence(until: ev.ts)
            accrueActive(until: ev.ts)
            applyPresence(ev)
            applyActive(ev)
            lastTs = ev.ts
        }
        accruePresence(until: clipHi)
        accrueActive(until: clipHi)

        return byApp.map { bid, v in
            AppSession(
                bundleId: bid,
                name: v.name,
                presenceSeconds: Int(v.presence.rounded()),
                activeSeconds: Int(v.active.rounded())
            )
        }
        .filter { $0.presenceSeconds > 0 || $0.activeSeconds > 0 }
    }

    static func computeHourly(events: [MirrorEvent], dayStart: Int64, dayEnd: Int64, now: Int64) -> [TimelineEntry] {
        let clipHi = min(dayEnd, now)
        var hours: [Int64: [String: (name: String, seconds: Double)]] = [:]
        var state = TrackerState()
        var lastTs: Int64?

        func addChunk(from: Int64, to: Int64) {
            guard let bid = state.bundleId, let name = state.appName, state.activeCounting else { return }
            var cur = from
            while cur < to {
                let d = Date(timeIntervalSince1970: TimeInterval(cur) / 1000)
                var comps = Calendar.current.dateComponents([.year, .month, .day, .hour], from: d)
                comps.minute = 0
                comps.second = 0
                comps.nanosecond = 0
                let hs = Int64(Calendar.current.date(from: comps)!.timeIntervalSince1970 * 1000)
                let chunkEnd = min(to, hs + 3_600_000)
                var bucket = hours[hs, default: [:]]
                var entry = bucket[bid, default: (name: name, seconds: 0)]
                entry.seconds += Double(chunkEnd - cur) / 1000
                bucket[bid] = entry
                hours[hs] = bucket
                cur = chunkEnd
            }
        }

        func accrue(until: Int64) {
            guard let last = lastTs, state.activeCounting else { return }
            let gap = until - last
            guard gap <= Int64(MirrorConstants.maxGapSeconds * 1000) else { return }
            let a = max(last, dayStart)
            let b = min(until, clipHi)
            guard b > a else { return }
            addChunk(from: a, to: b)
        }

        for ev in events {
            accrue(until: ev.ts)
            switch ev.type {
            case "app_activate":
                if let bid = ev.bundleId {
                    state.bundleId = bid
                    state.appName = ev.appName ?? bid
                    state.activeCounting = true
                }
            case "app_blur", "idle", "locked":
                state.activeCounting = false
            case "active":
                if let bid = state.bundleId {
                    state.activeCounting = true
                    state.appName = state.appName ?? bid
                }
            default:
                break
            }
            lastTs = ev.ts
        }
        accrue(until: clipHi)

        return hours.keys.sorted().compactMap { hs -> TimelineEntry? in
            let apps = hours[hs]!.map { bid, v in
                HourlyAppSlice(bundleId: bid, name: v.name, seconds: Int(v.seconds.rounded()))
            }
            .filter { $0.seconds > 0 }
            .sorted { $0.seconds > $1.seconds }
            guard !apps.isEmpty else { return nil }
            let total = apps.reduce(0) { $0 + $1.seconds }
            let activity = apps.prefix(2).map { "\($0.name) (\(formatDuration($0.seconds)))" }.joined(separator: ", ")
            return TimelineEntry(hour: formatHourLabel(hs), hourStartTs: hs, activity: activity, total: total, apps: apps)
        }
    }

    static func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        let m = seconds / 60
        let s = seconds % 60
        if m < 60 { return s > 0 ? "\(m)m \(s)s" : "\(m)m" }
        let h = m / 60
        let mm = m % 60
        return mm > 0 ? "\(h)h \(mm)m" : "\(h)h"
    }
}
