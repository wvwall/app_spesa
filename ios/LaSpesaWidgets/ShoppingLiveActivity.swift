import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen / Dynamic Island view of active shopping: progress and the next item to grab.
/// Always light, like the aisle screen itself.
struct ShoppingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShoppingActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Palette.chiaro.surfacePage)
                .activitySystemActionForegroundColor(Palette.chiaro.biro)
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
                    NextItem(state: s, dark: true)
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
    private let palette = Palette.chiaro

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(attributes.storeName, systemImage: "cart")
                    .font(AppFont.text(15, .bold)).foregroundStyle(palette.textBody)
                Spacer()
                Text(attributes.weekLabel).font(AppFont.hand(18, .semibold)).foregroundStyle(palette.biro)
            }
            ProgressView(value: Double(state.done), total: Double(max(state.total, 1)))
                .tint(palette.basilico)
            HStack(alignment: .firstTextBaseline) {
                NextItem(state: state, dark: false)
                Spacer()
                Text("\(state.done) di \(state.total)")
                    .font(AppFont.text(13, .bold)).monospacedDigit().foregroundStyle(palette.textBody)
            }
        }
        .padding(16)
        .environment(\.palette, palette)
    }
}

private struct NextItem: View {
    let state: ShoppingActivityAttributes.ContentState
    let dark: Bool

    var body: some View {
        let secondary = dark ? Color.white.opacity(0.7) : Palette.chiaro.textSecondary
        let primary = dark ? Color.white : Palette.chiaro.textBody
        VStack(alignment: .leading, spacing: 2) {
        if let next = state.nextItem {
            VStack(alignment: .leading, spacing: 1) {
                Text(state.nextDepartment.map { "Prossimo · \($0)" } ?? "Prossimo")
                    .font(AppFont.text(11)).textCase(.uppercase).tracking(1).foregroundStyle(secondary)
                Text(next).font(AppFont.text(16, .semibold)).foregroundStyle(primary).lineLimit(1)
            }
        } else {
            Label("Tutto nel carrello", systemImage: "checkmark.circle.fill")
                .font(AppFont.text(15, .semibold)).foregroundStyle(dark ? Color(hex: 0x7CC493) : Palette.chiaro.basilico)
        }
        if state.missing > 0 {
            Text(state.missing == 1 ? "1 mancante" : "\(state.missing) mancanti")
                .font(AppFont.text(12)).foregroundStyle(dark ? Color(hex: 0xF08A74) : Palette.chiaro.pomodoro)
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
