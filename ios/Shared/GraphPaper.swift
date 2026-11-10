import SwiftUI

/// The 20pt "quadretto" grid: the app's identity texture, drawn (never an image).
struct GraphPaper: View {
    var lineColor: Color
    var step: CGFloat = Metrics.quadretto

    var body: some View {
        Canvas { context, size in
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.addRect(CGRect(x: x, y: 0, width: 1, height: size.height))
                x += step
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.addRect(CGRect(x: 0, y: y, width: size.width, height: 1))
                y += step
            }
            context.fill(path, with: .color(lineColor))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Which Stitch watermark sits in the corner of each tab (index.css).
enum StitchWatermark: String {
    case settimana = "stitch-bg-1"
    case lista = "stitch-bg-3"
    case piatti = "stitch-bg-2"
}

/// Page background: paper color, Stitch glows, the grid and (in the Stitch theme) a corner sticker
/// under the grid.
struct NotebookBackground: View {
    @Environment(\.palette) private var palette
    var watermark: StitchWatermark?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            palette.surfacePage
            if palette.tema == .stitch {
                // Ear-pink glow in the top corner, belly blue rising from the bottom.
                EllipticalGradient(
                    colors: [Color(red: 1, green: 158 / 255, blue: 196 / 255).opacity(0.32), .clear],
                    center: UnitPoint(x: 1, y: -0.04),
                    startRadiusFraction: 0,
                    endRadiusFraction: 0.62
                )
                EllipticalGradient(
                    colors: [Color(red: 140 / 255, green: 211 / 255, blue: 233 / 255).opacity(0.38), .clear],
                    center: UnitPoint(x: 0, y: 1.04),
                    startRadiusFraction: 0,
                    endRadiusFraction: 0.62
                )
                if let watermark {
                    Image(watermark.rawValue)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 190)
                        .offset(x: 14, y: -96)
                        .accessibilityHidden(true)
                }
            }
            GraphPaper(lineColor: palette.gridLine)
        }
        .ignoresSafeArea()
    }
}
