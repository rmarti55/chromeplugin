import CloudKit
import SwiftUI

struct DayMetricsPayload: Codable {
    var date: String
    var presenceSeconds: Int
    var activeSeconds: Int
    var apps: [AppSession]
    var deviceId: String
}

struct AppSession: Codable, Identifiable {
    var bundleId: String
    var name: String
    var presenceSeconds: Int
    var activeSeconds: Int
    var id: String { bundleId }
}

@MainActor
final class CloudKitDayStore: ObservableObject {
    @Published var payloads: [DayMetricsPayload] = []
    @Published var error: String?

    private let container = CKContainer(identifier: "iCloud.com.dailymirror.companion")

    func loadToday() async {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let date = fmt.string(from: Date())
        let predicate = NSPredicate(format: "date == %@", date)
        let query = CKQuery(recordType: "DayMetrics", predicate: predicate)
        do {
            let (results, _) = try await container.privateCloudDatabase.records(matching: query)
            payloads = results.compactMap { _, result -> DayMetricsPayload? in
                guard case .success(let record) = result,
                      let json = record["payload"] as? String,
                      let data = json.data(using: .utf8) else { return nil }
                return try? JSONDecoder().decode(DayMetricsPayload.self, from: data)
            }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    static func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        let m = seconds / 60
        if m < 60 { return "\(m)m" }
        return "\(m / 60)h \(m % 60)m"
    }
}

struct ContentView: View {
    @StateObject private var store = CloudKitDayStore()

    var body: some View {
        NavigationStack {
            List {
                if let error = store.error {
                    Text(error).foregroundStyle(.secondary)
                }
                ForEach(store.payloads, id: \.deviceId) { day in
                    Section("Device \(day.deviceId.prefix(8))…") {
                        LabeledContent("Presence", value: CloudKitDayStore.formatDuration(day.presenceSeconds))
                        LabeledContent("Active", value: CloudKitDayStore.formatDuration(day.activeSeconds))
                        ForEach(day.apps.prefix(8)) { app in
                            LabeledContent(app.name, value: CloudKitDayStore.formatDuration(app.presenceSeconds))
                        }
                    }
                }
                if store.payloads.isEmpty && store.error == nil {
                    Text("No synced data for today. Run the macOS companion on your Mac.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Daily Mirror")
            .refreshable { await store.loadToday() }
            .task { await store.loadToday() }
        }
    }
}
