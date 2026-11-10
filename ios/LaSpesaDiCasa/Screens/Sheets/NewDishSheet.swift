import SwiftData
import SwiftUI

/// "+" in Piatti: pick ingredients from the catalog (by department, with search and aliases),
/// then either let the AI propose a dish or compose one by hand. The selection and the two
/// actions stay pinned at the bottom, within thumb reach.
struct NewDishSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var ingredienti: [Ingrediente]
    @Query private var profili: [Profilo]
    var onClose: () -> Void

    @State private var query = ""
    @State private var selezionati: [String] = []
    @State private var repartiEspansi: Set<String> = []
    @State private var generato: GeneratedDish?
    @State private var caricamentoAI = false
    @State private var erroreAI: String?
    @State private var componendo = false
    @State private var richiestaChiave = false

    private var catalogo: [Ingrediente] { ingredienti.filter { $0.deletedAt == nil } }
    private var ordine: [String] { profili.first?.ordineReparti ?? Store.defaultDepartments }
    private var testo: String { query.trimmingCharacters(in: .whitespaces).lowercased() }
    private var scelti: [Ingrediente] { selezionati.compactMap { id in catalogo.first { $0.id == id } } }

    var body: some View {
        if componendo {
            DishEditor(piatto: nil, preselezionati: scelti, onClose: { componendo = false }) { _ in onClose() }
        } else {
            picker
        }
    }

    private var picker: some View {
        let filtrati = catalogo.filter {
            testo.isEmpty || $0.nome.lowercased().contains(testo) || $0.alias.contains { $0.lowercased().contains(testo) }
        }
        let esatto = catalogo.contains { $0.nome.lowercased() == testo }
        return ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SheetHeader(title: "Nuovo piatto",
                            intro: "Scegli gli ingredienti che hai: l’AI propone un piatto, oppure lo componi tu.")
                SearchField(placeholder: "Cerca o aggiungi un ingrediente…", text: $query)

                if let g = generato {
                    ProposalCard(
                        title: g.nome,
                        meta: "\(g.minuti.map { "\(Int($0)) min · " } ?? "")\(Int(g.porzioni)) porzioni",
                        have: scelti.isEmpty ? "nessuno" : scelti.map(\.nome).joined(separator: ", "),
                        buy: g.ingredientiDaComprare.map { "\($0.nome) \($0.quantita)" }.joined(separator: ", "),
                        allergieVerificate: g.allergieVerificate,
                        allergieNonVerificate: g.allergieNonVerificate,
                        onAccept: saveGenerated,
                        onRegenerate: { Task { await generate() } }
                    )
                }
                if let erroreAI { StatusText(text: erroreAI, kind: .error) }

                ForEach(Departments.group(filtrati, ordine: ordine, reparto: \.reparto), id: \.reparto) { gruppo in
                    department(gruppo.reparto, gruppo.voci, espanso: !testo.isEmpty || repartiEspansi.contains(gruppo.reparto))
                }

                if !testo.isEmpty && !esatto {
                    AddIngredientInline(query: query.trimmingCharacters(in: .whitespaces), reparti: ordine) { reparto in
                        let ing = Store(context: context).addIngredient(nome: query.trimmingCharacters(in: .whitespaces), reparto: reparto)
                        selezionati.append(ing.id)
                        query = ""
                    }
                }
            }
            .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) { selectionBar }
        .sheet(isPresented: $richiestaChiave) {
            GeminiKeySheet(onClose: { richiestaChiave = false }, onSaved: {
                richiestaChiave = false
                Task { await generate() }
            })
            .paperSheet(palette, detents: [.large])
        }
    }

    /// Pinned selection: chosen ingredients (tap to remove) and the two actions.
    private var selectionBar: some View {
        VStack(spacing: 10) {
            if scelti.isEmpty {
                Text("Nessun ingrediente scelto: l’AI sceglie liberamente.")
                    .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(scelti) { ing in
                            Chip("\(ing.nome) ×", state: .selected) { selezionati.removeAll { $0 == ing.id } }
                                .accessibilityLabel("Togli \(ing.nome)")
                        }
                    }
                }
            }
            HStack(spacing: 8) {
                Button { Task { await generate() } } label: {
                    if caricamentoAI {
                        HStack(spacing: 6) { ProgressView().controlSize(.small).tint(.white); Text("Ci penso…") }
                    } else {
                        Label("Genera", systemImage: "sparkles")
                    }
                }
                .buttonStyle(.paper)
                .disabled(caricamentoAI)
                Button("Componi") { componendo = true }
                    .buttonStyle(.paperGhost)
            }
        }
        .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
        .background(.bar)
    }

    private func department(_ nome: String, _ items: [Ingrediente], espanso: Bool) -> some View {
        let n = items.filter { selezionati.contains($0.id) }.count
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(Motion.ui) {
                    if repartiEspansi.contains(nome) { repartiEspansi.remove(nome) } else { repartiEspansi.insert(nome) }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: espanso ? "chevron.down" : "chevron.right").font(.system(size: 12, weight: .bold))
                    Text(nome).textCase(.uppercase).tracking(12 * 0.12).font(AppFont.text(12, .bold))
                    Text("(\(items.count)\(n > 0 ? " · \(n) scelti" : ""))").font(AppFont.text(12, .medium))
                }
                .foregroundStyle(palette.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 28, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
            if espanso {
                FlowLayout {
                    ForEach(items) { ing in
                        Chip(ing.nome, state: selezionati.contains(ing.id) ? .selected : .default) {
                            if let i = selezionati.firstIndex(of: ing.id) { selezionati.remove(at: i) } else { selezionati.append(ing.id) }
                        }
                    }
                }
            }
        }
    }

    private func generate() async {
        caricamentoAI = true
        erroreAI = nil
        defer { caricamentoAI = false }
        let profilo = Store(context: context).profile()
        do {
            generato = try await GeminiClient().generateDish(
                ingredienti: scelti.map(\.nome), vincoli: profilo.vincoliAlimentari,
                porzioni: profilo.porzioniDefault, pasto: .cena)
        } catch AIError.apiKeyRequired {
            richiestaChiave = true
        } catch {
            erroreAI = error.localizedDescription
        }
    }

    private func saveGenerated() {
        guard let generato else { return }
        Store(context: context).saveGeneratedDish(generato, disponibili: scelti, catalogo: catalogo)
        Haptics.success()
        onClose()
    }
}

/// "“x” non è nel catalogo": pick a department and add it.
struct AddIngredientInline: View {
    @Environment(\.palette) private var palette
    let query: String
    let reparti: [String]
    var onConferma: (String) -> Void
    @State private var scelto: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("“\(query)” non è nel catalogo. Scegli il reparto per aggiungerlo:")
                .font(AppFont.text(13.5)).foregroundStyle(palette.textSecondary)
            FlowLayout {
                ForEach(reparti, id: \.self) { r in
                    Chip(r, state: (scelto ?? reparti.first) == r ? .selected : .default) { scelto = r }
                }
            }
            Button { onConferma(scelto ?? reparti.first ?? Store.repartoRipiego) } label: {
                Label("Aggiungi “\(query)”", systemImage: "plus")
            }
            .buttonStyle(.paper)
        }
        .padding(12)
        .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.biro))
    }
}
