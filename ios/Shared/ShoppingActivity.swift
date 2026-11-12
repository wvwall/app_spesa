import ActivityKit
import AppIntents
import Foundation

/// Live Activity shown on the Lock Screen and in the Dynamic Island during active shopping.
nonisolated struct ShoppingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var done: Int
        var total: Int
        /// First unchecked item, in store order (nil when everything is in the cart).
        var nextItem: String?
        var nextDepartment: String?
        var missing: Int
        /// The current page of items still to grab, in store order (missing ones last).
        var items: [Item] = []
        /// Zero-based page shown on the Lock Screen, and how many pages there are.
        var page: Int = 0
        var pages: Int = 1
    }

    struct Item: Codable, Hashable, Identifiable {
        var id: String
        var nome: String
        var quantita: String
        var missing: Bool
    }

    /// Items per Lock Screen page: what fits in the Live Activity's height.
    static let itemsPerPage = 3

    var listId: String
    var storeName: String
    var weekLabel: String
    /// The app theme when shopping started, so the Lock Screen matches the rest of the app.
    var tema: Tema
}

/// Set by the app at launch. Live Activity intents always run in the app's process, so the
/// widget extension (which also compiles them) never reaches these.
@MainActor
enum ShoppingActivityActions {
    static var check: ((String) -> Void)?
    static var turnPage: ((Int) -> Void)?
}

/// Ticks a list item from the Lock Screen.
struct CheckShoppingItemIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Spunta voce"
    static let isDiscoverable = false

    @Parameter(title: "Voce") var itemId: String

    init() {}
    init(itemId: String) { self.itemId = itemId }

    @MainActor
    func perform() async throws -> some IntentResult {
        ShoppingActivityActions.check?(itemId)
        return .result()
    }
}

/// Moves the Lock Screen list one page back (-1) or forward (+1).
struct TurnShoppingPageIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Cambia pagina"
    static let isDiscoverable = false

    @Parameter(title: "Direzione") var delta: Int

    init() {}
    init(delta: Int) { self.delta = delta }

    @MainActor
    func perform() async throws -> some IntentResult {
        ShoppingActivityActions.turnPage?(delta)
        return .result()
    }
}
