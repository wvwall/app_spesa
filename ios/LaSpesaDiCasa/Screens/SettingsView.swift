import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// Port of src/screens/Settings.tsx ("Opzioni"), organized the iOS way: a short grouped page with
/// the everyday settings inline, and rows that push a detail page for the rest.
struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var profili: [Profilo]
    @Query private var ingredienti: [Ingrediente]
    @State private var chiaveConfigurata = KeychainStore.geminiApiKey() != nil

    private var ingredientiAttivi: Int { ingredienti.filter { $0.deletedAt == nil }.count }

    enum Pagina: Hashable { case giorno, tema, allergie, reparti, ingredienti, gemini, backup }

    static let giorni: [(label: String, nome: String, valore: Int)] = [
        ("Lun", "Lunedì", 1), ("Mar", "Martedì", 2), ("Mer", "Mercoledì", 3), ("Gio", "Giovedì", 4),
        ("Ven", "Venerdì", 5), ("Sab", "Sabato", 6), ("Dom", "Domenica", 0),
    ]

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(title: "Opzioni")
            if let p = profili.first {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        SettingsGroup {
                            HStack {
                                Text("Porzioni").settingsRowTitle(palette)
                                Spacer()
                                Text("\(p.porzioniDefault) persone").font(AppFont.text(15, .bold)).foregroundStyle(palette.biro)
                                    .monospacedDigit().contentTransition(.numericText()).lineLimit(1).fixedSize()
                                Stepper("Porzioni", value: Binding(
                                    get: { p.porzioniDefault },
                                    set: { v in
                                        withAnimation(.snappy) { p.porzioniDefault = v }
                                        try? context.save()
                                    }
                                ), in: 1...20)
                                .labelsHidden()
                                .sensoryFeedback(.selection, trigger: p.porzioniDefault)
                            }
                            .settingsRowPadding()
                            SettingsDivider()
                            SettingsLink(.giorno, "Giorno della spesa") {
                                Text(Self.giorni.first { $0.valore == p.giornoSpesa }?.nome ?? "")
                            }
                            SettingsDivider()
                            SettingsLink(.tema, "Tema") { Text(nomeTema(p.tema)) }
                        }

                        SectionLabel("Cucina").padding(.top, 16).padding(.leading, 4)
                        SettingsGroup {
                            SettingsLink(.allergie, "Allergie e vincoli") {
                                if p.vincoliAlimentari.isEmpty {
                                    Text("Nessuno")
                                } else {
                                    Text(p.vincoliAlimentari.joined(separator: ", "))
                                        .font(AppFont.text(13, .semibold)).foregroundStyle(palette.pomodoro)
                                        .lineLimit(1)
                                }
                            }
                            SettingsDivider()
                            SettingsLink(.reparti, "Ordine reparti") { Text("\(p.ordineReparti.count)") }
                            SettingsDivider()
                            SettingsLink(.ingredienti, "Ingredienti") { Text("\(ingredientiAttivi)") }
                        }

                        SectionLabel("App").padding(.top, 16).padding(.leading, 4)
                        SettingsGroup {
                            SettingsLink(.gemini, "Google Gemini") {
                                Text(chiaveConfigurata ? "Configurata" : "Non configurata")
                            }
                            SettingsDivider()
                            SettingsLink(.backup, "Backup") { EmptyView() }
                        }

                        Text("Quaderno della spesa · v\(version) · dati salvati solo su questo telefono")
                            .font(AppFont.text(12)).foregroundStyle(palette.textSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 20)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            } else {
                Spacer()
            }
        }
        .background { NotebookBackground(watermark: nil) }
        // Title of the (hidden) bar: it becomes the "‹ Opzioni" back button on the detail pages.
        .navigationTitle("Opzioni")
        .navigationDestination(for: Pagina.self) { pagina in
            Group {
                switch pagina {
                case .giorno: GiornoSpesaPage()
                case .tema: TemaPage()
                case .allergie: AllergiePage()
                case .reparti: RepartiPage()
                case .ingredienti: IngredientiPage()
                case .gemini: GeminiPage()
                case .backup: BackupPage()
                }
            }
            .settingsDetailChrome()
        }
        .onReceive(NotificationCenter.default.publisher(for: .geminiKeyChanged)) { _ in
            chiaveConfigurata = KeychainStore.geminiApiKey() != nil
        }
    }

    private func nomeTema(_ t: Tema) -> String {
        switch t {
        case .sistema: "Automatico"
        case .chiaro: "Chiaro"
        case .scuro: "Scuro"
        case .stitch: "Stitch"
        }
    }
}

// MARK: - Grouped list pieces (notebook-styled)

private struct SettingsGroup<Content: View>: View {
    @Environment(\.palette) private var palette
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) { content }
            .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.borderQuiet))
    }
}

private struct SettingsDivider: View {
    @Environment(\.palette) private var palette
    var body: some View { Rectangle().fill(palette.borderQuiet).frame(height: 1).padding(.leading, 14) }
}

/// A row that pushes a detail page, with its current value and a chevron.
private struct SettingsLink<Value: View>: View {
    @Environment(\.palette) private var palette
    let pagina: SettingsView.Pagina
    let title: String
    @ViewBuilder var value: Value

    init(_ pagina: SettingsView.Pagina, _ title: String, @ViewBuilder value: () -> Value) {
        self.pagina = pagina
        self.title = title
        self.value = value()
    }

    var body: some View {
        NavigationLink(value: pagina) {
            HStack(spacing: 8) {
                Text(title).settingsRowTitle(palette)
                Spacer(minLength: 8)
                value
                    .font(AppFont.text(15))
                    .foregroundStyle(palette.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(palette.textSecondary.opacity(0.6))
            }
            .settingsRowPadding()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// A selectable row with a checkmark (giorno, tema).
private struct SettingsChoice: View {
    @Environment(\.palette) private var palette
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title).settingsRowTitle(palette)
                Spacer()
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(palette.biro)
                }
            }
            .settingsRowPadding()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: selected)
    }
}

private extension View {
    func settingsRowTitle(_ palette: Palette) -> some View {
        self.font(AppFont.text(16, .medium)).foregroundStyle(palette.textBody)
    }

    func settingsRowPadding() -> some View {
        self.padding(.horizontal, 14).frame(minHeight: 50)
    }

    /// Detail pages: notebook background and a visible, transparent bar with the native back button.
    func settingsDetailChrome() -> some View {
        self.background { NotebookBackground(watermark: nil) }
            .toolbarVisibility(.visible, for: .navigationBar)
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
    }
}

/// Page scaffold: handwritten title, then scrolling content with the page gutter.
private struct DetailPage<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                PageHeader(title: title).padding(.horizontal, -20).padding(.top, -8)
                content
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct Hint: View {
    @Environment(\.palette) private var palette
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 4)
    }
}

// MARK: - Detail pages

private struct GiornoSpesaPage: View {
    @Environment(\.modelContext) private var context
    @Query private var profili: [Profilo]

    var body: some View {
        DetailPage(title: "Giorno della spesa") {
            if let p = profili.first {
                SettingsGroup {
                    ForEach(Array(SettingsView.giorni.enumerated()), id: \.element.valore) { i, g in
                        if i > 0 { SettingsDivider() }
                        SettingsChoice(title: g.nome, selected: p.giornoSpesa == g.valore) {
                            p.giornoSpesa = g.valore
                            try? context.save()
                        }
                    }
                }
                Hint("La settimana in \"Settimana\" parte da qui: dalla cena di questo giorno al pranzo dello stesso giorno la settimana successiva.")
                    .padding(.top, 4)
            }
        }
    }
}

private struct TemaPage: View {
    @Environment(\.modelContext) private var context
    @Query private var profili: [Profilo]

    var body: some View {
        DetailPage(title: "Tema") {
            if let p = profili.first {
                SettingsGroup {
                    SettingsChoice(title: "Automatico", selected: p.tema == .sistema) { set(.sistema, p) }
                    SettingsDivider()
                    SettingsChoice(title: "Chiaro", selected: p.tema == .chiaro) { set(.chiaro, p) }
                    SettingsDivider()
                    SettingsChoice(title: "Scuro", selected: p.tema == .scuro) { set(.scuro, p) }
                    SettingsDivider()
                    SettingsChoice(title: "Stitch", selected: p.tema == .stitch) { set(.stitch, p) }
                }
                Hint(p.tema == .sistema
                     ? "Chiaro o scuro come il telefono."
                     : "La spesa in corsia resta sempre chiara, per leggere meglio sotto le luci del negozio.")
                    .padding(.top, 4)
                if p.tema == .stitch {
                    // A die-cut sticker stuck on the page, slightly tilted.
                    Image("stitch-sticker-3")
                        .resizable().scaledToFit().frame(width: 96)
                        .rotationEffect(.degrees(9))
                        .shadow(color: Color(red: 20 / 255, green: 33 / 255, blue: 61 / 255).opacity(0.22), radius: 3, y: 4)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, 12)
                        .accessibilityHidden(true)
                }
            }
        }
    }

    private func set(_ t: Tema, _ p: Profilo) {
        withAnimation(.easeInOut(duration: 0.25)) { p.tema = t }
        try? context.save()
    }
}

private struct AllergiePage: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var profili: [Profilo]
    @State private var nuovo = ""
    @State private var conferma: String?

    var body: some View {
        DetailPage(title: "Allergie e vincoli") {
            if let p = profili.first {
                let attivi = Set(p.vincoliAlimentari.compactMap { Allergens.trova($0)?.id })
                let suggeriti = Allergens.catalogo.filter { a in
                    !attivi.contains(a.id) && !p.vincoliAlimentari.contains { $0.lowercased() == a.etichetta.lowercased() }
                }
                if p.vincoliAlimentari.isEmpty {
                    Hint("Nessun vincolo attivo. L’AI non esclude nulla.")
                }
                FlowLayout {
                    ForEach(p.vincoliAlimentari, id: \.self) { a in
                        Chip("\(a) ×", state: .allergen) {
                            // Nuts are a safety constraint for the family: removing them needs confirmation.
                            if Allergens.trova(a)?.id == "frutta-a-guscio" {
                                withAnimation(Motion.ui) { conferma = a }
                            } else {
                                remove(a, p)
                            }
                        }
                        .accessibilityLabel("Rimuovi \(a)")
                    }
                }
                if let a = conferma {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Rimuovere “\(a)”? È un vincolo di sicurezza: per la famiglia l’allergia è critica. Confermi di volerlo disattivare?")
                            .font(AppFont.text(13)).foregroundStyle(palette.textBody)
                        HStack(spacing: 8) {
                            Button("Rimuovi") { remove(a, p) }.buttonStyle(.paperWarn)
                            Button("Annulla") { conferma = nil }.buttonStyle(.paperGhost)
                        }
                    }
                    .padding(12)
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.pomodoro))
                    .padding(.top, 4)
                }
                Hint("Le noci sono escluse di default. Ogni piatto generato dall’AI viene ricontrollato su questi vincoli; per allergie non riconosciute l’app non può garantire l’assenza, quindi controlla sempre gli ingredienti.")
                    .padding(.top, 4)
                if !suggeriti.isEmpty {
                    SectionLabel("Aggiungi un allergene comune").padding(.top, 16).padding(.leading, 4)
                    FlowLayout {
                        ForEach(suggeriti, id: \.id) { a in
                            Chip("+ \(a.etichetta)") { add(a.etichetta, p) }
                        }
                    }
                }
                HStack(spacing: 8) {
                    PaperField(placeholder: "Altra allergia…", text: $nuovo, fontSize: 14, radius: 12) { add(nuovo, p) }
                    Button("Aggiungi") { add(nuovo, p) }
                        .buttonStyle(.paper(.primary, fullWidth: false, fontSize: 14, vertical: 10, horizontal: 14))
                        .disabled(nuovo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.top, 12)
            }
        }
    }

    private func add(_ nome: String, _ p: Profilo) {
        let pulito = nome.trimmingCharacters(in: .whitespaces)
        guard !pulito.isEmpty else { return }
        if !p.vincoliAlimentari.contains(where: { $0.lowercased() == pulito.lowercased() }) {
            p.vincoliAlimentari.append(pulito)
            try? context.save()
        }
        nuovo = ""
    }

    private func remove(_ nome: String, _ p: Profilo) {
        p.vincoliAlimentari.removeAll { $0 == nome }
        try? context.save()
        conferma = nil
    }
}

private struct RepartiPage: View {
    @Environment(\.modelContext) private var context
    @Query private var profili: [Profilo]

    var body: some View {
        DetailPage(title: "Ordine reparti") {
            if let p = profili.first {
                Hint("Tieni premuto e trascina per riordinare. Così vengono raggruppati in lista e in negozio.")
                    .padding(.bottom, 4)
                DepartmentOrder(ordine: p.ordineReparti) { nuovo in
                    p.ordineReparti = nuovo
                    try? context.save()
                }
            }
        }
    }
}

/// The ingredient catalog: add, rename, change department or unit, delete (soft, with undo).
private struct IngredientiPage: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Environment(UndoCenter.self) private var undo
    @Query(sort: \Ingrediente.nome) private var ingredienti: [Ingrediente]
    @Query private var profili: [Profilo]
    @State private var query = ""
    @State private var editing: Ingrediente?
    @State private var nuovo = false

    private var ordine: [String] { profili.first?.ordineReparti ?? Store.defaultDepartments }

    var body: some View {
        let testo = query.trimmingCharacters(in: .whitespaces).lowercased()
        let visibili = ingredienti.filter {
            $0.deletedAt == nil && (testo.isEmpty || $0.nome.lowercased().contains(testo) || $0.alias.contains { $0.lowercased().contains(testo) })
        }
        DetailPage(title: "Ingredienti") {
            Hint("Il catalogo da cui scegli gli ingredienti dei piatti. Il reparto decide dove finiscono in lista.")
            SearchField(placeholder: "Cerca un ingrediente…", text: $query).padding(.top, 4)
            Button { nuovo = true } label: { Label("Nuovo ingrediente", systemImage: "plus") }
                .buttonStyle(.paperGhost)
                .padding(.top, 4)
            ForEach(Departments.group(visibili, ordine: ordine, reparto: \.reparto), id: \.reparto) { gruppo in
                SectionLabel("\(gruppo.reparto) (\(gruppo.voci.count))").padding(.top, 14).padding(.leading, 4)
                SettingsGroup {
                    ForEach(Array(gruppo.voci.enumerated()), id: \.element.id) { i, ing in
                        if i > 0 { SettingsDivider() }
                        Button { editing = ing } label: {
                            HStack {
                                Text(ing.nome).settingsRowTitle(palette)
                                Spacer()
                                Text(ing.unitaDefault).font(AppFont.text(14)).foregroundStyle(palette.textSecondary)
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(palette.textSecondary.opacity(0.6))
                            }
                            .settingsRowPadding()
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) { delete(ing) } label: { Label("Elimina", systemImage: "trash") }
                        }
                    }
                }
            }
            if visibili.isEmpty {
                Hint("Nessun ingrediente trovato.").padding(.top, 12)
            }
        }
        .sheet(item: $editing) { ing in
            IngredientEditSheet(ingrediente: ing, reparti: ordine, onDelete: { delete(ing) }) { editing = nil }
                .paperSheet(palette, detents: [.medium, .large])
        }
        .sheet(isPresented: $nuovo) {
            IngredientEditSheet(ingrediente: nil, reparti: ordine, initialName: query) { nuovo = false }
                .paperSheet(palette, detents: [.medium, .large])
        }
    }

    private func delete(_ ing: Ingrediente) {
        let nome = ing.nome
        let restore = Store(context: context).deleteIngredientWithUndo(ing)
        editing = nil
        undo.show("\(nome) eliminato", onUndo: restore)
    }
}

private struct IngredientEditSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    let ingrediente: Ingrediente?
    let reparti: [String]
    var initialName = ""
    var onDelete: (() -> Void)?
    var onClose: () -> Void

    @State private var nome = ""
    @State private var unita = ""
    @State private var reparto = Store.repartoRipiego
    @State private var loaded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                SheetHeader(title: ingrediente == nil ? "Nuovo ingrediente" : "Modifica ingrediente")
                PaperField(placeholder: "Nome", text: $nome, weight: .semibold)
                PaperField(placeholder: "Unità predefinita (es. 500 g, 1 pz)", text: $unita, autocapitalization: .never)
                SectionLabel("Reparto").padding(.top, 6)
                FlowLayout {
                    ForEach(reparti, id: \.self) { r in
                        Chip(r, state: reparto == r ? .selected : .default) { reparto = r }
                    }
                }
                Button("Salva", action: save)
                    .buttonStyle(.paper)
                    .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                    .padding(.top, 8)
                if let onDelete {
                    Button("Elimina ingrediente", action: onDelete).buttonStyle(.paperWarn)
                }
                Hint("I piatti che lo usano lo tengono con il nome e il reparto che avevano.")
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            nome = ingrediente?.nome ?? initialName
            unita = ingrediente?.unitaDefault ?? "1 pz"
            reparto = ingrediente?.reparto ?? (reparti.contains(Store.repartoRipiego) ? Store.repartoRipiego : reparti.first ?? Store.repartoRipiego)
        }
    }

    private func save() {
        let n = nome.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let store = Store(context: context)
        if let ingrediente {
            store.updateIngredient(ingrediente, nome: n, reparto: reparto, unita: unita.trimmingCharacters(in: .whitespaces))
        } else {
            let ing = store.addIngredient(nome: n, reparto: reparto)
            store.updateIngredient(ing, nome: n, reparto: reparto, unita: unita.trimmingCharacters(in: .whitespaces))
        }
        Haptics.success()
        onClose()
    }
}

private struct GeminiPage: View {
    @Environment(\.palette) private var palette
    @State private var configurata = KeychainStore.geminiApiKey() != nil
    @State private var dialog = false
    @State private var conferma = false
    @State private var messaggio: String?

    var body: some View {
        DetailPage(title: "Google Gemini") {
            Hint("Per i suggerimenti AI puoi usare solo Google Gemini. La chiave resta salvata su questo dispositivo.")
            SettingsGroup {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Chiave API").settingsRowTitle(palette)
                        Text(configurata ? "Configurata su questo dispositivo" : "Non configurata")
                            .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
                    }
                    Spacer()
                    Button(configurata ? "Sostituisci" : "Configura") { dialog = true }
                        .buttonStyle(.paper(.primary, fullWidth: false, fontSize: 13.5, vertical: 10, horizontal: 14))
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
            }
            .padding(.top, 4)
            if configurata && !conferma {
                Button("Rimuovi chiave") { conferma = true }
                    .buttonStyle(.paper(.warn, fontSize: 14))
                    .padding(.top, 8)
            }
            if conferma {
                Hint("Rimuovere la chiave da questo dispositivo? Le funzioni base continueranno a essere disponibili.")
                    .padding(.top, 8)
                HStack(spacing: 8) {
                    Button("Rimuovi") {
                        KeychainStore.removeGeminiApiKey()
                        conferma = false
                        messaggio = "Chiave Gemini rimossa da questo dispositivo."
                    }
                    .buttonStyle(.paperWarn)
                    Button("Annulla") { conferma = false }.buttonStyle(.paperGhost)
                }
            }
        }
        .toast($messaggio)
        .sheet(isPresented: $dialog) {
            GeminiKeySheet(onClose: { dialog = false }, onSaved: {
                dialog = false
                messaggio = "Chiave Gemini salvata su questo dispositivo."
            })
            .paperSheet(palette, detents: [.large])
        }
        .onReceive(NotificationCenter.default.publisher(for: .geminiKeyChanged)) { _ in
            configurata = KeychainStore.geminiApiKey() != nil
        }
    }
}

private struct BackupPage: View {
    @Environment(\.modelContext) private var context
    @State private var messaggio: String?
    @State private var exportDoc: BackupDocument?
    @State private var exporting = false
    @State private var importing = false

    var body: some View {
        DetailPage(title: "Backup") {
            Hint("Un file JSON con piatti, settimane e liste, compatibile con la versione web. La chiave Gemini non viene inclusa.")
            VStack(spacing: 8) {
                Button("Esporta backup (JSON)") {
                    do {
                        exportDoc = BackupDocument(data: try Store(context: context).exportBackupData())
                        exporting = true
                    } catch {
                        messaggio = "Esportazione non riuscita."
                    }
                }
                .buttonStyle(.paperGhost)
                Button("Importa backup") { importing = true }.buttonStyle(.paperGhost)
            }
            .padding(.top, 4)
            Hint("Importare sostituisce tutti i dati attuali di questo telefono.").padding(.top, 4)
        }
        .toast($messaggio)
        .fileExporter(isPresented: $exporting, document: exportDoc, contentType: .json,
                      defaultFilename: "spesa-di-casa-backup-\(isoNow().prefix(10)).json") { result in
            if case .failure = result { messaggio = "Esportazione non riuscita." }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let ok = url.startAccessingSecurityScopedResource()
                defer { if ok { url.stopAccessingSecurityScopedResource() } }
                try Store(context: context).importBackup(Data(contentsOf: url))
                messaggio = "Backup importato."
            } catch {
                messaggio = (error as? LocalizedError)?.errorDescription ?? "Import fallito."
            }
        }
    }
}

/// Long-press-and-drag reordering, like the PWA's pointer-events list: the dragged row follows the
/// finger and the others reorder live when it crosses a neighbor's midpoint.
private struct DepartmentOrder: View {
    @Environment(\.palette) private var palette
    let ordine: [String]
    var onCambia: ([String]) -> Void

    @State private var elementi: [String] = []
    @State private var trascinato: String?
    @State private var startIndex = 0
    @State private var offsetY: CGFloat = 0
    private let pitch: CGFloat = 48

    var body: some View {
        VStack(spacing: 6) {
            ForEach(elementi, id: \.self) { reparto in
                let attivo = trascinato == reparto
                HStack(spacing: 10) {
                    Image(systemName: "line.3.horizontal").foregroundStyle(palette.textSecondary)
                    Text(reparto).font(AppFont.text(14.5, .semibold)).foregroundStyle(palette.textBody)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .frame(height: 42)
                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(palette.borderQuiet))
                .shadow(color: .black.opacity(attivo ? 0.18 : 0), radius: 8, y: 6)
                .scaleEffect(attivo ? 1.02 : 1)
                .offset(y: attivo ? offsetY : 0)
                .zIndex(attivo ? 1 : 0)
                .gesture(
                    LongPressGesture(minimumDuration: 0.25)
                        .sequenced(before: DragGesture(minimumDistance: 0))
                        .onChanged { value in
                            guard case .second(true, let drag) = value else { return }
                            if trascinato == nil {
                                trascinato = reparto
                                startIndex = elementi.firstIndex(of: reparto) ?? 0
                            }
                            let delta = drag?.translation.height ?? 0
                            let target = max(0, min(elementi.count - 1, startIndex + Int((delta / pitch).rounded())))
                            if let current = elementi.firstIndex(of: reparto), current != target {
                                withAnimation(.easeOut(duration: 0.16)) {
                                    elementi.move(fromOffsets: IndexSet(integer: current), toOffset: target > current ? target + 1 : target)
                                }
                            }
                            offsetY = delta - CGFloat(target - startIndex) * pitch
                        }
                        .onEnded { _ in
                            withAnimation(.easeOut(duration: 0.16)) {
                                trascinato = nil
                                offsetY = 0
                            }
                            onCambia(elementi)
                        }
                )
                .sensoryFeedback(.selection, trigger: elementi)
                .accessibilityElement(children: .combine)
                .accessibilityActions {
                    Button("Sposta su") { move(reparto, by: -1) }
                    Button("Sposta giù") { move(reparto, by: 1) }
                }
            }
        }
        .onAppear { elementi = ordine }
        .onChange(of: ordine) { _, nuovo in if trascinato == nil { elementi = nuovo } }
    }

    private func move(_ reparto: String, by delta: Int) {
        guard let i = elementi.firstIndex(of: reparto) else { return }
        let j = max(0, min(elementi.count - 1, i + delta))
        guard i != j else { return }
        elementi.swapAt(i, j)
        onCambia(elementi)
    }
}
