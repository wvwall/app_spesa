import SwiftUI

/// Port of components/dishes/DishCard.tsx: a meal slot row (filled, or dashed "aggiungi piatto").
struct DishCard: View {
    @Environment(\.palette) private var palette
    var pasto: Pasto
    var dish: String?
    var ai = false
    var action: () -> Void

    private var empty: Bool { dish == nil }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous)
        Button(action: action) {
            HStack(spacing: 10) {
                HStack(spacing: 3) {
                    Image(systemName: pasto == .cena ? "moon" : "sun.max").imageScale(.small)
                    Text(pasto.etichetta)
                }
                .font(AppFont.text(12, relativeTo: .caption))
                .foregroundStyle(palette.textSecondary)
                .frame(width: 58, alignment: .leading)

                HStack(spacing: 5) {
                    if empty {
                        Image(systemName: "plus").font(.system(size: 14, weight: .semibold)).foregroundStyle(palette.biro)
                    }
                    Text(dish ?? "aggiungi piatto")
                        .font(AppFont.text(15.5, empty ? .medium : .semibold))
                        .foregroundStyle(empty ? palette.textSecondary : palette.textBody)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                if ai { AIBadge() }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(empty ? Color.clear : palette.surfaceCard, in: shape)
            .overlay(shape.strokeBorder(palette.borderQuiet, style: StrokeStyle(lineWidth: 1, dash: empty ? [4, 3] : [])))
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(dish.map { "\(pasto.etichetta): \($0)" } ?? "\(pasto.etichetta): aggiungi piatto")
    }
}

/// Port of components/dishes/ProposalCard.tsx.
struct ProposalCard: View {
    @Environment(\.palette) private var palette
    var eyebrow = "Proposta"
    var title: String
    var meta: String?
    var have: String?
    var buy: String?
    var allergieVerificate: [String] = []
    var allergieNonVerificate: [String] = []
    var onAccept: () -> Void
    var onRegenerate: () -> Void

    var body: some View {
        PaperCard(padding: 16, radius: Metrics.radiusCard) {
            VStack(alignment: .leading, spacing: 0) {
                Label(eyebrow, systemImage: "sparkles")
                    .labelStyle(TightLabelStyle(spacing: 5))
                    .font(AppFont.text(11, relativeTo: .caption2))
                    .textCase(.uppercase)
                    .tracking(1.3)
                    .foregroundStyle(palette.biro)
                    .padding(.bottom, 6)
                Text(title)
                    .font(AppFont.display(21, relativeTo: .title3))
                    .tracking(-0.2)
                    .foregroundStyle(palette.textBody)
                    .padding(.bottom, 2)
                if let meta {
                    Text(meta).font(AppFont.text(13)).foregroundStyle(palette.textSecondary).padding(.bottom, 10)
                }
                if let have {
                    Text("Hai già: \(have)").font(AppFont.text(13.5)).foregroundStyle(palette.basilico)
                }
                if let buy {
                    Text("Da comprare: \(buy)").font(AppFont.text(13.5)).foregroundStyle(palette.biro).padding(.bottom, 12)
                }
                if !allergieVerificate.isEmpty {
                    Label("verificato: senza \(allergieVerificate.joined(separator: ", "))", systemImage: "checkmark.shield")
                        .labelStyle(TightLabelStyle())
                        .font(AppFont.text(12))
                        .foregroundStyle(palette.basilico)
                        .padding(.bottom, allergieNonVerificate.isEmpty ? 12 : 4)
                }
                if !allergieNonVerificate.isEmpty {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "exclamationmark.triangle").imageScale(.small)
                        Text("Da controllare tu: l’AI non verifica automaticamente \(allergieNonVerificate.joined(separator: ", ")).")
                    }
                    .font(AppFont.text(12))
                    .foregroundStyle(palette.pomodoro)
                    .padding(.bottom, 12)
                }
                HStack(spacing: 8) {
                    Button("Va bene", action: onAccept)
                        .buttonStyle(.paper(.primary, fontSize: 14, vertical: 11, radius: 10))
                    Button("Rigenera", action: onRegenerate)
                        .buttonStyle(.paper(.ghost, fontSize: 14, vertical: 11, radius: 10))
                }
            }
        }
    }
}
