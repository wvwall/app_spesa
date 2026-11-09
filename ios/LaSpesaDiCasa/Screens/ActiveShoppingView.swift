import SwiftData
import SwiftUI

/// Port of src/screens/ActiveShopping.tsx. Always light (DESIGN.md §4.1: under supermarket lights
/// dark-on-light reads best), sheets opened from here included.
struct ActiveShoppingView: View {
    @Environment(\.modelContext) private var context
    @Environment(NetworkMonitor.self) private var network
    let listId: String
    var onClose: () -> Void

    @Query private var tutteVoci: [VoceLista]
    @Query private var profili: [Profilo]
    @State private var missingItem: VoceLista?
    @State private var openPhoto: VoceLista?

    private let palette = Palette.chiaro

    var body: some View {
        let voci = tutteVoci.filter { $0.listaId == listId }
        let fatti = voci.filter(\.checked).count
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Button(action: onClose) {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(palette.textBody)
                            .frame(width: 22, height: 22)
                    }
                    .buttonStyle(.glass)
                    .buttonBorderShape(.circle)
                    .accessibilityLabel("Chiudi")
                    Text("Esselunga").font(AppFont.text(15, .bold)).foregroundStyle(palette.textBody)
                    Spacer()
                }
                ShoppingProgress(done: fatti, total: voci.count)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 8)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Departments.group(voci, ordine: profili.first?.ordineReparti ?? [], reparto: \.reparto), id: \.reparto) { gruppo in
                        Text(gruppo.reparto)
                            .font(AppFont.text(12, .bold, relativeTo: .caption))
                            .textCase(.uppercase)
                            .tracking(12 * 0.14)
                            .foregroundStyle(palette.inchiostro70)
                            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 4)
                            .accessibilityAddTraits(.isHeader)
                        ForEach(gruppo.voci) { v in row(v) }
                    }
                }
                .padding(.bottom, 16)
            }
            .overlay(alignment: .top) { Rectangle().fill(palette.quadretto).frame(height: 1) }

            if !network.online {
                OfflineBadge().padding(.top, 8).padding(.bottom, 20)
            }
        }
        .background(palette.surfacePage.ignoresSafeArea())
        .sempreChiaro()
        .sheet(item: $missingItem) { voce in
            MissingSheet(voce: voce) { missingItem = nil }
                .sempreChiaro()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(item: $openPhoto) { voce in
            PhotoViewer(voce: voce) { openPhoto = nil }
        }
    }

    private func row(_ v: VoceLista) -> some View {
        let parts = TextImport.splitUnitFromNote(v.nota)
        return HStack(spacing: 0) {
            ShoppingListRow(
                name: v.sostituitoCon ?? v.nome,
                qty: [v.quantita, parts.unita ?? ""].filter { !$0.isEmpty }.joined(separator: " "),
                note: parts.nota,
                checked: v.checked,
                substituted: v.sostituitoCon != nil,
                missing: v.mancante == true
            ) {
                Store(context: context).toggle(v, checked: !v.checked)
            }
            if v.fotoJPEG != nil {
                Button { openPhoto = v } label: {
                    Image(systemName: "photo").font(.system(size: 18)).foregroundStyle(palette.biro)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Apri foto di \(v.nome)")
            }
            if !v.checked {
                Button { missingItem = v } label: {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 17, weight: v.mancante == true ? .bold : .regular))
                        // Neutral until actually marked missing: red is reserved for that.
                        .foregroundStyle(v.mancante == true ? palette.pomodoro : palette.inchiostro70)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(v.mancante == true ? "\(v.nome): segnato come mancante" : "Manca \(v.nome)?")
                .padding(.trailing, 4)
            }
        }
        .contextMenu {
            if !v.checked {
                Button { missingItem = v } label: { Label("Manca qualcosa?", systemImage: "exclamationmark.triangle") }
            }
        }
    }
}

/// "Non trovi X?" sheet with the pre-generated alternatives.
private struct MissingSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.palette) private var palette
    let voce: VoceLista
    var onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SheetHeader(title: "Non trovi \(voce.nome)?",
                            intro: voce.alternative.isEmpty ? "Nessuna alternativa suggerita per questo articolo." : "Vanno bene anche:")
                ForEach(voce.alternative, id: \.self) { alt in
                    AltOption(label: alt) {
                        Store(context: context).replace(voce, with: alt)
                        onClose()
                    }
                }
                if !voce.alternative.isEmpty {
                    Label("alternative suggerite", systemImage: "checkmark.shield")
                        .labelStyle(TightLabelStyle())
                        .font(AppFont.text(12)).foregroundStyle(palette.basilico)
                }
                VStack(spacing: 8) {
                    Button(voce.mancante == true ? "L'ho trovato, non manca più" : "Segna come mancante") {
                        Store(context: context).setMissing(voce, !(voce.mancante == true))
                        onClose()
                    }
                    .buttonStyle(voce.mancante == true ? .paperGhost : .paperWarn)
                    Button("Chiudi", action: onClose)
                        .font(AppFont.text(14, .semibold)).foregroundStyle(palette.inchiostro70)
                        .buttonStyle(.plain).frame(minHeight: 44)
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
        }
    }
}

private struct PhotoViewer: View {
    let voce: VoceLista
    var onClose: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.opacity(0.82).ignoresSafeArea().onTapGesture(perform: onClose)
            if let data = voce.fotoJPEG, let ui = UIImage(data: data) {
                Image(uiImage: ui).resizable().scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Foto di \(voce.nome)")
            }
            Button(action: onClose) {
                Image(systemName: "xmark").font(.system(size: 20, weight: .semibold)).frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .padding(16)
            .accessibilityLabel("Chiudi foto")
        }
        .presentationBackground(.clear)
    }
}
