import ActivityKit
import Foundation
import SwiftData

/// Starts, updates and ends the active-shopping Live Activity, and handles the taps on its
/// Lock Screen list (tick an item, turn the page).
enum ShoppingLiveActivityController {
    private static var activity: Activity<ShoppingActivityAttributes>?
    private static var container: ModelContainer?
    /// Lock Screen page; clamped whenever the list shrinks.
    private static var page = 0

    /// Called at launch: the Lock Screen buttons may relaunch the app in the background.
    static func configure(container: ModelContainer) {
        self.container = container
        ShoppingActivityActions.check = { check(itemId: $0) }
        ShoppingActivityActions.turnPage = { turnPage(by: $0) }
    }

    static func state(voci: [VoceLista], ordine: [String]) -> ShoppingActivityAttributes.ContentState {
        let ordinate = Departments.group(voci, ordine: ordine, reparto: \.reparto).flatMap(\.voci)
        // The next item to grab: first unchecked one in store order, skipping those marked missing.
        let prossima = ordinate.first { !$0.checked && $0.mancante != true } ?? ordinate.first { !$0.checked }
        let daPrendere = ordinate.filter { !$0.checked && $0.mancante != true }
            + ordinate.filter { !$0.checked && $0.mancante == true }
        let per = ShoppingActivityAttributes.itemsPerPage
        let pages = max(1, (daPrendere.count + per - 1) / per)
        let current = min(max(page, 0), pages - 1)
        return .init(
            done: voci.filter(\.checked).count,
            total: voci.count,
            nextItem: prossima.map { $0.sostituitoCon ?? $0.nome },
            nextDepartment: prossima?.reparto,
            missing: voci.filter { !$0.checked && $0.mancante == true }.count,
            items: daPrendere.dropFirst(current * per).prefix(per).map {
                // Same "1 confezione" label as the aisle rows: the unit lives in the note.
                let unita = TextImport.splitUnitFromNote($0.nota).unita ?? ""
                return .init(id: $0.id, nome: $0.sostituitoCon ?? $0.nome,
                             quantita: [$0.quantita, unita].filter { !$0.isEmpty }.joined(separator: " "),
                             missing: $0.mancante == true)
            },
            page: current,
            pages: pages
        )
    }

    static func start(listId: String, weekLabel: String, tema: Tema, state: ShoppingActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // One shopping trip at a time: close leftovers (e.g. after the app was killed).
        for old in Activity<ShoppingActivityAttributes>.activities {
            // Activity is thread-safe but not marked Sendable.
            nonisolated(unsafe) let old = old
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        page = 0
        var state = state
        state.page = 0
        if let fresh = currentState(listId: listId) { state = fresh }
        let attributes = ShoppingActivityAttributes(listId: listId, storeName: "Esselunga", weekLabel: weekLabel, tema: tema)
        activity = try? Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil))
    }

    static func update(_ state: ShoppingActivityAttributes.ContentState) {
        guard let activity = currentActivity else { return }
        nonisolated(unsafe) let current = activity
        Task { await current.update(.init(state: state, staleDate: nil)) }
    }

    static func end(_ state: ShoppingActivityAttributes.ContentState) {
        guard let activity = currentActivity else { return }
        self.activity = nil
        page = 0
        nonisolated(unsafe) let current = activity
        Task { await current.end(.init(state: state, staleDate: nil), dismissalPolicy: .immediate) }
    }

    // MARK: - Lock Screen taps

    /// The running activity, recovered after a background relaunch.
    private static var currentActivity: Activity<ShoppingActivityAttributes>? {
        if activity == nil { activity = Activity<ShoppingActivityAttributes>.activities.first }
        return activity
    }

    private static func check(itemId: String) {
        guard let context = container?.mainContext,
              let voce = (try? context.fetch(FetchDescriptor<VoceLista>(predicate: #Predicate { $0.id == itemId })))?.first,
              !voce.checked else { return }
        Store(context: context).toggle(voce, checked: true)
        refresh()
    }

    private static func turnPage(by delta: Int) {
        page += delta
        refresh()
    }

    private static func refresh() {
        guard let listId = currentActivity?.attributes.listId, let state = currentState(listId: listId) else { return }
        page = state.page
        update(state)
    }

    private static func currentState(listId: String) -> ShoppingActivityAttributes.ContentState? {
        guard let context = container?.mainContext else { return nil }
        let voci = (try? context.fetch(FetchDescriptor<VoceLista>(predicate: #Predicate { $0.listaId == listId }))) ?? []
        let ordine = (try? context.fetch(FetchDescriptor<Profilo>()))?.first?.ordineReparti ?? []
        return state(voci: voci, ordine: ordine)
    }
}
