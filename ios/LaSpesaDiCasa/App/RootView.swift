import SwiftData
import SwiftUI

enum AppTab: Hashable { case settimana, lista, piatti, altro }

/// Port of src/App.tsx: four tabs (native Liquid Glass tab bar), full-screen active shopping,
/// and the first-launch Gemini key prompt.
struct RootView: View {
    @Environment(\.modelContext) private var context
    @Query private var profili: [Profilo]
    @State private var tab: AppTab = .settimana
    @State private var activeShoppingListId: String?
    @State private var setupGeminiOpen = false
    @State private var network = NetworkMonitor()
    // Each screen remembers its own week, as an offset from the current cycle.
    @State private var weekOffset = 0
    @State private var listOffset = 0

    private var palette: Palette { Palette.per(profili.first?.tema ?? .chiaro) }

    var body: some View {
        TabView(selection: $tab) {
            Tab("Settimana", systemImage: "calendar", value: AppTab.settimana) {
                WeeklyPlannerView(cycleOffset: $weekOffset)
            }
            Tab("Lista", systemImage: "checklist", value: AppTab.lista) {
                ShoppingListView(cycleOffset: $listOffset) { activeShoppingListId = $0 }
            }
            Tab("Piatti", systemImage: "fork.knife", value: AppTab.piatti) {
                DishesView()
            }
            Tab("Altro", systemImage: "slider.horizontal.3", value: AppTab.altro) {
                SettingsView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .palette(palette)
        .environment(network)
        .fullScreenCover(item: Binding(
            get: { activeShoppingListId.map(IdentifiedString.init) },
            set: { activeShoppingListId = $0?.id }
        )) { item in
            ActiveShoppingView(listId: item.id) { activeShoppingListId = nil }
                .environment(network)
        }
        .sheet(isPresented: $setupGeminiOpen, onDismiss: KeychainStore.dismissSetupPrompt) {
            GeminiKeySheet(onClose: { setupGeminiOpen = false }, onSaved: { setupGeminiOpen = false })
                .paperSheet(palette, detents: [.large])
        }
        .task {
            let store = Store(context: context)
            store.profile()
            // The dish seed resolves ingredients by name, so it runs after the ingredient seed.
            store.applySeeds()
            if KeychainStore.geminiApiKey() == nil && !KeychainStore.hasDismissedSetupPrompt {
                setupGeminiOpen = true
            }
        }
    }
}

struct IdentifiedString: Identifiable { let id: String }
