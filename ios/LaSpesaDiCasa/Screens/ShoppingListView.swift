import SwiftData
import SwiftUI

/// Port of src/screens/ShoppingList.tsx: the week's list grouped by department, manual items
/// with photo/note/unit, import, export (share sheet), department sorting and "Inizia la spesa".
struct ShoppingListView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(NetworkMonitor.self) private var network
    @Environment(UndoCenter.self) private var undo
    @Binding var cycleOffset: Int
    var onStartShopping: (String) -> Void

    @Query private var profili: [Profilo]
    @Query private var piani: [PianoSettimanale]
    @Query private var liste: [ListaSpesa]
    @Query private var tutteVoci: [VoceLista]
    @Query private var ingredienti: [Ingrediente]

    @State private var ordinando = false
    @State private var esitoOrdina: String?
    @State private var editingId: String?
    @State private var departmentWithForm: String?
    @State private var formToReveal: String?
    @State private var importOpen = false
    @State private var esitoImport: String?

    private var profilo: Profilo? { profili.first }
    private var ordineReparti: [String] { profilo?.ordineReparti ?? Store.defaultDepartments }
    private var inizio: Date { CycleCalendar.cycle(offset: cycleOffset, giornoSpesa: profilo?.giornoSpesa ?? 5) }
    private var cicloIso: String { CycleCalendar.toIsoDate(inizio) }
    private var piano: PianoSettimanale? { piani.first { $0.settimanaIso == cicloIso } }
    private var lista: ListaSpesa? {
        guard let piano else { return nil }
        return liste.filter { $0.pianoId == piano.id }.max { $0.updatedAt < $1.updatedAt }
    }
    private var voci: [VoceLista] { lista.map { l in tutteVoci.filter { $0.listaId == l.id } } ?? [] }

    var body: some View {
        let voci = self.voci
        let haVoci = lista != nil && !voci.isEmpty
        VStack(spacing: 0) {
            header(count: haVoci ? voci.count : nil)
            if profilo == nil {
                VStack(spacing: 8) { ForEach(0..<3, id: \.self) { _ in SkeletonBlock(height: 44, radius: 14) } }
                    .padding(.horizontal, 20).padding(.top, 14)
                Spacer()
            } else if haVoci {
                list(voci)
            } else {
                emptyState
            }
        }
        .background { NotebookBackground(watermark: .lista) }
        .sheet(isPresented: $importOpen) {
            ShoppingImportSheet(
                catalogo: ingredienti.map { .init(nome: $0.nome, reparto: $0.reparto, alias: $0.alias, id: $0.id, deletedAt: $0.deletedAt) },
                reparti: ordineReparti,
                onClose: { importOpen = false },
                onConfirm: importList
            )
            .paperSheet(palette, detents: [.large])
        }
    }

    private func header(count: Int?) -> some View {
        PageHeader(
            title: CycleCalendar.formatCycleTitle(inizio),
            subtitle: count.map { "Lista della spesa · \($0) \($0 == 1 ? "articolo" : "articoli")" } ?? "Lista della spesa"
        ) {
            CycleNavigator(onPrecedente: { cycleOffset -= 1 }, onOggi: { cycleOffset = 0 }, onSuccessivo: { cycleOffset += 1 })
        }
    }

    /// A `List` (for native swipe actions) styled as the notebook: no separators, clear rows.
    private func list(_ voci: [VoceLista]) -> some View {
        ScrollViewReader { proxy in
        List {
            ForEach(Departments.group(voci, ordine: ordineReparti, reparto: \.reparto), id: \.reparto) { gruppo in
                // Department header with a "+" to add an item straight into this department.
                HStack {
                    Text(gruppo.reparto).sectionLabelStyle(palette, tracking: 0.14)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button {
                        withAnimation(Motion.ui) {
                            departmentWithForm = departmentWithForm == gruppo.reparto ? nil : gruppo.reparto
                        }
                    } label: {
                        Image(systemName: departmentWithForm == gruppo.reparto ? "xmark" : "plus")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(palette.biro)
                            .frame(width: 44, height: 36)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(departmentWithForm == gruppo.reparto ? "Chiudi" : "Aggiungi in \(gruppo.reparto)")
                }
                .padding(.leading, 20).padding(.trailing, 8).padding(.top, 14)
                .paperRow()
                if departmentWithForm == gruppo.reparto {
                    AddShoppingItemForm(reparti: ordineReparti, initiallyOpen: true, initialDepartment: gruppo.reparto,
                                        onCancel: { departmentWithForm = nil },
                                        onOpen: { revealForm("dept-\(gruppo.reparto)") }) { n, r, q, f, nota in
                        addItem(n, r, q, f, nota)
                        departmentWithForm = nil
                    }
                    .padding(.horizontal, 20).padding(.vertical, 8)
                    .id("dept-\(gruppo.reparto)")
                    .paperRow()
                }
                ForEach(Array(gruppo.voci.enumerated()), id: \.element.id) { i, v in
                    let primo = i == 0, ultimo = i == gruppo.voci.count - 1
                    Group {
                        if editingId == v.id {
                            AddShoppingItemForm(
                                reparti: ordineReparti, initiallyOpen: true, initialName: v.nome, initialQuantity: v.quantita,
                                initialDepartment: v.reparto, initialPhoto: v.fotoJPEG, initialNote: v.nota, confirmLabel: "Salva",
                                onCancel: { editingId = nil },
                                onOpen: { revealForm("edit-\(v.id)") }
                            ) { nome, reparto, quantita, foto, nota in
                                Store(context: context).update(v, nome: nome, quantita: quantita, reparto: reparto, foto: foto, nota: nota)
                                editingId = nil
                            }
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .cardSegment(palette, first: primo, last: ultimo)
                            .id("edit-\(v.id)")
                        } else {
                            ReviewRow(voce: v, onEdit: { editingId = v.id }, onDelete: { deleteItem(v) })
                                .cardSegment(palette, first: primo, last: ultimo)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) { deleteItem(v) } label: { Label("Elimina", systemImage: "trash") }
                                        .tint(palette.pomodoro)
                                }
                                .swipeActions(edge: .leading) {
                                    Button { editingId = v.id } label: { Label("Modifica", systemImage: "pencil") }
                                        .tint(palette.textSecondary)
                                }
                        }
                    }
                    .paperRow()
                }
            }
            AddShoppingItemForm(reparti: ordineReparti, onOpen: { revealForm("new-bottom") }) { n, r, q, f, nota in
                addItem(n, r, q, f, nota)
            }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .id("new-bottom")
                .paperRow()
            Color.clear.frame(height: 8).paperRow()
        }
        .paperList()
        .safeAreaInset(edge: .bottom) { actions(voci).hiddenWithKeyboard() }
        .scrollDismissesKeyboard(.interactively)
        .onChange(of: formToReveal) { _, id in scroll(proxy, to: id) }
        // Once the keyboard is up the visible area is smaller: scroll again so the whole form
        // (name, quantity, note, buttons) sits above the keyboard.
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidShowNotification)) { _ in
            scroll(proxy, to: formToReveal)
            formToReveal = nil // One shot: other fields' keyboards must not scroll back here.
        }
        }
    }

    /// Asks the list to bring an opened add/edit form fully into view.
    private func revealForm(_ id: String) {
        formToReveal = nil
        DispatchQueue.main.async { formToReveal = id }
    }

    private func scroll(_ proxy: ScrollViewProxy, to id: String?) {
        guard let id else { return }
        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(id, anchor: .bottom) }
    }

    private func deleteItem(_ v: VoceLista) {
        let nome = v.nome
        let restore = Store(context: context).deleteWithUndo(v)
        undo.show("\(nome) eliminato", onUndo: restore)
    }

    /// "Inizia la spesa" plus a native "…" menu with the secondary list tools.
    private func actions(_ voci: [VoceLista]) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                GlassCTA(title: "Inizia la spesa") { startShopping() }
                Menu {
                    // Fixed order with the destructive action first: the menu opens above the
                    // button, so "Svuota lista" ends up farthest from the finger.
                    Button(role: .destructive) {
                        guard let lista else { return }
                        let restore = Store(context: context).deleteCompleteListWithUndo(lista)
                        undo.show("Lista svuotata", onUndo: restore)
                    } label: { Label("Svuota lista", systemImage: "trash") }
                    Divider()
                    Button { Task { await sortByDepartment() } } label: {
                        Label(ordinando ? "Ordino…" : "Ordina per reparto", systemImage: "arrow.up.arrow.down")
                    }
                    .disabled(ordinando)
                    ShareLink(item: exportText(voci), subject: Text("lista-spesa.txt")) {
                        Label("Esporta testo", systemImage: "square.and.arrow.up")
                    }
                    Button { importOpen = true } label: { Label("Importa lista", systemImage: "tray.and.arrow.down") }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(palette.biro)
                        .frame(width: 30, height: 30)
                }
                .menuOrder(.fixed)
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .controlSize(.large)
                .accessibilityLabel("Altre azioni sulla lista")
            }
            if let esitoOrdina { StatusText(text: esitoOrdina).frame(maxWidth: .infinity, alignment: .leading) }
            if let esitoImport { StatusText(text: esitoImport, kind: .success).frame(maxWidth: .infinity, alignment: .leading) }
        }
        .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 10)
    }

    private var emptyState: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Nessuna lista ancora").font(AppFont.display(20)).foregroundStyle(palette.textBody)
                Text("Aggiungi gli articoli a mano, oppure importa una lista che hai già scritto.")
                    .font(AppFont.text(16)).foregroundStyle(palette.textSecondary).multilineTextAlignment(.center)
                VStack(spacing: 8) {
                    AddShoppingItemForm(reparti: ordineReparti, centered: true) { n, r, q, f, nota in addItem(n, r, q, f, nota) }
                    Button { importOpen = true } label: { Label("Importa lista", systemImage: "tray.and.arrow.up") }
                        .buttonStyle(.paperGhost)
                    if let esitoImport { StatusText(text: esitoImport, kind: .success) }
                }
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity)
            .containerRelativeFrame(.vertical, alignment: .center) { h, _ in h * 0.8 }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: Actions

    private func exportText(_ voci: [VoceLista]) -> String {
        let titolo = "SPESA " + CycleCalendar.formatCycleLabel(inizio).replacingOccurrences(of: "Settimana ", with: "")
        return ListExport.text(voci: voci, ordine: ordineReparti, titolo: titolo)
    }

    private func startShopping() {
        guard let lista else { return }
        Store(context: context).close(lista)
        onStartShopping(lista.id)
    }

    private func openList() -> ListaSpesa {
        let store = Store(context: context)
        return store.getOrCreateOpenList(store.getOrCreateWeeklyPlan(cicloIso).id)
    }

    private func addItem(_ nome: String, _ reparto: String, _ quantita: String, _ foto: Data?, _ nota: String?) {
        Store(context: context).addFreeItem(listaId: openList().id, nome: nome, quantita: quantita, reparto: reparto, foto: foto, nota: nota)
    }

    private func importList(_ righe: [Store.ShoppingImportEntry]) throws {
        let esito = Store(context: context).importShoppingItems(listaId: openList().id, righe)
        var parti = ["\(esito.aggiunti) \(esito.aggiunti == 1 ? "nuovo" : "nuovi")"]
        if esito.aggiornati > 0 { parti.append("\(esito.aggiornati) aggiornati") }
        esitoImport = "Importati \(esito.aggiunti + esito.aggiornati) articoli (\(parti.joined(separator: ", ")))."
    }

    private func sortByDepartment() async {
        guard let lista else { return }
        ordinando = true
        esitoOrdina = nil
        defer { ordinando = false }
        // Without a key (or offline) unknown items simply stay in "Dispensa", as in the PWA.
        let esito = await Store(context: context).sortListByDepartment(listaId: lista.id, ordine: ordineReparti, online: network.online) { nomi, reparti in
            try await GeminiClient().classifyDepartments(ingredienti: nomi, reparti: reparti)
        }
        if esito.sistemati == 0 && esito.irrisolti == 0 {
            esitoOrdina = "Erano già tutti a posto."
            return
        }
        var msg = esito.sistemati > 0
            ? "Sistemati \(esito.sistemati) articoli\(esito.viaAI > 0 ? " (\(esito.viaAI) con l'AI)" : "")."
            : "Nessun articolo spostato."
        if esito.irrisolti > 0 {
            msg += esito.aiSaltata
                ? " \(esito.irrisolti) non riconosciuti (AI non disponibile), restano in Dispensa."
                : " \(esito.irrisolti) restano in Dispensa."
        }
        esitoOrdina = msg
    }
}

// MARK: - Review row

private struct ReviewRow: View {
    @Environment(\.palette) private var palette
    let voce: VoceLista
    var onEdit: () -> Void
    var onDelete: () -> Void

    var body: some View {
        let parts = TextImport.splitUnitFromNote(voce.nota)
        Button(action: onEdit) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(voce.nome).font(AppFont.text(16, .medium)).foregroundStyle(palette.textBody)
                        .multilineTextAlignment(.leading)
                    if let nota = parts.nota {
                        Text("“\(nota)”").font(AppFont.hand(15)).foregroundStyle(palette.biro)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(Self.quantita(voce.quantita, parts.unita))
                    .font(AppFont.text(14)).monospacedDigit()
                    .foregroundStyle(palette.textSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Tocca per modificare")
        .contextMenu {
            Button(action: onEdit) { Label("Modifica", systemImage: "pencil") }
            Button(role: .destructive, action: onDelete) { Label("Elimina", systemImage: "trash") }
        }
    }

    /// "500 g", "2 × 1 kg", "3": the quantity read-only, with the unit kept in the note.
    static func quantita(_ q: String, _ unita: String?) -> String {
        let q = q.trimmingCharacters(in: .whitespaces)
        guard let unita, !unita.isEmpty else { return q.isEmpty ? "—" : q }
        if let n = Double(q.replacingOccurrences(of: ",", with: ".")) { return formatQuantita(n, unita) }
        return q.isEmpty ? unita : "\(q) \(unita)"
    }
}

/// One row of a department card: rounded corners only at the ends, hairline between rows.
private struct CardSegment: ViewModifier {
    let palette: Palette
    let first: Bool
    let last: Bool

    func body(content: Content) -> some View {
        let r: CGFloat = 16
        let shape = UnevenRoundedRectangle(
            topLeadingRadius: first ? r : 0, bottomLeadingRadius: last ? r : 0,
            bottomTrailingRadius: last ? r : 0, topTrailingRadius: first ? r : 0, style: .continuous)
        content
            .background(palette.surfaceCard, in: shape)
            .overlay { SegmentBorder(first: first, last: last, radius: r).stroke(palette.borderQuiet, lineWidth: 1) }
            .overlay(alignment: .bottom) {
                if !last { Rectangle().fill(palette.borderQuiet).frame(height: 1).padding(.leading, 14) }
            }
            .contentShape(.contextMenuPreview, shape)
            .padding(.horizontal, 20)
            .padding(.bottom, last ? 6 : 0)
    }
}

private extension View {
    func cardSegment(_ palette: Palette, first: Bool, last: Bool) -> some View {
        modifier(CardSegment(palette: palette, first: first, last: last))
    }
}

// MARK: - Add item form

/// Port of AddShoppingItemForm: name; quantity + unit as one value; optional department chips;
/// note; photo. No department chosen → "Dispensa".
struct AddShoppingItemForm: View {
    @Environment(\.palette) private var palette
    var reparti: [String]
    var initiallyOpen = false
    var initialName = ""
    var initialQuantity = "1"
    var initialDepartment: String?
    var initialPhoto: Data?
    var initialNote: String?
    var confirmLabel = "Aggiungi"
    var onCancel: (() -> Void)?
    var centered = false
    /// Called when the form opens, so the screen can scroll it fully into view.
    var onOpen: (() -> Void)?
    /// `nota` already combines unit and free note.
    var onAdd: (_ nome: String, _ reparto: String, _ quantita: String, _ foto: Data?, _ nota: String?) -> Void

    @State private var aperto = false
    @State private var nome = ""
    @State private var quantita = "1"
    @State private var unita = ""
    @State private var nota = ""
    @State private var reparto: String?
    @State private var repartiAperti = false
    @State private var foto: Data?
    @State private var erroreFoto: String?
    @State private var initialized = false
    @FocusState private var focus: Field?

    private enum Field { case nome, quantita, unita, nota }

    var body: some View {
        Group {
            if aperto { form } else { collapsed }
        }
        .onAppear {
            guard !initialized else { return }
            initialized = true
            aperto = initiallyOpen
            nome = initialName
            quantita = initialQuantity
            let parts = TextImport.splitUnitFromNote(initialNote)
            unita = parts.unita ?? ""
            nota = parts.nota ?? ""
            reparto = initialDepartment
            foto = initialPhoto
            if initiallyOpen {
                onOpen?()
                // Inside a List the row is still being inserted: focus on the next run loop,
                // otherwise the keyboard does not come up.
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(150))
                    focus = .nome
                }
            }
        }
    }

    private var collapsed: some View {
        Button {
            aperto = true
            focus = .nome
            onOpen?()
        } label: {
            Label("Aggiungi articolo", systemImage: "plus")
                .labelStyle(TightLabelStyle(spacing: 6))
                .font(AppFont.text(14, .semibold)).foregroundStyle(palette.biro).frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 8) {
            field("Nome articolo…", $nome, .nome, weight: .semibold)
                .onSubmit(submit)
                .accessibilityLabel("Nome articolo")

            HStack(spacing: 8) {
                HStack(spacing: 0) {
                    TextField("q.tà", text: $quantita)
                        .font(AppFont.text(14)).monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .keyboardType(.decimalPad)
                        .focused($focus, equals: .quantita)
                        .frame(width: 44)
                        .padding(.horizontal, 8).padding(.vertical, 11)
                        .accessibilityLabel("Quantità")
                    Rectangle().fill(palette.borderQuiet).frame(width: 1).padding(.vertical, 8)
                    TextField("unità", text: $unita)
                        .font(AppFont.text(14))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .unita)
                        .frame(width: 64)
                        .padding(.horizontal, 8).padding(.vertical, 11)
                        .accessibilityLabel("Unità")
                        .overlay(alignment: .trailing) {
                            Menu {
                                ForEach(TextImport.unitaSuggerite, id: \.self) { u in Button(u) { unita = u } }
                            } label: {
                                Image(systemName: "chevron.down").font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(palette.textSecondary).frame(width: 22, height: 36)
                            }
                            .accessibilityLabel("Unità suggerite")
                        }
                }
                .fixedSize(horizontal: true, vertical: false)
                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(focus == .quantita || focus == .unita ? palette.biro : palette.borderQuiet))

                Button { withAnimation(Motion.ui) { repartiAperti.toggle() } } label: {
                    HStack(spacing: 4) {
                        Text(reparto ?? "Reparto")
                            .font(AppFont.text(14, reparto == nil ? .regular : .semibold))
                            .foregroundStyle(reparto == nil ? palette.textSecondary : palette.textBody)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(palette.textSecondary)
                            .rotationEffect(.degrees(repartiAperti ? 180 : 0))
                    }
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(palette.borderQuiet))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reparto.map { "Reparto: \($0)" } ?? "Scegli reparto (opzionale)")
            }
            if repartiAperti {
                FlowLayout {
                    ForEach(reparti, id: \.self) { r in
                        Chip(r, state: reparto == r ? .selected : .default) {
                            // Tap the selected chip again to go back to "optional".
                            reparto = reparto == r ? nil : r
                            withAnimation(Motion.ui) { repartiAperti = false }
                        }
                    }
                }
            }

            field("Nota (es. quella in vetro)", $nota, .nota).onSubmit(submit).accessibilityLabel("Nota")

            HStack(spacing: 4) {
                PhotoButton(foto: $foto, errore: $erroreFoto)
                if foto != nil {
                    Button { foto = nil } label: {
                        Image(systemName: "xmark").font(.system(size: 14)).foregroundStyle(palette.textSecondary)
                            .frame(width: 32, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Rimuovi foto")
                }
                Spacer()
                Button("annulla") {
                    if let onCancel { onCancel() } else { aperto = false }
                }
                .font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
                .buttonStyle(.plain).padding(.horizontal, 12).frame(minHeight: 44)
                Button(confirmLabel, action: submit)
                    .buttonStyle(.paper(.primary, fullWidth: false, vertical: 11, horizontal: 22))
                    .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.top, 4)
            if let erroreFoto { StatusText(text: erroreFoto, kind: .error) }
        }
        .padding(12)
        .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.biro))
    }

    private func field(_ placeholder: String, _ text: Binding<String>, _ f: Field, weight: AppFont.Weight = .regular) -> some View {
        TextField(placeholder, text: text)
            .font(AppFont.text(14, weight))
            .foregroundStyle(palette.textBody)
            .focused($focus, equals: f)
            .submitLabel(.done)
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(focus == f ? palette.biro : palette.borderQuiet))
    }

    private func submit() {
        let trimmed = nome.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        onAdd(trimmed, reparto ?? Store.repartoRipiego, quantita.trimmingCharacters(in: .whitespaces), foto,
              TextImport.joinUnitAndNote(unita, nota))
        nome = ""
        quantita = "1"
        unita = ""
        nota = ""
        reparto = nil
        foto = nil
        repartiAperti = false
        focus = .nome
    }
}
