import Foundation

enum MirrorConstants {
    /// Match extension/constants.js — 5 minutes
    static let idleSeconds: TimeInterval = 300
    static let maxGapSeconds: TimeInterval = 30 * 60
    static let idlePollInterval: TimeInterval = 30
    static let retentionDays = 120
    static let chromeBundleIds: Set<String> = [
        "com.google.Chrome",
        "com.google.Chrome.canary",
        "com.google.Chrome.beta",
        "com.brave.Browser",
        "company.thebrowser.Browser",
        "org.mozilla.firefox",
        "com.microsoft.edgemac",
        "com.apple.Safari",
    ]
    static let cloudKitContainerId = "iCloud.com.dailymirror.companion"
    static let recordTypeDayMetrics = "DayMetrics"
}
