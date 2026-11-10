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
    @State private var undo = UndoCenter()
    // Each screen remembers its own week, as an offset from the current cycle.
    @State private var weekOffset = 0
    @State private var listOffset = 0

    @Environment(\.colorScheme) private var systemScheme
    private var tema: Tema { profili.first?.tema ?? .sistema }
    private var palette: Palette { Palette.per(tema, system: systemScheme) }

    var body: some View {
        TabView(selection: $tab) {
            Tab(value: AppTab.settimana) {
                WeeklyPlannerView(cycleOffset: $weekOffset).inTabStack()
            } label: { TabLabel("Settimana", "calendar") }
            Tab(value: AppTab.lista) {
                ShoppingListView(cycleOffset: $listOffset) { activeShoppingListId = $0 }.inTabStack()
            } label: { TabLabel("Lista", "checklist") }
            Tab(value: AppTab.piatti) {
                DishesView().inTabStack(showsBar: true)
            } label: { TabLabel("Piatti", "fork.knife") }
            Tab(value: AppTab.altro) {
                SettingsView().inTabStack()
            } label: { TabLabel("Opzioni", "slider.horizontal.3") }
        }
        .palette(palette, followSystem: tema == .sistema)
        .environment(network)
        .environment(undo)
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

/// Tab item with a slightly smaller SF Symbol than the system default.
struct TabLabel: View {
    let title: String
    let symbol: String
    init(_ title: String, _ symbol: String) {
        self.title = title
        self.symbol = symbol
    }

    var body: some View {
        Label {
            Text(title)
        } icon: {
            if let ui = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .regular)) {
                Image(uiImage: ui.withRenderingMode(.alwaysTemplate))
            } else {
                Image(systemName: symbol)
            }
        }
    }
}

extension View {
    /// Each tab lives in a NavigationStack (for native search and the keyboard "Fine" button),
    /// with the navigation bar hidden: the notebook PageHeader stays the visible title.
    func inTabStack(showsBar: Bool = false) -> some View {
        NavigationStack {
            self.toolbarVisibility(showsBar ? .automatic : .hidden, for: .navigationBar)
                .keyboardDoneButton()
                // The undo toast lives inside each tab's content: an overlay on the native
                // TabView is drawn but does not receive touches (taps fell through to the row
                // underneath).
                .modifier(UndoToastHost())
        }
    }
}

private struct UndoToastHost: ViewModifier {
    @Environment(UndoCenter.self) private var undo

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            UndoToast(center: undo).padding(.bottom, 64) // Above the floating tab bar.
        }
        .animation(.snappy, value: undo.current?.id)
    }
}
