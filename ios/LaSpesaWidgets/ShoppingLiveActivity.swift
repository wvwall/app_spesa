import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen / Dynamic Island view of active shopping: progress and the next item to grab.
/// Follows the app theme chosen when shopping started ("sistema" tracks the device appearance).
struct ShoppingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShoppingActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("\(s.done) di \(s.total)", systemImage: "cart")
                        .font(.headline).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ProgressRing(done: s.done, total: s.total).frame(width: 30, height: 30)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    NextItem(state: s, palette: .scuro)
                }
            } compactLeading: {
                Image(systemName: "cart").foregroundStyle(Color(hex: 0x9DB1F7))
            } compactTrailing: {
                Text("\(s.done)/\(s.total)").monospacedDigit().foregroundStyle(Color(hex: 0x7CC493))
            } minimal: {
                ProgressRing(done: s.done, total: s.total)
            }
            .keylineTint(Color(hex: 0x9DB1F7))
        }
    }
}

private struct LockScreenView: View {
    let attributes: ShoppingActivityAttributes
    let state: ShoppingActivityAttributes.ContentState
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let palette = Palette.per(attributes.tema, system: scheme)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Label(attributes.storeName, systemImage: "cart")
                    .font(AppFont.text(15, .bold)).foregroundStyle(palette.textBody)
                Text("\(state.done) di \(state.total)")
                    .font(AppFont.text(13, .bold)).monospacedDigit().foregroundStyle(palette.textSecondary)
                Spacer()
                if state.pages > 1 { pager(palette) }
            }
            ProgressView(value: Double(state.done), total: Double(max(state.total, 1)))
                .tint(palette.basilico)
            if state.items.isEmpty {
                NextItem(state: state, palette: palette).padding(.top, 4)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.items) { item in itemRow(item, palette) }
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .environment(\.palette, palette)
        .activityBackgroundTint(palette.surfacePage)
        .activitySystemActionForegroundColor(palette.biro)
    }

    /// Tapping the circle ticks the item; it leaves the list and the next one moves up.
    private func itemRow(_ item: ShoppingActivityAttributes.Item, _ palette: Palette) -> some View {
        Button(intent: CheckShoppingItemIntent(itemId: item.id)) {
            HStack(spacing: 10) {
                Image(systemName: "circle")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(item.missing ? palette.pomodoro : palette.biro)
                Text(item.nome)
                    .font(AppFont.text(15, .semibold))
                    .foregroundStyle(palette.textBody)
                    .lineLimit(1)
                if item.missing {
                    Text("mancante").font(AppFont.text(11)).foregroundStyle(palette.pomodoro)
                }
                Spacer(minLength: 4)
                Text(item.quantita)
                    .font(AppFont.text(13)).monospacedDigit()
                    .foregroundStyle(palette.textSecondary)
                    .lineLimit(1)
            }
            .frame(height: 30)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Spunta \(item.nome)")
    }

    private func pager(_ palette: Palette) -> some View {
        HStack(spacing: 2) {
            Button(intent: TurnShoppingPageIntent(delta: -1)) {
                Image(systemName: "chevron.left").frame(width: 28, height: 24).contentShape(Rectangle())
            }
            .disabled(state.page == 0)
            .accessibilityLabel("Pagina precedente")
            Text("\(state.page + 1)/\(state.pages)")
                .font(AppFont.text(12, .bold)).monospacedDigit()
                .foregroundStyle(palette.textSecondary)
            Button(intent: TurnShoppingPageIntent(delta: 1)) {
                Image(systemName: "chevron.right").frame(width: 28, height: 24).contentShape(Rectangle())
            }
            .disabled(state.page >= state.pages - 1)
            .accessibilityLabel("Pagina successiva")
        }
        .buttonStyle(.plain)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(palette.biro)
    }
}

private struct NextItem: View {
    let state: ShoppingActivityAttributes.ContentState
    let palette: Palette

    var body: some View {
        let secondary = palette.textSecondary
        let primary = palette.textBody
        VStack(alignment: .leading, spacing: 2) {
        if let next = state.nextItem {
            VStack(alignment: .leading, spacing: 1) {
                Text(state.nextDepartment.map { "Prossimo · \($0)" } ?? "Prossimo")
                    .font(AppFont.text(11)).textCase(.uppercase).tracking(1).foregroundStyle(secondary)
                Text(next).font(AppFont.text(16, .semibold)).foregroundStyle(primary).lineLimit(1)
            }
        } else {
            Label("Tutto nel carrello", systemImage: "checkmark.circle.fill")
                .font(AppFont.text(15, .semibold)).foregroundStyle(palette.basilico)
        }
        if state.missing > 0 {
            Text(state.missing == 1 ? "1 mancante" : "\(state.missing) mancanti")
                .font(AppFont.text(12)).foregroundStyle(palette.pomodoro)
        }
        }
    }
}

private struct ProgressRing: View {
    let done: Int
    let total: Int
    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.25), lineWidth: 3)
            Circle().trim(from: 0, to: total > 0 ? CGFloat(done) / CGFloat(total) : 0)
                .stroke(Color(hex: 0x7CC493), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(2)
    }
}
