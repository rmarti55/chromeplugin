#if CLOUDKIT_ENABLED
import CloudKit
import Foundation

/// Optional iCloud sync — requires signed build with iCloud entitlements.
/// Enable with: swift build -Xswiftc -DCLOUDKIT_ENABLED
actor CloudKitSync {
    static let shared = CloudKitSync()

    private let container = CKContainer(identifier: MirrorConstants.cloudKitContainerId)
    private var lastUploadFingerprint: String?

    private init() {}

    func uploadTodayIfNeeded() async {
        let date = todayDateStr()
        guard let metrics = SessionDeriver.computeDayMetrics(dateStr: date, deviceId: DeviceIdentity.id) else { return }
        let fingerprint = "\(metrics.presenceSeconds)-\(metrics.activeSeconds)-\(metrics.apps.count)"
        if fingerprint == lastUploadFingerprint { return }
        lastUploadFingerprint = fingerprint
        await upload(metrics: metrics)
    }

    func upload(metrics: DayMetricsPayload) async {
        guard let data = try? JSONEncoder().encode(metrics),
              let json = String(data: data, encoding: .utf8) else { return }

        let recordID = CKRecord.ID(recordName: "\(metrics.deviceId)-\(metrics.date)")
        let record = CKRecord(recordType: MirrorConstants.recordTypeDayMetrics, recordID: recordID)
        record["date"] = metrics.date as CKRecordValue
        record["deviceId"] = metrics.deviceId as CKRecordValue
        record["payload"] = json as CKRecordValue
        record["updatedAt"] = Date() as CKRecordValue

        do {
            _ = try await container.privateCloudDatabase.save(record)
        } catch {
            // iCloud may be unavailable
        }
    }

    func fetchMergedForDay(_ dateStr: String) async -> [DayMetricsPayload] {
        let predicate = NSPredicate(format: "date == %@", dateStr)
        let query = CKQuery(recordType: MirrorConstants.recordTypeDayMetrics, predicate: predicate)
        do {
            let (results, _) = try await container.privateCloudDatabase.records(matching: query)
            return results.compactMap { _, result -> DayMetricsPayload? in
                guard case .success(let record) = result,
                      let json = record["payload"] as? String,
                      let data = json.data(using: .utf8),
                      let payload = try? JSONDecoder().decode(DayMetricsPayload.self, from: data) else { return nil }
                return payload
            }
        } catch {
            return []
        }
    }
}
#endif
