import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// Port of src/screens/Settings.tsx ("Opzioni").
struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    @Query private var profili: [Profilo]

    @State private var messaggio: String?
    @State private var dialogChiave = false
    @State private var confermaRimozioneChiave = false
    @State private var chiaveConfigurata = KeychainStore.geminiApiKey() != nil
    @State private var nuovoAllergene = ""
    @State private var confermaRimozioneAllergene: String?
    @State private var exportDoc: BackupDocument?
    @State private var exporting = false
    @State private var importing = false

    private static let giorni: [(label: String, valore: Int)] = [
        ("Lun", 1), ("Mar", 2), ("Mer", 3), ("Gio", 4), ("Ven", 5), ("Sab", 6), ("Dom", 0),
    ]

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(title: "Opzioni")
            if let profilo = profili.first {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        porzioni(profilo)
                        giornoSpesa(profilo)
                        allergie(profilo)
                        reparti(profilo)
                        ai
                        backup
                        tema(profilo)
                        Text("Quaderno della spesa · v\(version) · dati salvati solo su questo telefono")
                            .font(AppFont.text(12)).foregroundStyle(palette.textSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 4)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
                .scrollDismissesKeyboard(.interactively)
            } else {
                Spacer()
            }
        }
        .background { NotebookBackground(watermark: nil) }
        .toast($messaggio)
        .sheet(isPresented: $dialogChiave) {
            GeminiKeySheet(onClose: { dialogChiave = false }, onSaved: {
                dialogChiave = false
                messaggio = "Chiave Gemini salvata su questo dispositivo."
            })
            .paperSheet(palette, detents: [.large])
        }
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
        .onReceive(NotificationCenter.default.publisher(for: .geminiKeyChanged)) { _ in
            chiaveConfigurata = KeychainStore.geminiApiKey() != nil
        }
    }

    // MARK: Sections

    private func porzioni(_ p: Profilo) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Porzioni")
            PaperCard(padding: 0) {
                HStack {
                    Text("Porzioni predefinite").font(AppFont.text(16, .semibold)).foregroundStyle(palette.textBody)
                    Spacer()
                    HStack(spacing: 4) {
                        stepButton("minus", "Diminuisci") { p.porzioniDefault = max(1, p.porzioniDefault - 1) }
                        Text("\(p.porzioniDefault) persone").font(AppFont.text(16, .bold)).foregroundStyle(palette.biro)
                            .monospacedDigit().contentTransition(.numericText())
                            .lineLimit(1).fixedSize()
                        stepButton("plus", "Aumenta") { p.porzioniDefault += 1 }
                    }
                }
                .padding(.leading, 14).padding(.vertical, 2)
            }
        }
    }

    private func stepButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) { action() }
            try? context.save()
        } label: {
            Image(systemName: icon).font(.system(size: 14, weight: .bold)).foregroundStyle(palette.textBody)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func giornoSpesa(_ p: Profilo) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Giorno della spesa")
            FlowLayout {
                ForEach(Self.giorni, id: \.valore) { g in
                    Chip(g.label, state: p.giornoSpesa == g.valore ? .selected : .default) {
                        p.giornoSpesa = g.valore
                        try? context.save()
                    }
                }
            }
            hint("La settimana in \"Settimana\" parte da qui: dalla cena di questo giorno al pranzo dello stesso giorno la settimana successiva.")
        }
    }

    private func allergie(_ p: Profilo) -> some View {
        let attivi = Set(p.vincoliAlimentari.compactMap { Allergens.trova($0)?.id })
        let suggeriti = Allergens.catalogo.filter { a in
            !attivi.contains(a.id) && !p.vincoliAlimentari.contains { $0.lowercased() == a.etichetta.lowercased() }
        }
        return VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Allergie e vincoli")
            if p.vincoliAlimentari.isEmpty {
                Text("Nessun vincolo attivo. L’AI non esclude nulla.").font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
            }
            FlowLayout {
                ForEach(p.vincoliAlimentari, id: \.self) { a in
                    Chip("\(a) ×", state: .allergen) {
                        // Nuts are a safety constraint for the family: removing them needs confirmation.
                        if Allergens.trova(a)?.id == "frutta-a-guscio" {
                            withAnimation(Motion.ui) { confermaRimozioneAllergene = a }
                        } else {
                            removeAllergene(a, from: p)
                        }
                    }
                    .accessibilityLabel("Rimuovi \(a)")
                }
            }
            if let a = confermaRimozioneAllergene {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Rimuovere “\(a)”? È un vincolo di sicurezza: per la famiglia l’allergia è critica. Confermi di volerlo disattivare?")
                        .font(AppFont.text(13)).foregroundStyle(palette.textBody)
                    HStack(spacing: 8) {
                        Button("Rimuovi") { removeAllergene(a, from: p) }.buttonStyle(.paperWarn)
                        Button("Annulla") { confermaRimozioneAllergene = nil }.buttonStyle(.paperGhost)
                    }
                }
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.pomodoro))
                .padding(.top, 4)
            }
            hint("Le noci sono escluse di default. Ogni piatto generato dall’AI viene ricontrollato su questi vincoli; per allergie non riconosciute l’app non può garantire l’assenza, quindi controlla sempre gli ingredienti.")
                .padding(.top, 2)
            if !suggeriti.isEmpty {
                hint("Aggiungi un allergene comune:").padding(.top, 4)
                FlowLayout {
                    ForEach(suggeriti, id: \.id) { a in
                        Chip("+ \(a.etichetta)") { addAllergene(a.etichetta, to: p) }
                    }
                }
            }
            HStack(spacing: 8) {
                PaperField(placeholder: "Altra allergia…", text: $nuovoAllergene, fontSize: 14, radius: 12) {
                    addAllergene(nuovoAllergene, to: p)
                }
                Button("Aggiungi") { addAllergene(nuovoAllergene, to: p) }
                    .buttonStyle(.paper(.primary, fullWidth: false, fontSize: 14, vertical: 10, horizontal: 14))
                    .disabled(nuovoAllergene.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.top, 4)
        }
    }

    private func reparti(_ p: Profilo) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Ordine reparti")
            hint("Tieni premuto e trascina per riordinare. Così vengono raggruppati in lista e in negozio.")
            DepartmentOrder(ordine: p.ordineReparti) { nuovo in
                p.ordineReparti = nuovo
                try? context.save()
            }
        }
    }

    private var ai: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Intelligenza artificiale")
            Text("Per i suggerimenti AI puoi usare solo Google Gemini. La chiave resta salvata su questo dispositivo.")
                .font(AppFont.text(13)).foregroundStyle(palette.textSecondary).padding(.bottom, 2)
            PaperCard(padding: 0) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Google Gemini").font(AppFont.text(16, .bold)).foregroundStyle(palette.textBody)
                        Text(chiaveConfigurata ? "Chiave configurata su questo dispositivo" : "Chiave non configurata")
                            .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
                    }
                    Spacer()
                    Button(chiaveConfigurata ? "Sostituisci" : "Configura") { dialogChiave = true }
                        .buttonStyle(.paper(.primary, fullWidth: false, fontSize: 13.5, vertical: 10, horizontal: 12))
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
            }
            if chiaveConfigurata && !confermaRimozioneChiave {
                Button("Rimuovi chiave") { confermaRimozioneChiave = true }
                    .buttonStyle(.paper(.warn, fontSize: 14))
            }
            if confermaRimozioneChiave {
                Text("Rimuovere la chiave da questo dispositivo? Le funzioni base continueranno a essere disponibili.")
                    .font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
                HStack(spacing: 8) {
                    Button("Rimuovi") {
                        KeychainStore.removeGeminiApiKey()
                        confermaRimozioneChiave = false
                        messaggio = "Chiave Gemini rimossa da questo dispositivo."
                    }
                    .buttonStyle(.paperWarn)
                    Button("Annulla") { confermaRimozioneChiave = false }.buttonStyle(.paperGhost)
                }
            }
        }
    }

    private var backup: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Backup")
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
    }

    private func tema(_ p: Profilo) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Tema")
            FlowLayout {
                Chip("Automatico", state: p.tema == .sistema ? .selected : .default) { setTema(.sistema, p) }
                Chip("Chiaro", state: p.tema == .chiaro ? .selected : .default) { setTema(.chiaro, p) }
                Chip("Scuro", state: p.tema == .scuro ? .selected : .default) { setTema(.scuro, p) }
                Chip("Stitch", state: p.tema == .stitch ? .selected : .default) { setTema(.stitch, p) }
            }
            if p.tema == .sistema {
                Text("Chiaro o scuro come il telefono.")
                    .font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topTrailing) {
            if p.tema == .stitch {
                // A die-cut sticker stuck on the page corner, slightly tilted.
                Image("stitch-sticker-3")
                    .resizable().scaledToFit().frame(width: 78)
                    .rotationEffect(.degrees(9))
                    .shadow(color: Color(red: 20 / 255, green: 33 / 255, blue: 61 / 255).opacity(0.22), radius: 3, y: 4)
                    .offset(x: 4, y: -10)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }

    // MARK: Helpers

    private func hint(_ text: String) -> some View {
        Text(text).font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary).fixedSize(horizontal: false, vertical: true)
    }

    private func setTema(_ t: Tema, _ p: Profilo) {
        withAnimation(.easeInOut(duration: 0.25)) { p.tema = t }
        try? context.save()
    }

    private func addAllergene(_ nome: String, to p: Profilo) {
        let pulito = nome.trimmingCharacters(in: .whitespaces)
        guard !pulito.isEmpty else { return }
        if !p.vincoliAlimentari.contains(where: { $0.lowercased() == pulito.lowercased() }) {
            p.vincoliAlimentari.append(pulito)
            try? context.save()
        }
        nuovoAllergene = ""
    }

    private func removeAllergene(_ nome: String, from p: Profilo) {
        p.vincoliAlimentari.removeAll { $0 == nome }
        try? context.save()
        confermaRimozioneAllergene = nil
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
