import SwiftData
import SwiftUI

/// "Piatti": the recipe book first. Search, quick filters (Tutti · Preferiti · AI), rows that open
/// the dish detail, and "+" for a new dish (generated from ingredients or composed by hand).
struct DishesView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(UndoCenter.self) private var undo
    @Query(sort: \Piatto.nome) private var piatti: [Piatto]
    @Query private var righe: [PiattoIngrediente]

    enum Filtro: String, CaseIterable, Identifiable {
        case tutti = "Tutti", preferiti = "Preferiti", ai = "AI"
        var id: String { rawValue }
    }

    @State private var query = ""
    @State private var filtro: Filtro = .tutti
    @State private var nuovoPiatto = false

    private var visibili: [Piatto] {
        let testo = query.trimmingCharacters(in: .whitespaces).lowercased()
        return piatti.filter { p in
            guard p.deletedAt == nil else { return false }
            switch filtro {
            case .tutti: break
            case .preferiti: if !p.preferito { return false }
            case .ai: if p.origine != .ai { return false }
            }
            return testo.isEmpty || p.nome.lowercased().contains(testo)
        }
        // Favorites first, then alphabetical.
        .sorted { ($0.preferito ? 0 : 1, $0.nome.lowercased()) < ($1.preferito ? 0 : 1, $1.nome.lowercased()) }
    }

    var body: some View {
        let lista = visibili
        let conteggi = Dictionary(grouping: righe, by: \.piattoId).mapValues(\.count)
        List {
            Picker("Filtro", selection: $filtro) {
                ForEach(Filtro.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .dishRow(top: 4)

            ForEach(lista) { p in
                // The link sits behind the card: a List draws its own chevron next to a visible
                // NavigationLink, and the card already has one.
                DishRow(piatto: p, ingredienti: conteggi[p.id] ?? 0)
                    .background {
                        NavigationLink(value: DishRef(id: p.id)) { EmptyView() }.opacity(0)
                    }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) { delete(p) } label: { Label("Elimina", systemImage: "trash") }
                        .tint(palette.pomodoro)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button { Store(context: context).toggleFavorite(p) } label: {
                        Label(p.preferito ? "Togli" : "Preferito", systemImage: p.preferito ? "star.slash" : "star")
                    }
                    .tint(palette.evidenziatoreBordo)
                }
                .contextMenu {
                    Button { Store(context: context).toggleFavorite(p) } label: {
                        Label(p.preferito ? "Togli dai preferiti" : "Aggiungi ai preferiti", systemImage: p.preferito ? "star.slash" : "star")
                    }
                    Button(role: .destructive) { delete(p) } label: { Label("Elimina", systemImage: "trash") }
                }
                .dishRow(top: 8)
            }

            if lista.isEmpty { emptyState.dishRow(top: 24) }
            Color.clear.frame(height: 24).dishRow(top: 0)
        }
        .paperList()
        .scrollDismissesKeyboard(.interactively)
        .searchable(text: $query, placement: .toolbar, prompt: "Cerca un piatto…")
        .toolbarVisibility(.visible, for: .navigationBar)
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Same handwritten title as the other tabs, in the bar so the native search sits under it.
            ToolbarItem(placement: .topBarLeading) {
                Text("Piatti\u{00A0}")
                    .font(AppFont.hand(28, .semibold, relativeTo: .title))
                    .tracking(-0.56)
                    .foregroundStyle(palette.biro)
                    .fixedSize()
                    .padding(.leading, -4)
                    .accessibilityAddTraits(.isHeader)
            }
            .sharedBackgroundVisibility(.hidden)
            ToolbarItem(placement: .topBarTrailing) {
                Button { nuovoPiatto = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Nuovo piatto")
            }
        }
        .background { NotebookBackground(watermark: .piatti) }
        .navigationDestination(for: DishRef.self) { ref in
            DishDetailView(piattoId: ref.id)
        }
        .sheet(isPresented: $nuovoPiatto) {
            NewDishSheet { nuovoPiatto = false }
                .paperSheet(palette, detents: [.large])
        }
    }

    @ViewBuilder private var emptyState: some View {
        VStack(spacing: 10) {
            switch filtro {
            case .preferiti:
                Text("Nessun preferito").font(AppFont.display(20)).foregroundStyle(palette.textBody)
                Text("Scorri un piatto verso destra, o aprilo e tocca la stella.")
            case .ai:
                Text("Nessun piatto generato").font(AppFont.display(20)).foregroundStyle(palette.textBody)
                Text("Tocca + e scegli gli ingredienti che hai: l’AI ti propone un piatto.")
            case .tutti:
                if query.isEmpty {
                    Text("Il ricettario è vuoto").font(AppFont.display(20)).foregroundStyle(palette.textBody)
                    Text("Tocca + per generare un piatto dagli ingredienti che hai, o per scriverne uno.")
                } else {
                    Text("Nessun piatto trovato").font(AppFont.display(20)).foregroundStyle(palette.textBody)
                }
            }
        }
        .font(AppFont.text(14))
        .foregroundStyle(palette.textSecondary)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }

    private func delete(_ p: Piatto) {
        if let r = Store(context: context).deleteDishWithUndo(p.id) {
            undo.show("\(r.nome) eliminato", onUndo: r.restore)
        }
    }
}

struct DishRef: Hashable { let id: String }

private struct DishRow: View {
    @Environment(\.palette) private var palette
    let piatto: Piatto
    let ingredienti: Int

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    if piatto.preferito {
                        Image(systemName: "star.fill").font(.system(size: 12)).foregroundStyle(palette.evidenziatoreBordo)
                            .accessibilityLabel("Preferito")
                    }
                    Text(piatto.nome).font(AppFont.text(16, .semibold)).foregroundStyle(palette.textBody)
                        .multilineTextAlignment(.leading)
                }
                Text(ingredienti == 0 ? "Senza ingredienti" : ingredienti == 1 ? "1 ingrediente" : "\(ingredienti) ingredienti")
                    .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
            }
            Spacer(minLength: 8)
            if piatto.origine == .ai { AIBadge() }
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                .foregroundStyle(palette.textSecondary.opacity(0.6))
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(minHeight: 56)
        .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.borderQuiet))
        .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

extension View {
    /// A Piatti row: page gutter of 20pt and a top gap, notebook-styled.
    func dishRow(top: CGFloat) -> some View {
        self.frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, top)
            .paperRow()
    }
}
