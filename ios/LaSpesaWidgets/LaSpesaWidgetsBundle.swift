import SwiftUI
import WidgetKit

@main
struct LaSpesaWidgetsBundle: WidgetBundle {
    init() { AppFont.register() }

    var body: some Widget {
        TodayWidget()
        ShoppingLiveActivity()
    }
}
