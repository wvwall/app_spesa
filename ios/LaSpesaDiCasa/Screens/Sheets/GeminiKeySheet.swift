import SwiftUI

/// Port of components/ai/GeminiKeySheet.tsx.
struct GeminiKeySheet: View {
    @Environment(\.palette) private var palette
    var onClose: () -> Void
    var onSaved: () -> Void
    @State private var apiKey = ""
    @State private var errore: String?
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SheetHeader(title: "Attiva i suggerimenti AI",
                            intro: "Aggiungi la tua chiave Google Gemini. Puoi continuare a usare l’app anche senza.")
                if let url = URL(string: "https://aistudio.google.com/app/apikey") {
                    Link("Crea una chiave Gemini ↗\u{FE0E}", destination: url)
                        .font(AppFont.text(13.5, .bold))
                        .foregroundStyle(palette.biro)
                }
                Text("Chiave API").font(AppFont.text(13, .bold)).foregroundStyle(palette.textBody)
                SecureField("Incolla la chiave qui", text: $apiKey)
                    .font(AppFont.text(14))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.password)
                    .focused($focused)
                    .padding(12)
                    .background(palette.surfaceCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(focused ? palette.biro : palette.borderQuiet))
                    .onSubmit(save)
                if let errore { StatusText(text: errore, kind: .error) }
                Text("La chiave resta su questo dispositivo, nel portachiavi, e viene usata solo per collegarsi a Gemini.")
                    .font(AppFont.text(12.5)).foregroundStyle(palette.textSecondary)
                Button("Salva e continua", action: save)
                    .buttonStyle(.paper)
                    .disabled(apiKey.trimmingCharacters(in: .whitespaces).isEmpty)
                Button("Non ora", action: onClose).buttonStyle(.paperGhost)
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private func save() {
        do {
            try KeychainStore.saveGeminiApiKey(apiKey)
            apiKey = ""
            onSaved()
        } catch {
            errore = error.localizedDescription
        }
    }
}
