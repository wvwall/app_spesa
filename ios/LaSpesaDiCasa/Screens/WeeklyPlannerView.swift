import SwiftData
import SwiftUI

/// Port of src/screens/WeeklyPlanner.tsx. The cycle runs from dinner on the shopping day to lunch
/// on the same weekday one week later. "Genera lista" and "Genera settimana" are disabled in the
/// PWA (feature flags), so the bottom action is "Importa menù" here too.
struct WeeklyPlannerView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Binding var cycleOffset: Int

    @Query private var profili: [Profilo]
    @Query private var tuttiSlot: [SlotPasto]
    @Query(sort: \Piatto.nome) private var piatti: [Piatto]
    @Query private var ingredienti: [Ingrediente]

    @State private var pianoId: String?
    @State private var importOpen = false
    @State private var esitoImport: String?
    @State private var scrolledToToday = false

    private var profilo: Profilo? { profili.first }
    private var inizio: Date { CycleCalendar.cycle(offset: cycleOffset, giornoSpesa: profilo?.giornoSpesa ?? 5) }
    private var cicloIso: String { CycleCalendar.toIsoDate(inizio) }
    private var slots: [SlotPasto] { pianoId.map { id in tuttiSlot.filter { $0.pianoId == id } } ?? [] }

    var body: some View {
        let giorni = CycleCalendar.cycleDays(inizio)
        let slots = self.slots
        let tuttiVuoti = !slots.isEmpty && slots.allSatisfy { $0.piattoId == nil }
        let assegnati = slots.compactMap { s in s.piattoId.flatMap { id in piatti.first { $0.id == id }.map { (slotId: s.id, nome: $0.nome) } } }

        VStack(spacing: 0) {
            header
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if pianoId == nil {
                            skeleton
                        } else {
                            if tuttiVuoti { emptyState }
                            ForEach(giorni, id: \.self) { giorno in
                                let iso = CycleCalendar.toIsoDate(giorno)
                                let slotGiorno = slots.filter { $0.data == iso }
                                    .sorted { ($0.pasto == .pranzo ? 0 : 1) < ($1.pasto == .pranzo ? 0 : 1) }
                                if !slotGiorno.isEmpty {
                                    dayBlock(giorno, slotGiorno, assegnati: assegnati).id(iso)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)
                .task(id: pianoId) {
                    // Glide to today, keeping the previous day visible above it as context.
                    guard pianoId != nil, cycleOffset == 0 else { return }
                    try? await Task.sleep(for: .milliseconds(350))
                    guard let oggiIndex = giorni.firstIndex(where: CycleCalendar.isToday) else { return }
                    let target = giorni[max(0, oggiIndex - 1)]
                    withAnimation(.smooth(duration: 0.6)) { proxy.scrollTo(CycleCalendar.toIsoDate(target), anchor: .top) }
                }
            }
        }
        .background { NotebookBackground(watermark: .settimana) }
        .safeAreaInset(edge: .bottom) { bottomBar }
        .task(id: cicloIso) {
            pianoId = nil
            let store = Store(context: context)
            let piano = store.getOrCreateWeeklyPlan(cicloIso)
            store.getOrCreatePlanSlots(pianoId: piano.id, cycleStart: inizio)
            pianoId = piano.id
        }
        .sheet(isPresented: $importOpen) {
            MealImportSheet(
                slots: slots.map { TextImport.SlotRef(id: $0.id, data: $0.data, pasto: $0.pasto) },
                onClose: { importOpen = false },
                onConfirm: importMeals
            )
            .paperSheet(palette, detents: [.large])
        }
    }

    // MARK: Header

    private var header: some View {
        PageHeader(title: CycleCalendar.formatCycleTitle(inizio), subtitle: "Menu settimanale") {
            CycleNavigator(
                onPrecedente: { cycleOffset -= 1 },
                onOggi: { cycleOffset = 0 },
                onSuccessivo: { cycleOffset += 1 }
            )
        }
    }

    // MARK: Day

    private func dayBlock(_ giorno: Date, _ slotGiorno: [SlotPasto], assegnati: [(slotId: String, nome: String)]) -> some View {
        let oggi = CycleCalendar.isToday(giorno)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(CycleCalendar.formatDayLabel(giorno))
                    .font(AppFont.text(12, .bold, relativeTo: .caption))
                    .textCase(.uppercase)
                    .tracking(12 * 0.12)
                    .foregroundStyle(oggi ? palette.biro : palette.textSecondary)
                if oggi {
                    Text("Oggi")
                        .font(AppFont.text(11, .bold, relativeTo: .caption2))
                        .tracking(0.44)
                        .foregroundStyle(palette.onEvidenziatore)
                        .padding(.vertical, 2).padding(.horizontal, 8)
                        .background(palette.evidenziatore, in: Capsule())
                }
            }
            .accessibilityAddTraits(.isHeader)
            ForEach(slotGiorno) { slot in
                PlanSlotRow(
                    slot: slot,
                    piatto: slot.piattoId.flatMap { id in piatti.first { $0.id == id } },
                    piatti: piatti,
                    porzioniDefault: profilo?.porzioniDefault ?? 4,
                    vincoli: profilo?.vincoliAlimentari ?? ["noci"],
                    catalogo: ingredienti,
                    evitaPiatti: assegnati.filter { $0.slotId != slot.id }.map(\.nome)
                )
            }
        }
        .padding(oggi ? 16 : 0)
        .overlay {
            if oggi {
                RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous).strokeBorder(palette.biro, lineWidth: 2)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("Il menù è ancora in bianco")
                .font(AppFont.display(22))
                .tracking(-0.22)
                .foregroundStyle(palette.textBody)
            Text("Scegli un piatto per un giorno qui sotto, o fatti proporre l'intera settimana.")
                .font(AppFont.text(15))
                .foregroundStyle(palette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private var skeleton: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    SkeletonBlock(width: 90, height: 11)
                    SkeletonBlock(height: 48, radius: 14)
                    SkeletonBlock(height: 48, radius: 14)
                }
                .padding(.bottom, 12)
            }
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 6) {
            GlassCTA(title: "Importa menù") { importOpen = true }
            if let esitoImport {
                StatusText(text: esitoImport, kind: .success).multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
        .hiddenWithKeyboard()
    }

    private func importMeals(_ righe: [(slotId: String, nome: String)]) throws {
        guard pianoId != nil else {
            throw AIError.message("La settimana non è ancora pronta. Riprova tra un istante.")
        }
        let esito = Store(context: context).importMealsIntoPlan(righe, porzioni: profilo?.porzioniDefault ?? 4)
        var parti = ["\(esito.assegnati) \(esito.assegnati == 1 ? "pasto importato" : "pasti importati")"]
        if esito.piattiCreati > 0 { parti.append("\(esito.piattiCreati) \(esito.piattiCreati == 1 ? "piatto nuovo" : "piatti nuovi")") }
        if esito.svuotati > 0 { parti.append("\(esito.svuotati) \(esito.svuotati == 1 ? "slot svuotato" : "slot svuotati")") }
        esitoImport = parti.joined(separator: " · ")
    }
}

/// One meal slot: a dish card, or the inline search/compose/AI panel.
private struct PlanSlotRow: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(UndoCenter.self) private var undo
    let slot: SlotPasto
    let piatto: Piatto?
    let piatti: [Piatto]
    let porzioniDefault: Int
    let vincoli: [String]
    let catalogo: [Ingrediente]
    let evitaPiatti: [String]

    @State private var ricerca = false
    @State private var query = ""
    @State private var generando = false
    @State private var errore: String?
    @State private var richiestaChiave = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        Group { content }
            .sheet(isPresented: $richiestaChiave) {
                GeminiKeySheet(onClose: { richiestaChiave = false }, onSaved: {
                    richiestaChiave = false
                    Task { await generateWithAI() }
                })
                .paperSheet(palette, detents: [.large])
            }
    }

    @ViewBuilder private var content: some View {
        if ricerca {
            searchPanel
        } else if let piatto {
            HStack(spacing: 8) {
                DishCard(pasto: slot.pasto, dish: piatto.nome, ai: piatto.origine == .ai) { open() }
                    .contextMenu {
                        Button(action: open) { Label("Cambia piatto", systemImage: "arrow.triangle.2.circlepath") }
                        Button { openAndGenerate() } label: { Label("Rigenera con AI", systemImage: "sparkles") }
                        Button(role: .destructive) { assign(nil) } label: { Label("Rimuovi dal pasto", systemImage: "trash") }
                    }
                IconSquareButton(systemImage: "trash", label: "Rimuovi \(piatto.nome) da questo pasto", tone: .danger) {
                    assign(nil)
                }
            }
        } else {
            DishCard(pasto: slot.pasto, dish: nil) { open() }
                .contextMenu {
                    Button(action: open) { Label("Scegli un piatto", systemImage: "plus") }
                    Button { openAndGenerate() } label: { Label("Genera con AI", systemImage: "sparkles") }
                }
        }
    }

    private func open() {
        withAnimation(Motion.ui) { ricerca = true }
        searchFocused = true
    }

    /// From the context menu: open the panel (so progress and errors are visible) and generate.
    private func openAndGenerate() {
        withAnimation(Motion.ui) { ricerca = true }
        Task { await generateWithAI() }
    }

    private var searchPanel: some View {
        let testo = query.trimmingCharacters(in: .whitespaces)
        let risultati = testo.isEmpty ? piatti : piatti.filter { $0.nome.localizedCaseInsensitiveContains(testo) }
        let esatto = risultati.contains { $0.nome.lowercased() == testo.lowercased() }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField("Cerca o scrivi un piatto…", text: $query)
                    .font(AppFont.text(16))
                    .focused($searchFocused)
                    .submitLabel(.done)
                    .padding(.horizontal, 12).padding(.vertical, 11)
                    .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(searchFocused ? palette.biro : palette.borderQuiet))
                Button("annulla") { close() }
                    .font(AppFont.text(12)).foregroundStyle(palette.textSecondary)
                    .buttonStyle(.plain).frame(minHeight: 44)
            }
            Button { Task { await generateWithAI() } } label: {
                Group {
                    if generando {
                        HStack(spacing: 6) { ProgressView().controlSize(.small); Text("Sto pensando a un piatto…") }
                    } else {
                        Label(piatto == nil ? "Genera con AI" : "Rigenera con AI", systemImage: "sparkles")
                    }
                }
                .font(AppFont.text(14, .semibold))
                .foregroundStyle(palette.biro)
                .padding(.horizontal, 10).frame(minHeight: 40, alignment: .leading)
            }
            .buttonStyle(.plain)
            .disabled(generando)
            if let errore { StatusText(text: errore, kind: .error) }
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(risultati) { p in
                        Button { assign(p.id) } label: {
                            Text(p.nome).font(AppFont.text(14, .semibold)).foregroundStyle(palette.textBody)
                                .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(.horizontal, 10)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    if risultati.isEmpty && testo.isEmpty {
                        Text("Scrivi per cercare nel ricettario, o descrivi un piatto al volo.")
                            .font(AppFont.text(13)).foregroundStyle(palette.textSecondary).padding(4)
                    }
                    if !testo.isEmpty && !esatto {
                        Button { createAndAssign(testo) } label: {
                            Label("Usa “\(testo)” così com'è", systemImage: "plus")
                                .font(AppFont.text(14, .semibold)).foregroundStyle(palette.biro)
                                .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(.horizontal, 10)
                        }
                        .buttonStyle(.plain)
                    }
                    if piatto != nil {
                        Button { assign(nil) } label: {
                            Label("Rimuovi piatto da questo pasto", systemImage: "trash")
                                .font(AppFont.text(14, .semibold)).foregroundStyle(palette.pomodoro)
                                .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(.horizontal, 10)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxHeight: 224)
            .scrollBounceBehavior(.basedOnSize)
        }
        .padding(10)
        .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.biro))
    }

    private func close() {
        withAnimation(Motion.ui) { ricerca = false }
        query = ""
    }

    private func assign(_ piattoId: String?) {
        let store = Store(context: context)
        let precedente = slot.piattoId
        let slotId = slot.id
        store.assignDish(slotId: slotId, piattoId: piattoId)
        if piattoId == nil, let precedente {
            undo.show("Piatto rimosso dal pasto") { store.assignDish(slotId: slotId, piattoId: precedente) }
        }
        close()
    }

    private func createAndAssign(_ nome: String) {
        let p = Store(context: context).createManualDish(nome: nome, porzioni: porzioniDefault)
        assign(p.id)
    }

    private func generateWithAI() async {
        generando = true
        errore = nil
        defer { generando = false }
        do {
            let g = try await GeminiClient().generateDish(ingredienti: [], vincoli: vincoli, porzioni: porzioniDefault,
                                                         pasto: slot.pasto, evitaPiatti: evitaPiatti)
            let id = Store(context: context).saveGeneratedDish(g, disponibili: [], catalogo: catalogo)
            assign(id)
        } catch AIError.apiKeyRequired {
            richiestaChiave = true
        } catch {
            errore = error.localizedDescription
        }
    }
}
