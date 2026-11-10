import SwiftData
import SwiftUI

/// A dish: ingredients with quantities, numbered method, servings, verified allergens; star,
/// edit, delete and "Usa in un pasto" (assign it to a meal of the week).
struct DishDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss
    @Environment(UndoCenter.self) private var undo
    let piattoId: String

    @Query private var piatti: [Piatto]
    @Query private var tutteRighe: [PiattoIngrediente]
    @State private var editing = false
    @State private var usando = false

    private var piatto: Piatto? { piatti.first { $0.id == piattoId } }

    var body: some View {
        Group {
            if let p = piatto {
                content(p)
            } else {
                Color.clear
            }
        }
        .background { NotebookBackground(watermark: nil) }
        .toolbarVisibility(.visible, for: .navigationBar)
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func content(_ p: Piatto) -> some View {
        let righe = tutteRighe.filter { $0.piattoId == p.id }
            .sorted { $0.nome.lowercased() < $1.nome.lowercased() }
        let passi = (p.procedimento ?? "").split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(p.nome + "\u{00A0}")
                    .font(AppFont.hand(30, .semibold, relativeTo: .title))
                    .foregroundStyle(palette.biro)
                    .highlighted(palette)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: 8) {
                    Text(p.porzioni == 1 ? "1 porzione" : "\(p.porzioni) porzioni")
                    if p.origine == .ai { AIBadge() }
                }
                .font(AppFont.text(13)).foregroundStyle(palette.textSecondary)

                if let a = p.allergieVerificate, !a.isEmpty {
                    Label("verificato: senza \(a.joined(separator: ", "))", systemImage: "checkmark.shield")
                        .labelStyle(TightLabelStyle())
                        .font(AppFont.text(12.5)).foregroundStyle(palette.basilico)
                }

                SectionLabel("Ingredienti").padding(.top, 14)
                if righe.isEmpty {
                    Text("Nessun ingrediente. Tocca Modifica per aggiungerli.")
                        .font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(righe.enumerated()), id: \.element.id) { i, r in
                            if i > 0 { Rectangle().fill(palette.borderQuiet).frame(height: 1).padding(.leading, 14) }
                            HStack {
                                Text(r.nome).font(AppFont.text(15, .medium)).foregroundStyle(palette.textBody)
                                Spacer()
                                Text(formatQuantita(r.quantita, r.unita))
                                    .font(AppFont.text(14)).foregroundStyle(palette.textSecondary).monospacedDigit()
                            }
                            .padding(.horizontal, 14).frame(minHeight: 44)
                        }
                    }
                    .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.borderQuiet))
                }

                SectionLabel("Procedimento").padding(.top, 14)
                if passi.isEmpty {
                    Text("Nessun procedimento scritto.").font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(Array(passi.enumerated()), id: \.offset) { i, passo in
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text("\(i + 1)").font(AppFont.display(16)).foregroundStyle(palette.biro)
                                    .frame(width: 20, alignment: .trailing)
                                Text(passo).font(AppFont.text(15)).foregroundStyle(palette.textBody)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .safeAreaInset(edge: .bottom) {
            GlassCTA(title: "Usa in un pasto") { usando = true }
                .padding(.horizontal, 20).padding(.bottom, 10)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Store(context: context).toggleFavorite(p) } label: {
                    Image(systemName: p.preferito ? "star.fill" : "star")
                        .foregroundStyle(p.preferito ? palette.evidenziatoreBordo : palette.textBody)
                }
                .accessibilityLabel(p.preferito ? "Togli dai preferiti" : "Aggiungi ai preferiti")
                .sensoryFeedback(.selection, trigger: p.preferito)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { editing = true } label: { Label("Modifica", systemImage: "pencil") }
                    Button { usando = true } label: { Label("Usa in un pasto", systemImage: "calendar.badge.plus") }
                    Divider()
                    Button(role: .destructive) {
                        if let r = Store(context: context).deleteDishWithUndo(p.id) {
                            undo.show("\(r.nome) eliminato", onUndo: r.restore)
                        }
                        dismiss()
                    } label: { Label("Elimina", systemImage: "trash") }
                } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("Altre azioni")
            }
        }
        .sheet(isPresented: $editing) {
            DishEditor(piatto: p, onClose: { editing = false })
                .paperSheet(palette, detents: [.large])
        }
        .sheet(isPresented: $usando) {
            UseInMealSheet(piatto: p) { usando = false }
                .paperSheet(palette, detents: [.medium, .large])
        }
    }
}

// MARK: - Editor (edit an existing dish, or compose a new one)

struct DishEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var ingredienti: [Ingrediente]
    @Query private var profili: [Profilo]
    var piatto: Piatto?
    /// Ingredients preselected when composing a new dish from the catalog.
    var preselezionati: [Ingrediente] = []
    var onClose: () -> Void
    var onSaved: (Piatto) -> Void = { _ in }

    @State private var nome = ""
    @State private var porzioni = 2
    @State private var procedimento = ""
    @State private var righe: [RigaPiatto] = []
    @State private var nuovoIngrediente = ""
    @State private var loaded = false

    private var ordine: [String] { profili.first?.ordineReparti ?? Store.defaultDepartments }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                SheetHeader(title: piatto == nil ? "Nuovo piatto" : "Modifica piatto")
                PaperField(placeholder: "Nome del piatto", text: $nome, weight: .semibold)
                HStack {
                    Text("Porzioni").font(AppFont.text(15)).foregroundStyle(palette.textBody)
                    Spacer()
                    Text("\(porzioni)").font(AppFont.text(15, .bold)).foregroundStyle(palette.biro).monospacedDigit()
                    Stepper("Porzioni", value: $porzioni, in: 1...20).labelsHidden()
                }
                .padding(.vertical, 4)

                SectionLabel("Ingredienti").padding(.top, 8)
                ForEach($righe) { $r in
                    HStack(spacing: 8) {
                        Text(r.nome).font(AppFont.text(14, .semibold)).foregroundStyle(palette.textBody)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        PaperField(placeholder: "1", text: $r.quantita, fontSize: 14, keyboard: .decimalPad, alignment: .trailing)
                            .frame(width: 56)
                        PaperField(placeholder: "unità", text: $r.unita, fontSize: 14, autocapitalization: .never)
                            .frame(width: 84)
                        Button { righe.removeAll { $0.id == r.id } } label: {
                            Image(systemName: "minus.circle.fill").font(.system(size: 18)).foregroundStyle(palette.pomodoro)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Togli \(r.nome)")
                    }
                }
                HStack(spacing: 8) {
                    PaperField(placeholder: "Aggiungi un ingrediente…", text: $nuovoIngrediente, fontSize: 14,
                               autocapitalization: .sentences) { aggiungi() }
                    Button("Aggiungi", action: aggiungi)
                        .buttonStyle(.paper(.ghost, fullWidth: false, fontSize: 14, vertical: 10, horizontal: 14))
                        .disabled(nuovoIngrediente.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                SectionLabel("Procedimento").padding(.top, 8)
                ZStack(alignment: .topLeading) {
                    TextEditor(text: $procedimento)
                        .font(AppFont.text(15))
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 140)
                    if procedimento.isEmpty {
                        Text("Un passo per riga")
                            .font(AppFont.text(15)).foregroundStyle(palette.textSecondary.opacity(0.7))
                            .padding(.horizontal, 13).padding(.vertical, 16).allowsHitTesting(false)
                    }
                }
                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(palette.borderQuiet))

                Button("Salva piatto", action: save)
                    .buttonStyle(.paper)
                    .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                    .padding(.top, 8)
                Button("Annulla", action: onClose).buttonStyle(.paperGhost)
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear(perform: load)
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        porzioni = profili.first?.porzioniDefault ?? 2
        if let p = piatto {
            nome = p.nome
            porzioni = p.porzioni
            procedimento = p.procedimento ?? ""
            righe = Store(context: context).ingredients(of: p.id)
                .sorted { $0.nome.lowercased() < $1.nome.lowercased() }
                .map { RigaPiatto(ingredienteId: $0.ingredienteId, nome: $0.nome, reparto: $0.reparto,
                                  quantita: formatNumero($0.quantita), unita: $0.unita) }
        } else {
            righe = preselezionati.map {
                RigaPiatto(ingredienteId: $0.id, nome: $0.nome, reparto: $0.reparto, quantita: "1", unita: $0.unitaDefault)
            }
        }
    }

    /// Adds a row; department and unit come from the catalog when the name matches it.
    private func aggiungi() {
        let n = nuovoIngrediente.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let match = ingredienti.first { $0.deletedAt == nil && $0.nome.lowercased() == n.lowercased() }
        righe.append(RigaPiatto(ingredienteId: match?.id, nome: match?.nome ?? n,
                                reparto: match?.reparto ?? Store.repartoRipiego, quantita: "1",
                                unita: match?.unitaDefault ?? ""))
        nuovoIngrediente = ""
    }

    private func save() {
        let n = nome.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let p = Store(context: context).saveDish(piatto, nome: n, porzioni: porzioni,
                                                 procedimento: procedimento.trimmingCharacters(in: .whitespacesAndNewlines),
                                                 righe: righe)
        Haptics.success()
        onSaved(p)
        onClose()
    }

    private func formatNumero(_ q: Double) -> String {
        q.rounded() == q ? String(Int(q)) : String(q).replacingOccurrences(of: ".", with: ",")
    }
}

// MARK: - Use in a meal

/// Picks a lunch/dinner of a week (current cycle by default) and assigns the dish to it.
struct UseInMealSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var profili: [Profilo]
    @Query private var tuttiSlot: [SlotPasto]
    @Query private var piatti: [Piatto]
    let piatto: Piatto
    var onClose: () -> Void

    @State private var offset = 0
    @State private var pianoId: String?

    private var inizio: Date { CycleCalendar.cycle(offset: offset, giornoSpesa: profili.first?.giornoSpesa ?? 5) }

    var body: some View {
        let slots = pianoId.map { id in tuttiSlot.filter { $0.pianoId == id } } ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    SheetHeader(title: "Usa in un pasto", intro: piatto.nome)
                    CycleNavigator(onPrecedente: { offset -= 1 }, onOggi: { offset = 0 }, onSuccessivo: { offset += 1 })
                }
                Text(CycleCalendar.formatCycleLabel(inizio)).font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
                ForEach(CycleCalendar.cycleDays(inizio), id: \.self) { giorno in
                    let iso = CycleCalendar.toIsoDate(giorno)
                    let delGiorno = slots.filter { $0.data == iso }.sorted { $0.pasto == .pranzo && $1.pasto == .cena }
                    if !delGiorno.isEmpty {
                        Text(CycleCalendar.formatDayLabel(giorno))
                            .sectionLabelStyle(palette)
                            .foregroundStyle(CycleCalendar.isToday(giorno) ? palette.biro : palette.textSecondary)
                            .padding(.top, 6)
                        ForEach(delGiorno) { slot in
                            Button { assegna(slot) } label: {
                                HStack(spacing: 10) {
                                    Label(slot.pasto.etichetta, systemImage: slot.pasto == .cena ? "moon" : "sun.max")
                                        .labelStyle(TightLabelStyle())
                                        .font(AppFont.text(12)).foregroundStyle(palette.textSecondary)
                                        .frame(width: 70, alignment: .leading)
                                    Text(nomeDi(slot) ?? "libero")
                                        .font(AppFont.text(15, nomeDi(slot) == nil ? .regular : .medium))
                                        .foregroundStyle(nomeDi(slot) == nil ? palette.textSecondary : palette.textBody)
                                        .lineLimit(1)
                                    Spacer()
                                    if slot.piattoId == piatto.id {
                                        Image(systemName: "checkmark").foregroundStyle(palette.biro)
                                    }
                                }
                                .padding(.horizontal, 14).frame(minHeight: 46)
                                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(palette.borderQuiet))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
        }
        .task(id: CycleCalendar.toIsoDate(inizio)) {
            let store = Store(context: context)
            let piano = store.getOrCreateWeeklyPlan(CycleCalendar.toIsoDate(inizio))
            store.getOrCreatePlanSlots(pianoId: piano.id, cycleStart: inizio)
            pianoId = piano.id
        }
    }

    private func nomeDi(_ slot: SlotPasto) -> String? {
        slot.piattoId.flatMap { id in piatti.first { $0.id == id }?.nome }
    }

    private func assegna(_ slot: SlotPasto) {
        Store(context: context).assignDish(slotId: slot.id, piattoId: piatto.id)
        Haptics.success()
        onClose()
    }
}
