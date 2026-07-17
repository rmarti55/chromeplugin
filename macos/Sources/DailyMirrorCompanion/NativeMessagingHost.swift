import Foundation

enum NativeMessagingHost {
    static func run() {
        FileHandle.standardInput.readabilityHandler = { handle in
            let lengthData = handle.readData(ofLength: 4)
            guard lengthData.count == 4 else {
                exit(0)
            }
            let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self) }
            let messageData = handle.readData(ofLength: Int(length))
            guard let message = try? JSONSerialization.jsonObject(with: messageData) as? [String: Any] else {
                writeResponse(["error": "Invalid JSON"])
                return
            }
            let response = handleMessage(message)
            writeResponse(response)
        }
        RunLoop.main.run()
    }

    private static func handleMessage(_ message: [String: Any]) -> [String: Any] {
        guard let type = message["type"] as? String else {
            return ["error": "Missing type"]
        }

        switch type {
        case "PING":
            return ["ok": true, "version": "0.1.0"]

        case "GET_DAY":
            guard let date = message["date"] as? String else {
                return ["error": "Missing date"]
            }
            return dayResponse(for: date)

        case "GET_SYNCED_DAY":
            guard let date = message["date"] as? String else {
                return ["error": "Missing date"]
            }
            return syncedDayResponse(for: date)

        default:
            return ["error": "Unknown type: \(type)"]
        }
    }

    private static func dayResponse(for date: String) -> [String: Any] {
        let deviceId = DeviceIdentity.id
        guard var metrics = SessionDeriver.computeDayMetrics(dateStr: date, deviceId: deviceId) else {
            return ["error": "Invalid date"]
        }
        let sem = DispatchSemaphore(value: 0)
        Task {
            let synced = await CloudKitSync.shared.syncedDeviceIds(for: date)
            metrics.syncedDevices = synced.filter { $0 != deviceId }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 2)
        guard let data = try? JSONEncoder().encode(metrics),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ["error": "Encode failed"]
        }
        return obj
    }

    private static func syncedDayResponse(for date: String) -> [String: Any] {
        let sem = DispatchSemaphore(value: 0)
        var payloads: [DayMetricsPayload] = []
        Task {
            payloads = await CloudKitSync.shared.fetchMergedForDay(date)
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 5)
        guard let data = try? JSONEncoder().encode(payloads),
              let arr = try? JSONSerialization.jsonObject(with: data) else {
            return ["error": "Encode failed", "devices": []]
        }
        return ["date": date, "devices": arr]
    }

    private static func writeResponse(_ obj: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
        var length = UInt32(data.count)
        let lengthData = Data(bytes: &length, count: 4)
        FileHandle.standardOutput.write(lengthData)
        FileHandle.standardOutput.write(data)
    }
}
