import SwiftUI
import UniformTypeIdentifiers

/// Port of components/import/ImportInput.tsx: text editor plus a local text-file picker.
struct ImportInput: View {
    @Environment(\.palette) private var palette
    @Binding var text: String
    var placeholder: String
    @State private var pickingFile = false
    @State private var erroreFile: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $text)
                    .font(AppFont.text(14))
                    .foregroundStyle(palette.textBody)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(minHeight: 160)
                if text.isEmpty {
                    Text(placeholder)
                        .font(AppFont.text(14))
                        .foregroundStyle(palette.textSecondary.opacity(0.7))
                        .padding(.horizontal, 13).padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
            .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(palette.borderQuiet))

            HStack(spacing: 12) {
                Button { pickingFile = true } label: {
                    Label("Carica un file di testo", systemImage: "doc.text")
                        .font(AppFont.text(14, .semibold)).frame(minHeight: 44)
                }
                .foregroundStyle(palette.biro)
                if !text.isEmpty {
                    Button { text = "" } label: {
                        Label("Svuota", systemImage: "xmark").font(AppFont.text(12)).frame(minHeight: 44)
                    }
                    .foregroundStyle(palette.textSecondary)
                }
            }
            .buttonStyle(.plain)
            if let erroreFile { StatusText(text: erroreFile, kind: .error) }
            Text("Puoi incollare anche l’intero testo: userò solo le righe che servono a questa pagina.")
                .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
        }
        .fileImporter(isPresented: $pickingFile, allowedContentTypes: [.plainText, UTType(filenameExtension: "md") ?? .plainText]) { result in
            do {
                let url = try result.get()
                let ok = url.startAccessingSecurityScopedResource()
                defer { if ok { url.stopAccessingSecurityScopedResource() } }
                text = try String(contentsOf: url, encoding: .utf8)
                erroreFile = nil
            } catch {
                erroreFile = "Non riesco a leggere questo file. Prova a incollare il testo."
            }
        }
    }
}

/// Include/exclude toggle shown at the right of each reviewed row.
private struct IncludeToggle: View {
    @Environment(\.palette) private var palette
    @Binding var included: Bool
    var body: some View {
        Button { included.toggle() } label: {
            Image(systemName: included ? "checkmark" : "arrow.counterclockwise")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(included ? palette.basilico : palette.pomodoro)
                .frame(width: 32, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(included ? "Escludi" : "Includi")
    }
}

private struct CheckBox: View {
    @Environment(\.palette) private var palette
    @Binding var on: Bool
    var label: String
    var body: some View {
        Button { on.toggle() } label: {
            Image(systemName: on ? "checkmark.square.fill" : "square")
                .font(.system(size: 20))
                .foregroundStyle(on ? palette.biro : palette.textSecondary)
                .frame(width: 32, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - Meals

/// Port of components/import/MealImportSheet.tsx.
struct MealImportSheet: View {
    @Environment(\.palette) private var palette
    var slots: [TextImport.SlotRef]
    var onClose: () -> Void
    var onConfirm: ([(slotId: String, nome: String)]) throws -> Void

    struct Riga: Identifiable { var draft: TextImport.MealDraft; var includi = true; var id: String { draft.slotId } }

    @State private var testo = ""
    @State private var righe: [Riga]?
    @State private var senzaSlot: [String] = []
    @State private var errore: String?

    private var incluse: Int { righe?.filter(\.includi).count ?? 0 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SheetHeader(title: "Importa il menù",
                            intro: "Incolla o carica il testo della settimana, poi controlla e correggi i pasti prima di salvarli. Gli ingredienti si importano dalla pagina Lista.")
                if righe == nil {
                    ImportInput(text: $testo, placeholder: "Venerdì cena: affettati e formaggi\nSabato pranzo: spinaci e uova\n…")
                    if slots.isEmpty {
                        StatusText(text: "Sto preparando la settimana: tra un istante potrai controllare il testo.")
                    }
                    if let errore { StatusText(text: errore, kind: .error) }
                    Button("Controlla il testo", action: analizza)
                        .buttonStyle(.paper)
                        .disabled(testo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || slots.isEmpty)
                } else {
                    review
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder private var review: some View {
        let tutti = (righe ?? []).allSatisfy(\.includi)
        HStack {
            Text("\(incluse) pasti da importare").font(AppFont.text(16, .bold)).foregroundStyle(palette.textBody)
            Spacer()
            Button(tutti ? "Deseleziona tutti" : "Seleziona tutti") {
                guard var r = righe else { return }
                for i in r.indices { r[i].includi = !tutti }
                righe = r
            }
            .font(AppFont.text(12, .semibold)).foregroundStyle(palette.biro)
        }
        if !senzaSlot.isEmpty {
            StatusText(text: senzaSlot.count == 1
                ? "Una riga non corrisponde a un pasto di questa settimana e resta fuori."
                : "\(senzaSlot.count) righe non corrispondono a pasti di questa settimana e restano fuori.")
        }
        VStack(spacing: 0) {
            ForEach(Binding(get: { righe ?? [] }, set: { righe = $0 })) { $riga in
                let giorno = CycleCalendar.fromIsoDate(riga.draft.dataIso).map(CycleCalendar.formatDayLabel) ?? riga.draft.dataIso
                HStack(alignment: .top, spacing: 8) {
                    CheckBox(on: $riga.includi, label: "Includi \(giorno) \(riga.draft.pasto.etichetta)")
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(giorno) · \(riga.draft.pasto.etichetta)").sectionLabelStyle(palette, tracking: 0.08)
                        PaperField(placeholder: "Nessun piatto (slot vuoto)", text: $riga.draft.nome, fontSize: 14)
                    }
                    IncludeToggle(included: $riga.includi)
                }
                .padding(.vertical, 10)
                .opacity(riga.includi ? 1 : 0.55)
                .overlay(alignment: .bottom) { Rectangle().fill(palette.borderQuiet).frame(height: 1) }
            }
        }
        if let errore { StatusText(text: errore, kind: .error) }
        Button("Salva \(incluse) pasti", action: conferma).buttonStyle(.paper).disabled(incluse == 0)
        Button { righe = nil } label: { Label("Indietro", systemImage: "arrow.left") }.buttonStyle(.paperGhost)
    }

    private func analizza() {
        let r = TextImport.parseMealText(testo, slots: slots)
        senzaSlot = r.senzaSlot
        if r.pasti.isEmpty {
            righe = nil
            errore = "Non ho trovato pasti tipo “Sabato pranzo: …”. Controlla il testo e riprova."
            return
        }
        righe = r.pasti.map { Riga(draft: $0) }
        errore = nil
    }

    private func conferma() {
        guard let righe else { return }
        let incluse = righe.filter(\.includi)
        guard !incluse.isEmpty else { return }
        do {
            try onConfirm(incluse.map { ($0.draft.slotId, $0.draft.nome) })
            onClose()
        } catch {
            errore = error.localizedDescription
        }
    }
}

// MARK: - Shopping

/// Port of components/import/ShoppingImportSheet.tsx.
struct ShoppingImportSheet: View {
    @Environment(\.palette) private var palette
    var catalogo: [TextImport.CatalogEntry]
    var reparti: [String]
    var onClose: () -> Void
    var onConfirm: ([Store.ShoppingImportEntry]) throws -> Void

    struct Riga: Identifiable { var draft: TextImport.ShoppingDraft; var id: String; var includi = true }

    @State private var testo = ""
    @State private var righe: [Riga]?
    @State private var ignorate = 0
    @State private var errore: String?

    private var incluse: Int { righe?.filter(\.includi).count ?? 0 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SheetHeader(title: "Importa la lista della spesa",
                            intro: "Incolla o carica gli ingredienti, poi controlla ogni articolo. Quelli già presenti vengono aggiornati, senza duplicati; i pasti si importano da Settimana.")
                if righe == nil {
                    ImportInput(text: $testo, placeholder: "4 uova\n1 confezione di spinaci\n2 confezioni di gamberi\n…")
                    if let errore { StatusText(text: errore, kind: .error) }
                    Button("Controlla il testo", action: analizza)
                        .buttonStyle(.paper)
                        .disabled(testo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || reparti.isEmpty)
                } else {
                    review
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder private var review: some View {
        let tutti = (righe ?? []).allSatisfy(\.includi)
        HStack {
            Text("\(incluse) articoli da importare").font(AppFont.text(16, .bold)).foregroundStyle(palette.textBody)
            Spacer()
            Button(tutti ? "Deseleziona tutti" : "Seleziona tutti") {
                guard var r = righe else { return }
                for i in r.indices { r[i].includi = !tutti }
                righe = r
            }
            .font(AppFont.text(12, .semibold)).foregroundStyle(palette.biro)
        }
        if ignorate > 0 {
            StatusText(text: ignorate == 1
                ? "Una riga non conteneva un articolo e resta fuori."
                : "\(ignorate) righe non contenevano articoli e restano fuori.")
        }
        VStack(spacing: 0) {
            ForEach(Binding(get: { righe ?? [] }, set: { righe = $0 })) { $riga in
                HStack(alignment: .top, spacing: 8) {
                    CheckBox(on: $riga.includi, label: "Includi \(riga.draft.nome)")
                    VStack(alignment: .leading, spacing: 6) {
                        PaperField(placeholder: "Nome articolo", text: $riga.draft.nome, weight: .semibold, fontSize: 14)
                        HStack(spacing: 8) {
                            PaperField(placeholder: "quantità", text: $riga.draft.quantita, fontSize: 14, keyboard: .decimalPad)
                                .frame(width: 116)
                            Menu {
                                Picker("Reparto", selection: $riga.draft.reparto) {
                                    ForEach(reparti, id: \.self) { Text($0).tag($0) }
                                }
                            } label: {
                                HStack {
                                    Text(riga.draft.reparto).lineLimit(1)
                                    Spacer(minLength: 4)
                                    Image(systemName: "chevron.up.chevron.down").imageScale(.small)
                                }
                                .font(AppFont.text(14))
                                .foregroundStyle(palette.textBody)
                                .padding(.horizontal, 10).padding(.vertical, 11)
                                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(palette.borderQuiet))
                            }
                            .accessibilityLabel("Reparto")
                        }
                        PaperField(placeholder: "nota (es. confezione)",
                                   text: Binding(get: { riga.draft.nota ?? "" },
                                                 set: { riga.draft.nota = $0.isEmpty ? nil : $0 }),
                                   fontSize: 14)
                        if !riga.draft.riconosciuto {
                            Text("Da controllare: reparto non riconosciuto.")
                                .font(AppFont.text(11.5)).foregroundStyle(palette.pomodoro)
                        }
                    }
                    IncludeToggle(included: $riga.includi)
                }
                .padding(.vertical, 12)
                .opacity(riga.includi ? 1 : 0.55)
                .overlay(alignment: .bottom) { Rectangle().fill(palette.borderQuiet).frame(height: 1) }
            }
        }
        if let errore { StatusText(text: errore, kind: .error) }
        Button("Salva \(incluse) articoli", action: conferma).buttonStyle(.paper).disabled(incluse == 0)
        Button { righe = nil } label: { Label("Indietro", systemImage: "arrow.left") }.buttonStyle(.paperGhost)
    }

    private func analizza() {
        let r = TextImport.parseShoppingText(testo, catalogo: catalogo, ordineReparti: reparti)
        ignorate = r.ignorate.count
        if r.righe.isEmpty {
            righe = nil
            errore = "Non ho trovato articoli da comprare. Controlla il testo e riprova."
            return
        }
        righe = r.righe.enumerated().map { Riga(draft: $1, id: "\($0)-\($1.nome)") }
        errore = nil
    }

    private func conferma() {
        guard let righe else { return }
        let incluse = righe.filter(\.includi)
        guard !incluse.isEmpty else { return }
        do {
            try onConfirm(incluse.map {
                Store.ShoppingImportEntry(nome: $0.draft.nome, quantita: $0.draft.quantita, reparto: $0.draft.reparto,
                                          nota: $0.draft.nota, ingredienteId: $0.draft.ingredienteId)
            })
            onClose()
        } catch {
            errore = error.localizedDescription
        }
    }
}
