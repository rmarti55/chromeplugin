import Foundation

enum AppCategories {
    private static let rules: [String: String] = [
        "com.tinyspeck.slackmacgap": "Communication",
        "com.hnc.Discord": "Communication",
        "com.apple.MobileSMS": "Communication",
        "com.apple.mail": "Communication",
        "com.microsoft.teams2": "Communication",
        "com.microsoft.teams": "Communication",
        "us.zoom.xos": "Communication",
        "com.google.Chrome": "Research",
        "com.google.Chrome.canary": "Research",
        "com.apple.Safari": "Research",
        "org.mozilla.firefox": "Research",
        "com.microsoft.edgemac": "Research",
        "com.todesktop.230313mzl4w4u92": "Software Development",
        "com.microsoft.VSCode": "Software Development",
        "com.apple.dt.Xcode": "Software Development",
        "com.googlecode.iterm2": "Software Development",
        "dev.warp.Warp-Stable": "Software Development",
        "com.github.GitHubClient": "Software Development",
        "com.figma.Desktop": "Productivity",
        "notion.id": "Productivity",
        "com.apple.Notes": "Productivity",
        "com.apple.iCal": "Productivity",
        "com.apple.finder": "Productivity",
        "com.apple.Preview": "Productivity",
        "com.spotify.client": "Entertainment",
        "tv.twitch.studio": "Entertainment",
        "com.apple.Music": "Entertainment",
        "com.apple.TV": "Entertainment",
        "com.apple.systempreferences": "Productivity",
        "com.apple.ActivityMonitor": "Productivity",
    ]

    private static let prefixRules: [(String, String)] = [
        ("com.apple.", "Productivity"),
    ]

    static func category(for bundleId: String) -> String {
        if let c = rules[bundleId] { return c }
        for (prefix, cat) in prefixRules where bundleId.hasPrefix(prefix) {
            return cat
        }
        return "Productivity"
    }

    static func categorize(_ apps: [AppSession]) -> [CategoryBreakdown] {
        var totals: [String: Int] = [:]
        for app in apps where !MirrorConstants.chromeBundleIds.contains(app.bundleId) {
            let cat = category(for: app.bundleId)
            totals[cat, default: 0] += app.activeSeconds
        }
        let total = totals.values.reduce(0, +)
        guard total > 0 else { return [] }
        return totals.map { name, seconds in
            CategoryBreakdown(
                name: name,
                seconds: seconds,
                minutes: Int((Double(seconds) / 60).rounded())
            )
        }
        .sorted { $0.seconds > $1.seconds }
    }
}
