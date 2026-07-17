// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DailyMirrorCompanion",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "DailyMirrorCompanion", targets: ["DailyMirrorCompanion"]),
    ],
    targets: [
        .executableTarget(
            name: "DailyMirrorCompanion",
            path: "Sources/DailyMirrorCompanion"
        ),
    ]
)
