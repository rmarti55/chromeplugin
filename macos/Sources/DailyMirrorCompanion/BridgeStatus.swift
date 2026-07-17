import Foundation

enum BridgeStatus {
    enum State: Equatable {
        case installed
        case missingManifest
        case missingHelper
        case wrongPath
    }

    static var dataDirectoryURL: URL {
        MirrorPaths.dailyMirrorDirectory
    }

    static var hostManifestURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Google/Chrome/NativeMessagingHosts", isDirectory: true)
            .appendingPathComponent("\(MirrorConstants.nativeHostName).json")
    }

    static var expectedHostHelperURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Applications/\(MirrorConstants.installedAppName)", isDirectory: true)
            .appendingPathComponent("Contents/Helpers/native-host")
    }

    static func evaluate() -> State {
        guard FileManager.default.fileExists(atPath: hostManifestURL.path) else {
            return .missingManifest
        }
        guard let data = try? Data(contentsOf: hostManifestURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let path = json["path"] as? String else {
            return .missingManifest
        }
        guard FileManager.default.fileExists(atPath: path) else {
            return .missingHelper
        }
        let expected = expectedHostHelperURL.path
        if path != expected {
            return .wrongPath
        }
        return .installed
    }

    static var label: String {
        switch evaluate() {
        case .installed:
            return "Chrome bridge: connected"
        case .missingManifest:
            return "Chrome bridge: not installed"
        case .missingHelper:
            return "Chrome bridge: helper missing"
        case .wrongPath:
            return "Chrome bridge: reinstall needed"
        }
    }

    static var installHint: String {
        """
        ./macos/Scripts/install-companion.sh YOUR_EXTENSION_ID

        Find YOUR_EXTENSION_ID at chrome://extensions (Developer mode), then restart Chrome.
        """
    }
}

enum MirrorPaths {
    static var dailyMirrorDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = base.appendingPathComponent("DailyMirror", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
