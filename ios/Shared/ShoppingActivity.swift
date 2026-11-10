import ActivityKit
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
    }

    var storeName: String
    var weekLabel: String
}
