import SwiftUI

/// The app's three themes, stored in the profile with the same raw values as the PWA.
enum Tema: String, Codable, CaseIterable, Sendable {
    /// "sistema" follows the device light/dark setting.
    case sistema, chiaro, scuro, stitch
}

/// Port of `src/styles/tokens.css`: "biro + evidenziatore" notebook palette. Each theme is a
/// full set of semantic colors; `.sempreChiaro` (the shopping aisle) always uses `.chiaro`.
struct Palette: Equatable, Sendable {
    var tema: Tema
    var surfacePage: Color
    var surfaceCard: Color
    var textBody: Color
    var textSecondary: Color
    var biro: Color
    var biroChiaro: Color
    var biroPieno: Color
    var onBiro: Color
    var evidenziatore: Color
    var evidenziatoreBordo: Color
    var onEvidenziatore: Color
    /// Highlighter stroke under titles (softer in dark) and faint wash for selected cards.
    var evidenziatoreTratto: Color
    var evidenziatoreVelo: Color
    var basilico: Color
    var pomodoro: Color
    var pomodoroChiaro: Color
    var borderQuiet: Color
    var gridLine: Color
    /// Raw notebook tokens used by the always-light aisle.
    var quadretto: Color
    var inchiostro70: Color
    var scrim: Color

    var colorScheme: ColorScheme { tema == .scuro ? .dark : .light }

    static let chiaro = Palette(
        tema: .chiaro,
        surfacePage: Color(hex: 0xF5F2EA),
        surfaceCard: Color(hex: 0xFFFDF8),
        textBody: Color(hex: 0x22252B),
        textSecondary: Color(hex: 0x5B5F66),
        biro: Color(hex: 0x22328C),
        biroChiaro: Color(hex: 0xE9EBF8),
        biroPieno: Color(hex: 0x22328C),
        onBiro: .white,
        evidenziatore: Color(hex: 0xFFF0A3),
        evidenziatoreBordo: Color(hex: 0xE0C84F),
        onEvidenziatore: Color(hex: 0x22328C),
        evidenziatoreTratto: Color(hex: 0xFFF0A3),
        evidenziatoreVelo: Color(hex: 0xFFFBE0),
        basilico: Color(hex: 0x39724A),
        pomodoro: Color(hex: 0xBE3F27),
        pomodoroChiaro: Color(hex: 0xF7E5E0),
        borderQuiet: Color(hex: 0xDFE4EE),
        gridLine: Color(hex: 0xDFE4EE),
        quadretto: Color(hex: 0xDFE4EE),
        inchiostro70: Color(hex: 0x5B5F66),
        scrim: Color(red: 35 / 255, green: 38 / 255, blue: 30 / 255).opacity(0.35)
    )

    /// "Quaderno di notte": blue-black page, grid in the biro's own blue, fluorescent highlighter.
    static let scuro = Palette(
        tema: .scuro,
        surfacePage: Color(hex: 0x14171F),
        surfaceCard: Color(hex: 0x1C2130),
        textBody: Color(hex: 0xE8EAF0),
        textSecondary: Color(hex: 0xA3A9B8),
        biro: Color(hex: 0x9DB1F7),
        biroChiaro: Color(hex: 0x9DB1F7).opacity(0.14),
        biroPieno: Color(hex: 0x2F45AD),
        onBiro: .white,
        evidenziatore: Color(hex: 0xF2DC6B),
        evidenziatoreBordo: Color(hex: 0xF2DC6B),
        onEvidenziatore: Color(hex: 0x1B1D14),
        evidenziatoreTratto: Color(hex: 0xF2DC6B).opacity(0.3),
        evidenziatoreVelo: Color(hex: 0xF2DC6B).opacity(0.1),
        basilico: Color(hex: 0x7CC493),
        pomodoro: Color(hex: 0xF08A74),
        pomodoroChiaro: Color(hex: 0xF08A74).opacity(0.14),
        borderQuiet: Color(hex: 0x2B3142),
        gridLine: Color(hex: 0x9DB1F7).opacity(0.07),
        quadretto: Color(hex: 0xDFE4EE),
        inchiostro70: Color(hex: 0x5B5F66),
        scrim: Color(red: 5 / 255, green: 7 / 255, blue: 12 / 255).opacity(0.6)
    )

    /// The notebook decorated with Stitch stickers: sky-blue paper, his blue for actions, ear-pink highlighter.
    static let stitch = Palette(
        tema: .stitch,
        surfacePage: Color(hex: 0xEEF5F9),
        surfaceCard: .white,
        textBody: Color(hex: 0x14213D),
        textSecondary: Color(hex: 0x4D5B78),
        biro: Color(hex: 0x2A63A3),
        biroChiaro: Color(hex: 0xDCF0F8),
        biroPieno: Color(hex: 0x2A63A3),
        onBiro: .white,
        evidenziatore: Color(hex: 0xFFD3E6),
        evidenziatoreBordo: Color(hex: 0xE79AC0),
        onEvidenziatore: Color(hex: 0x7A2A55),
        evidenziatoreTratto: Color(hex: 0xFFD3E6),
        evidenziatoreVelo: Color(hex: 0xFFF3F8),
        basilico: Color(hex: 0x39724A),
        pomodoro: Color(hex: 0xBE3F27),
        pomodoroChiaro: Color(hex: 0xF7E5E0),
        borderQuiet: Color(hex: 0xD6E3EE),
        gridLine: Color(hex: 0x3277B9).opacity(0.1),
        quadretto: Color(hex: 0xDFE4EE),
        inchiostro70: Color(hex: 0x5B5F66),
        scrim: Color(red: 35 / 255, green: 38 / 255, blue: 30 / 255).opacity(0.35)
    )

    /// `sistema` resolves to light or dark following the device appearance.
    static func per(_ tema: Tema, system: ColorScheme = .light) -> Palette {
        switch tema {
        case .sistema: system == .dark ? .scuro : .chiaro
        case .chiaro: .chiaro
        case .scuro: .scuro
        case .stitch: .stitch
        }
    }
}

/// Spacing, shape and motion tokens from tokens.css.
enum Metrics {
    static let sp1: CGFloat = 4
    static let sp2: CGFloat = 8
    static let sp3: CGFloat = 12
    static let sp4: CGFloat = 16
    static let sp5: CGFloat = 20
    static let sp6: CGFloat = 24
    static let quadretto: CGFloat = 20
    static let radiusChip: CGFloat = 8
    static let radiusCard: CGFloat = 14
    static let radiusSheet: CGFloat = 20
    static let touchMin: CGFloat = 44
    static let rigaCorsia: CGFloat = 56
}

enum Motion {
    /// cubic-bezier(0.6, 0, 0.3, 1): fast in the middle, like a pen stroke.
    static let pennata = Animation.timingCurve(0.6, 0, 0.3, 1, duration: 0.22)
    static let stroke = Animation.timingCurve(0.55, 0, 0.2, 1, duration: 0.24).delay(0.05)
    static let ui = Animation.easeOut(duration: 0.15)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

// MARK: - Environment

private struct PaletteKey: EnvironmentKey {
    static let defaultValue = Palette.chiaro
}

extension EnvironmentValues {
    var palette: Palette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}

extension View {
    /// Applies a palette to a subtree, including the matching system color scheme so native
    /// controls (glass, keyboards, sheets) follow the notebook theme.
    /// With `followSystem` the device appearance is left alone (the "Automatico" theme).
    func palette(_ palette: Palette, followSystem: Bool = false) -> some View {
        environment(\.palette, palette)
            .preferredColorScheme(followSystem ? nil : palette.colorScheme)
            .tint(palette.biro)
    }

    /// Port of `.sempre-chiaro`: the aisle stays dark-on-light under supermarket lights.
    func sempreChiaro() -> some View {
        environment(\.palette, .chiaro)
            .environment(\.colorScheme, .light)
            .tint(Palette.chiaro.biro)
    }
}
