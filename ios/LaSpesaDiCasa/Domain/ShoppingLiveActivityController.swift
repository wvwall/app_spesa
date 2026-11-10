import ActivityKit
import Foundation

/// Starts, updates and ends the active-shopping Live Activity.
enum ShoppingLiveActivityController {
    private static var activity: Activity<ShoppingActivityAttributes>?

    static func state(voci: [VoceLista], ordine: [String]) -> ShoppingActivityAttributes.ContentState {
        let ordinate = Departments.group(voci, ordine: ordine, reparto: \.reparto).flatMap(\.voci)
        // The next item to grab: first unchecked one in store order, skipping those marked missing.
        let prossima = ordinate.first { !$0.checked && $0.mancante != true } ?? ordinate.first { !$0.checked }
        return .init(
            done: voci.filter(\.checked).count,
            total: voci.count,
            nextItem: prossima.map { $0.sostituitoCon ?? $0.nome },
            nextDepartment: prossima?.reparto,
            missing: voci.filter { !$0.checked && $0.mancante == true }.count
        )
    }

    static func start(weekLabel: String, state: ShoppingActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // One shopping trip at a time: close leftovers (e.g. after the app was killed).
        for old in Activity<ShoppingActivityAttributes>.activities {
            // Activity is thread-safe but not marked Sendable.
            nonisolated(unsafe) let old = old
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        let attributes = ShoppingActivityAttributes(storeName: "Esselunga", weekLabel: weekLabel)
        activity = try? Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil))
    }

    static func update(_ state: ShoppingActivityAttributes.ContentState) {
        guard let activity else { return }
        nonisolated(unsafe) let current = activity
        Task { await current.update(.init(state: state, staleDate: nil)) }
    }

    static func end(_ state: ShoppingActivityAttributes.ContentState) {
        guard let activity else { return }
        self.activity = nil
        nonisolated(unsafe) let current = activity
        Task { await current.end(.init(state: state, staleDate: nil), dismissalPolicy: .immediate) }
    }
}
