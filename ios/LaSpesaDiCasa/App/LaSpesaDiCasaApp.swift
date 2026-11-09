import Network
import SwiftData
import SwiftUI

@main
struct LaSpesaDiCasaApp: App {
    let container: ModelContainer

    init() {
        AppFont.register()
        do {
            container = try ModelContainer(for: Schema(AppSchema.models))
        } catch {
            fatalError("Impossibile aprire il database locale: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(container)
    }
}

/// Hides a floating bottom action while the keyboard is up, so it never covers what is typed.
struct HiddenWithKeyboard: ViewModifier {
    @State private var keyboardVisible = false

    func body(content: Content) -> some View {
        content
            .opacity(keyboardVisible ? 0 : 1)
            .frame(height: keyboardVisible ? 0 : nil)
            .clipped()
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                withAnimation(.easeOut(duration: 0.2)) { keyboardVisible = true }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                withAnimation(.easeOut(duration: 0.2)) { keyboardVisible = false }
            }
    }
}

extension View {
    func hiddenWithKeyboard() -> some View { modifier(HiddenWithKeyboard()) }
}

/// Live connection status (port of navigator.onLine + online/offline events).
@Observable
final class NetworkMonitor {
    private(set) var online = true
    @ObservationIgnored nonisolated private let monitor = NWPathMonitor()

    init() {
        // Called on the monitor's queue: must not inherit main-actor isolation.
        monitor.pathUpdateHandler = { @Sendable [weak self] path in
            let ok = path.status == .satisfied
            Task { @MainActor in self?.online = ok }
        }
        monitor.start(queue: DispatchQueue(label: "network-monitor"))
    }

    deinit { monitor.cancel() }
}
