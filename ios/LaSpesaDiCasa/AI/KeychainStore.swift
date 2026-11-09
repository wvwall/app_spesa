import Foundation
import Security

/// Port of src/lib/aiSettings.ts. The Gemini key lives only in this device's Keychain (never in
/// the SwiftData store, never in backups). The "setup prompt dismissed" flag is a plain default.
enum KeychainStore {
    private static let service = "it.waltervelardo.laspesadicasa"
    private static let account = "gemini-api-key"
    private static let dismissedKey = "geminiSetupPromptDismissed"

    static func geminiApiKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func saveGeminiApiKey(_ apiKey: String) throws {
        let normalized = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { throw AIError.message("Inserisci una chiave API Gemini.") }
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(normalized.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw AIError.message("Non sono riuscito a salvare la chiave.") }
        dismissSetupPrompt()
        NotificationCenter.default.post(name: .geminiKeyChanged, object: nil)
    }

    static func removeGeminiApiKey() {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        NotificationCenter.default.post(name: .geminiKeyChanged, object: nil)
    }

    static var hasDismissedSetupPrompt: Bool { UserDefaults.standard.bool(forKey: dismissedKey) }

    static func dismissSetupPrompt() { UserDefaults.standard.set(true, forKey: dismissedKey) }
}

extension Notification.Name {
    static let geminiKeyChanged = Notification.Name("geminiKeyChanged")
}
