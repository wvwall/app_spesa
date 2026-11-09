import CoreText
import SwiftUI

/// The three self-hosted families from DESIGN.md §4.2, instanced per weight from the PWA's
/// variable woff2 files (iOS cannot load woff2).
enum AppFont {
    /// Registers the bundled fonts once at launch (no Info.plist UIAppFonts needed).
    static func register() {
        guard let urls = Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) else { return }
        CTFontManagerRegisterFontURLs(urls as CFArray, .process, true, nil)
    }

    enum Weight { case regular, medium, semibold, bold, extrabold }

    /// Bricolage Grotesque: titles, days, big numbers. 600–800, never below 20pt.
    static func display(_ size: CGFloat, _ weight: Weight = .extrabold, relativeTo style: Font.TextStyle = .title2) -> Font {
        let name = switch weight {
        case .regular, .medium, .semibold: "LSBricolage-SemiBold"
        case .bold: "LSBricolage-Bold"
        case .extrabold: "LSBricolage-ExtraBold"
        }
        return .custom(name, size: size, relativeTo: style)
    }

    /// Instrument Sans: body and UI.
    static func text(_ size: CGFloat = 16, _ weight: Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        let name = switch weight {
        case .regular: "LSInstrument-Regular"
        case .medium: "LSInstrument-Medium"
        case .semibold: "LSInstrument-SemiBold"
        case .bold, .extrabold: "LSInstrument-Bold"
        }
        return .custom(name, size: size, relativeTo: style)
    }

    /// Caveat: ONLY the handwritten note on an item and the week label.
    static func hand(_ size: CGFloat, _ weight: Weight = .medium, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(weight == .medium || weight == .regular ? "LSCaveat-Medium" : "LSCaveat-SemiBold", size: size, relativeTo: style)
    }
}

extension View {
    /// Uppercase section label: 12–13pt, bold, wide tracking, secondary ink.
    func sectionLabelStyle(_ palette: Palette, size: CGFloat = 12, tracking: CGFloat = 0.12) -> some View {
        self.font(AppFont.text(size, .bold, relativeTo: .caption))
            .textCase(.uppercase)
            .tracking(size * tracking)
            .foregroundStyle(palette.textSecondary)
    }
}
