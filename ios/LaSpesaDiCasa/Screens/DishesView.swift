import SwiftData
import SwiftUI

/// Port of src/screens/Dishes.tsx: ingredient catalog by department (search with aliases),
/// selection → AI proposal or manual composition, and the saved dishes.
struct DishesView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(UndoCenter.self) private var undo
    @Query private var ingredienti: [Ingrediente]
    @Query private var piatti: [Piatto]
    @Query private var profili: [Profilo]

    @State private var query = ""
    @State private var selezionati: [String] = []
    @State private var repartiEspansi: Set<String> = []
    @State private var generato: GeneratedDish?
    @State private var caricamentoAI = false
    @State private var erroreAI: String?
    @State private var componendo = false
    @State private var richiestaChiave = false

    private var ordine: [String] { profili.first?.ordineReparti ?? Store.defaultDepartments }
    private var testo: String { query.trimmingCharacters(in: .whitespaces).lowercased() }
    private var selezionatiIngredienti: [Ingrediente] { ingredienti.filter { selezionati.contains($0.id) } }

    var body: some View {
        let filtrati = ingredienti.filter {
            testo.isEmpty || $0.nome.lowercased().contains(testo) || $0.alias.contains { $0.lowercased().contains(testo) }
        }
        let esatto = ingredienti.contains { $0.nome.lowercased() == testo }
        let gruppi = Departments.group(filtrati, ordine: ordine, reparto: \.reparto)

        VStack(spacing: 0) {
            PageHeader(title: "Piatti")
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SearchField(placeholder: "Cerca o aggiungi un ingrediente…", text: $query)

                    ForEach(gruppi, id: \.reparto) { gruppo in
                        department(gruppo.reparto, gruppo.voci, espanso: !testo.isEmpty || repartiEspansi.contains(gruppo.reparto))
                    }

                    if !testo.isEmpty && !esatto {
                        AddIngredientInline(query: query.trimmingCharacters(in: .whitespaces), reparti: ordine) { reparto in
                            let ing = Store(context: context).addIngredient(nome: query.trimmingCharacters(in: .whitespaces), reparto: reparto)
                            selezionati.append(ing.id)
                            query = ""
                        }
                    }

                    generationSection
                    savedSection
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background { NotebookBackground(watermark: .piatti) }
        .sheet(isPresented: $richiestaChiave) {
            GeminiKeySheet(onClose: { richiestaChiave = false }, onSaved: {
                richiestaChiave = false
                Task { await generateWithAI() }
            })
            .paperSheet(palette, detents: [.large])
        }
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
                    Text("(\(items.count)\(n > 0 ? " · \(n) selezionati" : ""))").font(AppFont.text(12, .medium))
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

    private var generationSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(selezionati.isEmpty ? "Nessun ingrediente selezionato" : "Con \(selezionati.count) ingredienti selezionati")
            HStack(spacing: 8) {
                Button { Task { await generateWithAI() } } label: {
                    if caricamentoAI {
                        Text("Sto pensando a un piatto…")
                    } else {
                        Label("Genera con AI", systemImage: "sparkles")
                    }
                }
                .buttonStyle(.paper)
                .disabled(caricamentoAI)
                Button("Componi piatto") { componendo = true }
                    .buttonStyle(.paperGhost)
                    .disabled(selezionati.isEmpty)
            }
            if let erroreAI { StatusText(text: erroreAI, kind: .error) }
            if let g = generato {
                let nomi = selezionatiIngredienti.map(\.nome)
                ProposalCard(
                    title: g.nome,
                    meta: "\(g.minuti.map { "\(Int($0)) min · " } ?? "")\(Int(g.porzioni)) porzioni",
                    have: nomi.isEmpty ? "nessuno" : nomi.joined(separator: ", "),
                    buy: g.ingredientiDaComprare.map { "\($0.nome) \($0.quantita)" }.joined(separator: ", "),
                    allergieVerificate: g.allergieVerificate,
                    allergieNonVerificate: g.allergieNonVerificate,
                    onAccept: saveGenerated,
                    onRegenerate: { Task { await generateWithAI() } }
                )
            }
            if componendo {
                ManualDishForm(ingredienti: selezionatiIngredienti, porzioniDefault: profili.first?.porzioniDefault ?? 4,
                               onCancel: { componendo = false }) {
                    componendo = false
                    selezionati = []
                }
            }
        }
        .padding(.top, 16)
        .overlay(alignment: .top) { Rectangle().fill(palette.borderQuiet).frame(height: 1) }
    }

    private var savedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("I tuoi piatti")
            ForEach(piatti) { p in
                HStack {
                    Text(p.nome).font(AppFont.text(16, .semibold)).foregroundStyle(palette.textBody)
                    Spacer()
                    if p.origine == .ai { AIBadge() }
                    Button {
                        if let r = Store(context: context).deleteDishWithUndo(p.id) {
                            undo.show("\(r.nome) eliminato", onUndo: r.restore)
                        }
                    } label: {
                        Image(systemName: "trash").font(.system(size: 15)).foregroundStyle(palette.pomodoro)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Elimina \(p.nome)")
                }
                .padding(.horizontal, 14).padding(.vertical, 8)
                .frame(minHeight: 48)
                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.borderQuiet))
            }
            if piatti.isEmpty {
                Text("Nessun piatto salvato.").font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
            }
        }
        .padding(.top, 16)
        .overlay(alignment: .top) { Rectangle().fill(palette.borderQuiet).frame(height: 1) }
    }

    private func generateWithAI() async {
        caricamentoAI = true
        erroreAI = nil
        defer { caricamentoAI = false }
        let profilo = Store(context: context).profile()
        do {
            generato = try await GeminiClient().generateDish(
                ingredienti: selezionatiIngredienti.map(\.nome), vincoli: profilo.vincoliAlimentari,
                porzioni: profilo.porzioniDefault, pasto: .cena)
        } catch AIError.apiKeyRequired {
            richiestaChiave = true
        } catch {
            erroreAI = error.localizedDescription
        }
    }

    private func saveGenerated() {
        guard let generato else { return }
        Store(context: context).saveGeneratedDish(generato, disponibili: selezionatiIngredienti, catalogo: ingredienti)
        self.generato = nil
        selezionati = []
    }
}

private struct AddIngredientInline: View {
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

private struct ManualDishForm: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    let ingredienti: [Ingrediente]
    let porzioniDefault: Int
    var onCancel: () -> Void
    var onSalvato: () -> Void

    @State private var nome = ""
    @State private var porzioni = 4
    @State private var quantita: [String: String] = [:]
    @State private var unita: [String: String] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PaperField(placeholder: "Nome del piatto", text: $nome, fontSize: 14)
            HStack(spacing: 8) {
                Text("Porzioni").font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
                Stepper(value: $porzioni, in: 1...99) {
                    Text("\(porzioni)").font(AppFont.text(14, .semibold)).monospacedDigit().foregroundStyle(palette.textBody)
                }
                .fixedSize()
            }
            VStack(spacing: 6) {
                ForEach(ingredienti) { ing in
                    HStack(spacing: 8) {
                        Text(ing.nome).font(AppFont.text(14, .semibold)).foregroundStyle(palette.textBody)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        PaperField(placeholder: "1", text: qtyBinding(ing.id), fontSize: 14, keyboard: .decimalPad)
                            .frame(width: 64)
                        PaperField(placeholder: ing.unitaDefault, text: unitBinding(ing.id, ing.unitaDefault), fontSize: 14,
                                   autocapitalization: .never)
                            .frame(width: 84)
                    }
                }
            }
            HStack(spacing: 8) {
                Button("Salva piatto", action: save).buttonStyle(.paper)
                    .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                Button("Annulla", action: onCancel).buttonStyle(.paperGhost)
            }
        }
        .padding(12)
        .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.biro))
        .onAppear { porzioni = porzioniDefault }
    }

    private func qtyBinding(_ id: String) -> Binding<String> {
        Binding(get: { quantita[id] ?? "1" }, set: { quantita[id] = $0 })
    }

    private func unitBinding(_ id: String, _ def: String) -> Binding<String> {
        Binding(get: { unita[id] ?? def }, set: { unita[id] = $0 })
    }

    private func save() {
        let n = nome.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let righe = ingredienti.map { ing in
            (ing, quantita: Double((quantita[ing.id] ?? "1").replacingOccurrences(of: ",", with: ".")) ?? 0,
             unita: unita[ing.id] ?? ing.unitaDefault)
        }
        Store(context: context).createManualDish(nome: n, porzioni: porzioni, ingredienti: righe)
        onSalvato()
    }
}
