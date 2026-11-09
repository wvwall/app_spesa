import SwiftUI

// MARK: - Button (primary / ghost / warn) — port of components/core/Button.tsx

struct PaperButtonStyle: ButtonStyle {
    enum Variant { case primary, ghost, warn }
    var variant: Variant = .primary
    var fullWidth = true
    var fontSize: CGFloat = 16
    var verticalPadding: CGFloat = 15
    var horizontalPadding: CGFloat = 16
    var radius: CGFloat = Metrics.radiusCard

    func makeBody(configuration: Configuration) -> some View {
        PaperButtonBody(configuration: configuration, style: self)
    }

    struct PaperButtonBody: View {
        let configuration: Configuration
        let style: PaperButtonStyle
        @Environment(\.palette) private var palette
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            let shape = RoundedRectangle(cornerRadius: style.radius, style: .continuous)
            configuration.label
                .font(AppFont.text(style.fontSize, .bold))
                .multilineTextAlignment(.center)
                .foregroundStyle(foreground)
                .padding(.vertical, style.variant == .primary ? style.verticalPadding : style.verticalPadding - 1.5)
                .padding(.horizontal, style.horizontalPadding)
                .frame(maxWidth: style.fullWidth ? .infinity : nil, minHeight: Metrics.touchMin)
                .background(style.variant == .primary ? palette.biroPieno : .clear, in: shape)
                .overlay {
                    if style.variant != .primary { shape.strokeBorder(foreground, lineWidth: 1.5) }
                }
                .contentShape(shape)
                .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.45)
                .scaleEffect(configuration.isPressed ? 0.98 : 1)
                .animation(Motion.ui, value: configuration.isPressed)
        }

        private var foreground: Color {
            switch style.variant {
            case .primary: palette.onBiro
            case .ghost: palette.biro
            case .warn: palette.pomodoro
            }
        }
    }
}

extension ButtonStyle where Self == PaperButtonStyle {
    static var paper: PaperButtonStyle { PaperButtonStyle() }
    static var paperGhost: PaperButtonStyle { PaperButtonStyle(variant: .ghost) }
    static var paperWarn: PaperButtonStyle { PaperButtonStyle(variant: .warn) }
    static func paper(_ variant: PaperButtonStyle.Variant, fullWidth: Bool = true, fontSize: CGFloat = 16,
                      vertical: CGFloat = 15, horizontal: CGFloat = 16, radius: CGFloat = Metrics.radiusCard) -> PaperButtonStyle {
        PaperButtonStyle(variant: variant, fullWidth: fullWidth, fontSize: fontSize,
                         verticalPadding: vertical, horizontalPadding: horizontal, radius: radius)
    }
}

/// The primary floating call to action: Liquid Glass tinted with the biro blue.
struct GlassCTA: View {
    @Environment(\.palette) private var palette
    var title: String
    var systemImage: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text(title).font(AppFont.text(16, .bold))
            } icon: {
                if let systemImage { Image(systemName: systemImage).fontWeight(.semibold) }
            }
            .frame(maxWidth: .infinity, minHeight: 30)
        }
        .buttonStyle(.glassProminent)
        .tint(palette.biroPieno)
        .controlSize(.large)
    }
}

// MARK: - Chip — components/core/Chip.tsx

struct Chip: View {
    enum State { case `default`, selected, owned, allergen }
    @Environment(\.palette) private var palette
    var title: String
    var state: State = .default
    var action: () -> Void

    init(_ title: String, state: State = .default, action: @escaping () -> Void) {
        self.title = title
        self.state = state
        self.action = action
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Metrics.radiusChip, style: .continuous)
        Button(action: action) {
            Text(title)
                .font(AppFont.text(14, .semibold, relativeTo: .subheadline))
                .foregroundStyle(foreground)
                .padding(.vertical, 9)
                .padding(.horizontal, 14)
                .background(background, in: shape)
                .overlay(shape.strokeBorder(border, lineWidth: 1))
                .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(state == .selected ? .isSelected : [])
    }

    private var foreground: Color {
        switch state {
        case .default: palette.textBody
        case .selected: palette.onEvidenziatore
        case .owned: palette.basilico
        case .allergen: palette.pomodoro
        }
    }

    private var background: Color {
        switch state {
        case .default: palette.surfaceCard
        case .selected: palette.evidenziatore
        case .owned, .allergen: .clear
        }
    }

    private var border: Color {
        switch state {
        case .default: palette.borderQuiet
        case .selected: palette.evidenziatoreBordo
        case .owned: palette.basilico
        case .allergen: palette.pomodoro
        }
    }
}

/// Wrapping row of chips (flex-wrap gap 8).
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? .infinity, subviews)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(bounds.width, subviews) {
            var x = bounds.minX
            for i in row.indices {
                let size = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(_ maxWidth: CGFloat, _ subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for i in subviews.indices {
            let size = subviews[i].sizeThatFits(.unspecified)
            let extra = rows[rows.count - 1].indices.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if extra > maxWidth, !rows[rows.count - 1].indices.isEmpty {
                rows.append(Row())
            }
            var row = rows[rows.count - 1]
            row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.indices.append(i)
            rows[rows.count - 1] = row
        }
        return rows.filter { !$0.indices.isEmpty }
    }
}

// MARK: - IconButton — components/core/IconButton.tsx

struct IconSquareButton: View {
    /// accent: main row action; neutral: secondary; danger: destructive (pomodoro icon).
    enum Tone { case neutral, accent, danger }
    @Environment(\.palette) private var palette
    var systemImage: String
    var label: String
    var tone: Tone = .neutral
    var size: CGFloat = 36
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(tone == .accent ? palette.biro : tone == .danger ? palette.pomodoro : palette.textSecondary)
                .frame(width: size, height: size)
                // Neutral/danger: card surface at 75%, less prominent than the opaque cards around it.
                .background(tone == .accent ? palette.biroChiaro : palette.surfaceCard.opacity(0.75),
                            in: RoundedRectangle(cornerRadius: Metrics.radiusChip, style: .continuous))
                .frame(minWidth: Metrics.touchMin, minHeight: Metrics.touchMin)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Text fields

/// Bordered paper text field (8pt radius, quiet border, biro when focused).
struct PaperField: View {
    @Environment(\.palette) private var palette
    var placeholder: String
    @Binding var text: String
    var weight: AppFont.Weight = .regular
    var fontSize: CGFloat = 16
    var keyboard: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var alignment: TextAlignment = .leading
    var radius: CGFloat = Metrics.radiusChip
    var onSubmit: () -> Void = {}
    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .font(AppFont.text(fontSize, weight))
            .foregroundStyle(palette.textBody)
            .multilineTextAlignment(alignment)
            .keyboardType(keyboard)
            .textInputAutocapitalization(autocapitalization)
            .focused($focused)
            .submitLabel(.done)
            .onSubmit(onSubmit)
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(focused ? palette.biro : palette.borderQuiet, lineWidth: 1))
    }
}

/// Search input — components/core/SearchInput.tsx.
struct SearchField: View {
    var placeholder = "Cerca ingrediente…"
    @Binding var text: String
    var body: some View {
        PaperField(placeholder: placeholder, text: $text, autocapitalization: .never)
    }
}

// MARK: - Labels, cards, badges

struct SectionLabel: View {
    @Environment(\.palette) private var palette
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).sectionLabelStyle(palette).frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PaperCard<Content: View>: View {
    @Environment(\.palette) private var palette
    var borderColor: Color?
    var padding: CGFloat = 14
    var radius: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(borderColor ?? palette.borderQuiet, lineWidth: 1))
    }
}

struct AIBadge: View {
    @Environment(\.palette) private var palette
    var body: some View {
        Label("AI", systemImage: "sparkles")
            .labelStyle(TightLabelStyle(spacing: 4))
            .font(AppFont.text(11, .regular, relativeTo: .caption2))
            .foregroundStyle(palette.biro)
            .padding(.vertical, 3)
            .padding(.horizontal, 8)
            .background(palette.biroChiaro, in: Capsule())
    }
}

struct TightLabelStyle: LabelStyle {
    var spacing: CGFloat = 4
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: spacing) {
            configuration.icon.imageScale(.small)
            configuration.title
        }
    }
}

struct OfflineBadge: View {
    @Environment(\.palette) private var palette
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi.slash").foregroundStyle(palette.basilico).imageScale(.small)
            Text("Offline — tutto salvato sul telefono")
        }
        .font(AppFont.text(12, relativeTo: .caption))
        .foregroundStyle(palette.textSecondary)
    }
}

/// Shimmer block in the graph-paper palette (index.css .skeleton-shimmer).
struct SkeletonBlock: View {
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var width: CGFloat?
    var height: CGFloat = 14
    var radius: CGFloat = 6
    @State private var phase: CGFloat = -1

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(LinearGradient(
                stops: [
                    .init(color: palette.borderQuiet, location: 0.25),
                    .init(color: palette.surfaceCard, location: 0.37),
                    .init(color: palette.borderQuiet, location: 0.63),
                ],
                startPoint: UnitPoint(x: phase, y: 0.5), endPoint: UnitPoint(x: phase + 2, y: 0.5)))
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: false)) { phase = -2 }
            }
            .accessibilityHidden(true)
    }
}

// MARK: - CycleNavigator — components/navigation/CycleNavigator.tsx
// Native iOS 26 grouping: the three controls share a single Liquid Glass capsule.

struct CycleNavigator: View {
    @Environment(\.palette) private var palette
    var onPrecedente: () -> Void
    var onOggi: () -> Void
    var onSuccessivo: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onPrecedente) {
                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Settimana precedente")
            .foregroundStyle(palette.textSecondary)
            Button(action: onOggi) {
                Text("oggi").font(AppFont.text(14, .semibold)).padding(.horizontal, 4).frame(height: 40)
                    .contentShape(Rectangle())
            }
            .foregroundStyle(palette.biro)
            Button(action: onSuccessivo) {
                Image(systemName: "chevron.right").font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Settimana successiva")
            .foregroundStyle(palette.textSecondary)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 2)
        .glassEffect(.regular.interactive(), in: Capsule())
    }
}

// MARK: - PageHeader — components/navigation/PageHeader.tsx

/// Shared header of the four tabs: handwritten biro title on a fixed 44pt row (so it never jumps
/// between tabs), optional actions on the right and a small subtitle.
struct PageHeader<Actions: View>: View {
    @Environment(\.palette) private var palette
    var title: String
    var subtitle: String?
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                // Caveat's last glyph overhangs its advance width and would be clipped: a trailing
                // no-break space keeps it inside the drawn bounds.
                Text(title + "\u{00A0}")
                    .font(AppFont.hand(28, .semibold, relativeTo: .title))
                    .tracking(-0.56)
                    .foregroundStyle(palette.biro)
                    .fixedSize()
                    .accessibilityLabel(title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                actions
            }
            .frame(minHeight: 44)
            if let subtitle {
                Text(subtitle).font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }
}

extension PageHeader where Actions == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle) { EmptyView() }
    }
}

// MARK: - Undo toast — components/feedback/UndoToast.tsx

/// Deletes happen immediately; this toast gives 5 seconds to take them back. A newer deletion
/// replaces the previous toast.
@Observable
final class UndoCenter {
    static let duration: Duration = .seconds(5)
    struct Request: Identifiable {
        let id = UUID()
        var message: String
        var onUndo: () -> Void
    }
    var current: Request?

    func show(_ message: String, onUndo: @escaping () -> Void) {
        current = Request(message: message, onUndo: onUndo)
    }
}

struct UndoToast: View {
    @Environment(\.palette) private var palette
    @Bindable var center: UndoCenter
    @State private var progress: CGFloat = 1

    var body: some View {
        if let req = center.current {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text(req.message).font(AppFont.text(14)).lineLimit(2)
                    Spacer(minLength: 0)
                    Button {
                        center.current = nil
                        req.onUndo()
                    } label: {
                        Text("Annulla").font(AppFont.text(14, .bold)).underline().padding(.horizontal, 14)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.leading, 16).padding(.trailing, 6).padding(.vertical, 6)
                GeometryReader { geo in
                    Rectangle().fill(palette.surfacePage.opacity(0.55))
                        .frame(width: geo.size.width * progress)
                }
                .frame(height: 3)
            }
            // Inverted note: dark on a light page, light on the dark one.
            .foregroundStyle(palette.surfacePage)
            .background(palette.textBody, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 10, y: 6)
            .frame(maxWidth: 420)
            .padding(.horizontal, 14)
            .id(req.id)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: req.id) {
                progress = 1
                withAnimation(.linear(duration: 5)) { progress = 0 }
                try? await Task.sleep(for: UndoCenter.duration)
                if center.current?.id == req.id { withAnimation { center.current = nil } }
            }
            .accessibilityElement(children: .contain)
        }
    }
}

// MARK: - Toast (glass capsule) — components/feedback/Toast.tsx

struct ToastModifier: ViewModifier {
    @Binding var message: String?
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let message {
                Text(message)
                    .font(AppFont.text(14, .medium))
                    .foregroundStyle(palette.textBody)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .glassEffect(.regular, in: Capsule())
                    .padding(.top, 8)
                    .padding(.horizontal, 24)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: message) {
                        try? await Task.sleep(for: .seconds(3))
                        withAnimation { self.message = nil }
                    }
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .animation(.snappy, value: message)
    }
}

extension View {
    func toast(_ message: Binding<String?>) -> some View { modifier(ToastModifier(message: message)) }
}

// MARK: - Sheet chrome — components/navigation/BottomSheet.tsx

struct SheetHeader: View {
    @Environment(\.palette) private var palette
    var title: String
    var intro: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(AppFont.display(18, relativeTo: .headline))
                .tracking(-0.18)
                .foregroundStyle(palette.textBody)
            if let intro {
                Text(intro)
                    .font(AppFont.text(13.5, relativeTo: .subheadline))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.bottom, 12)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    /// Standard bottom sheet presentation: native Liquid Glass sheet, drag indicator, themed.
    func paperSheet(_ palette: Palette, detents: Set<PresentationDetent> = [.medium, .large]) -> some View {
        self
            .palette(palette)
            .presentationDetents(detents)
            .presentationDragIndicator(.visible)
    }
}

struct AltOption: View {
    @Environment(\.palette) private var palette
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppFont.text(16, .semibold))
                .foregroundStyle(palette.textBody)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 13)
                .padding(.horizontal, 14)
                .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(palette.borderQuiet))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Small inline status text (error in tomato, success in basil, info in secondary ink).
struct StatusText: View {
    enum Kind { case error, success, info }
    @Environment(\.palette) private var palette
    var text: String
    var kind: Kind = .info

    var body: some View {
        Text(text)
            .font(AppFont.text(13, relativeTo: .footnote))
            .foregroundStyle(kind == .error ? palette.pomodoro : kind == .success ? palette.basilico : palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(kind == .error ? .isStaticText : [])
    }
}
