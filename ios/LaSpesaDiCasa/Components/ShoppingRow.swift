import SwiftUI

/// The signature pen stroke across a checked item: "M2 8 C 60 3, 108 12, 156 7 S 220 9, 240 6"
/// in a 244×14 box, stretched to the text width.
nonisolated struct PenStrokeShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 244, sy = rect.height / 14
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        path.move(to: p(2, 8))
        path.addCurve(to: p(156, 7), control1: p(60, 3), control2: p(108, 12))
        // "S" reflects the previous control point (108,12) around (156,7) → (204,2).
        path.addCurve(to: p(240, 6), control1: p(204, 2), control2: p(220, 9))
        return path
    }
}

/// The tick inside the checkbox: "M5 13 L11 20 L26 4" in a 32×32 box.
nonisolated struct TickShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 32
        var path = Path()
        path.move(to: CGPoint(x: 5 * s, y: 13 * s))
        path.addLine(to: CGPoint(x: 11 * s, y: 20 * s))
        path.addLine(to: CGPoint(x: 26 * s, y: 4 * s))
        return path
    }
}

/// Port of components/shopping/ShoppingListRow.tsx: the whole row toggles; checking draws the
/// biro tick (220ms) then the irregular strike-through (240ms, 50ms delay).
struct ShoppingListRow: View {
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var name: String
    var qty: String?
    var note: String?
    var checked: Bool
    var substituted = false
    var missing = false
    var onToggle: () -> Void

    @State private var tick: CGFloat = 0
    @State private var stroke: CGFloat = 0

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(Color.white)
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .strokeBorder(checked ? palette.biro : palette.inchiostro70, lineWidth: 2)
                    TickShape()
                        .trim(from: 0, to: tick)
                        .stroke(palette.biro, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                        .frame(width: 32, height: 32)
                }
                .frame(width: 24, height: 24)

                VStack(alignment: .leading, spacing: 0) {
                    titleLine
                    if let note, !note.isEmpty {
                        Text("“\(note)”")
                            .font(AppFont.hand(17, .medium))
                            .foregroundStyle(palette.biro)
                            .rotationEffect(.degrees(-1.2), anchor: .leading)
                    }
                }
                .overlay {
                    GeometryReader { geo in
                        PenStrokeShape()
                            .trim(from: 0, to: stroke)
                            .stroke(palette.biro.opacity(0.9), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
                            .frame(width: geo.size.width + 10, height: 14)
                            .position(x: geo.size.width / 2 + 1, y: geo.size.height / 2)
                    }
                    .allowsHitTesting(false)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 20)
            .frame(minHeight: Metrics.rigaCorsia)
            .opacity(checked ? 0.72 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottom) {
            DashedLine().stroke(palette.quadretto, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
        }
        .sensoryFeedback(.selection, trigger: checked)
        .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)
        .accessibilityValue(checked ? "preso" : "da prendere")
        .onAppear {
            tick = checked ? 1 : 0
            stroke = checked ? 1 : 0
        }
        .onChange(of: checked) { _, now in
            if now && !reduceMotion {
                withAnimation(Motion.pennata) { tick = 1 }
                withAnimation(Motion.stroke) { stroke = 1 }
            } else {
                tick = now ? 1 : 0
                stroke = now ? 1 : 0
            }
        }
    }

    private var titleLine: some View {
        let nameText = Text(name)
            .font(AppFont.text(19, .semibold, relativeTo: .title3))
            .foregroundStyle(checked ? palette.inchiostro70 : palette.textBody)
        let qtyText = Text(qty.map { $0.isEmpty ? "" : " · \($0)" } ?? "")
            .font(AppFont.text(16, .medium))
            .foregroundStyle(palette.inchiostro70)
            .monospacedDigit()
        let text = Text("\(nameText)\(qtyText)")
        return HStack(spacing: 8) {
            text.tracking(-0.19)
            if substituted {
                Text("sostituito")
                    .font(AppFont.text(11, .medium, relativeTo: .caption2))
                    .foregroundStyle(.white)
                    .padding(.vertical, 2).padding(.horizontal, 8)
                    .background(palette.biroPieno, in: Capsule())
            }
            if missing && !checked {
                Text("manca")
                    .font(AppFont.text(11, .semibold, relativeTo: .caption2))
                    .foregroundStyle(palette.pomodoro)
                    .padding(.vertical, 1).padding(.horizontal, 8)
                    .overlay(Capsule().strokeBorder(palette.pomodoro))
            }
        }
    }
}

nonisolated struct DashedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return p
    }
}

/// Port of components/shopping/ShoppingProgress.tsx.
struct ShoppingProgress: View {
    @Environment(\.palette) private var palette
    var done: Int
    var total: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(palette.quadretto)
                    Capsule().fill(palette.basilico)
                        .frame(width: total > 0 ? geo.size.width * CGFloat(done) / CGFloat(total) : 0)
                        .animation(.easeOut(duration: 0.35), value: done)
                }
            }
            .frame(height: 6)
            let fatti = Text("\(done)").font(AppFont.text(13, .bold)).foregroundStyle(palette.textBody)
            let totale = Text(" di \(total)").font(AppFont.text(13)).foregroundStyle(palette.inchiostro70)
            Text("\(fatti)\(totale)").monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(done) di \(total) presi")
    }
}
