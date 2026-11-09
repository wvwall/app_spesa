import Foundation
import SwiftData

/// Values shared by the app and the widget extension.
enum AppConstants {
    nonisolated static let profileID = "profilo"
    nonisolated static let defaultDepartments = [
        "Ortofrutta", "Banco frigo", "Macelleria e pesce", "Surgelati",
        "Dispensa", "Forno", "Bevande", "Casa e igiene",
    ]
    nonisolated static let appGroup = "group.it.waltervelardo.laspesadicasa"
}

/// The SwiftData store lives in the App Group container, so the "Oggi" widget can read it.
enum SharedStore {
    nonisolated static var groupURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: AppConstants.appGroup)?
            .appending(path: "LaSpesaDiCasa.store")
    }

    /// Opens the shared store. The first time, an existing store in the app's private container
    /// (versions before the widget) is moved into the App Group so no data is lost. Without the
    /// App Group entitlement (e.g. some free signing setups) it falls back to the private store.
    static func makeContainer(readOnly: Bool = false) throws -> ModelContainer {
        let schema = Schema(AppSchema.models)
        guard let url = groupURL else {
            return try ModelContainer(for: schema)
        }
        if !readOnly { migrateLegacyStore(to: url) }
        let config = ModelConfiguration(schema: schema, url: url, allowsSave: !readOnly)
        return try ModelContainer(for: schema, configurations: config)
    }

    private static func migrateLegacyStore(to url: URL) {
        let fm = FileManager.default
        guard !fm.fileExists(atPath: url.path),
              let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
        let legacy = support.appending(path: "default.store")
        guard fm.fileExists(atPath: legacy.path) else { return }
        for suffix in ["", "-shm", "-wal"] {
            let from = URL(fileURLWithPath: legacy.path + suffix)
            let to = URL(fileURLWithPath: url.path + suffix)
            if fm.fileExists(atPath: from.path) { try? fm.copyItem(at: from, to: to) }
        }
    }
}
