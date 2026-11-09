import Foundation

/// A dish proposed by the AI. `ingredientiPosseduti` is deliberately absent: only the app knows
/// what the user already has (their selection); the model must not claim "you already have oil".
struct GeneratedDish: Codable, Equatable, Sendable {
    var nome: String
    var procedimento: [String]
    var porzioni: Double
    var minuti: Double?
    var ingredientiDaComprare: [DaComprare]
    var allergieVerificate: [String] = []
    var allergieNonVerificate: [String] = []

    struct DaComprare: Codable, Equatable, Sendable {
        var nome: String
        var quantita: String
    }

    private enum CodingKeys: String, CodingKey {
        case nome, procedimento, porzioni, minuti, ingredientiDaComprare
    }
}

enum AIError: LocalizedError, Equatable {
    case apiKeyRequired
    case message(String)

    var errorDescription: String? {
        switch self {
        case .apiKeyRequired: "Per usare Google Gemini, inserisci la tua chiave API."
        case .message(let m): m
        }
    }
}

/// Direct port of the stateless Netlify proxy (`netlify/functions/ai.ts`): same prompts, same
/// response schemas, same two-layer allergen safety (system prompt + output scan with one retry).
/// The user's own key is read from the Keychain and only sent to Google.
struct GeminiClient {
    static let model = "gemini-2.5-flash"
    var session: URLSession = .shared
    var apiKey: () -> String? = { KeychainStore.geminiApiKey() }

    private static let sistemaClassifica =
        "Sei un assistente che classifica ingredienti della spesa nei reparti di un supermercato " +
        "italiano. Assegna a ciascun ingrediente uno solo dei reparti indicati, usando esattamente " +
        "quelle etichette. Rispondi SOLO con il JSON richiesto."

    // MARK: - Allergen instructions

    struct IstruzioniAllergeni {
        var sistema: String
        var riconosciuti: [Allergene]
        var nonRiconosciuti: [String]
    }

    static func istruzioniAllergeni(_ vincoli: [String]) -> IstruzioniAllergeni {
        let riconosciuti = Allergens.riconosciuti(vincoli)
        let nonRiconosciuti = Allergens.nonRiconosciuti(vincoli)
        let etichette = riconosciuti.map(\.etichetta)
        var sistema = "Sei un assistente che propone piatti di cucina italiana/mediterranea, di stagione, in italiano. "
        if !etichette.isEmpty {
            sistema += "Vincolo assoluto e non negoziabile: NON includere mai \(etichette.joined(separator: ", ")) in nessuna forma, " +
                "nemmeno in tracce (salse, pesti, dolci). Se un ingrediente selezionato dall'utente li contiene, ignoralo. "
        }
        if !nonRiconosciuti.isEmpty {
            sistema += "L'utente deve inoltre evitare: \(nonRiconosciuti.joined(separator: ", ")). Tienine conto e non usarli. "
        }
        sistema += "Rispondi SOLO con il JSON richiesto."
        return IstruzioniAllergeni(sistema: sistema, riconosciuti: riconosciuti, nonRiconosciuti: nonRiconosciuti)
    }

    private static func testoCompleto(_ p: GeneratedDish) -> String {
        ([p.nome] + p.procedimento + p.ingredientiDaComprare.map(\.nome)).joined(separator: " ")
    }

    // MARK: - Schemas

    private static let piattoProperties: [String: Any] = [
        "nome": ["type": "STRING"],
        "procedimento": ["type": "ARRAY", "items": ["type": "STRING"], "maxItems": "6"],
        "porzioni": ["type": "NUMBER"],
        "minuti": ["type": "NUMBER"],
        "ingredientiDaComprare": [
            "type": "ARRAY",
            "items": [
                "type": "OBJECT",
                "properties": ["nome": ["type": "STRING"], "quantita": ["type": "STRING"]],
                "required": ["nome", "quantita"],
            ],
        ],
    ]

    // MARK: - Actions

    func generateDish(ingredienti: [String], vincoli: [String], porzioni: Int, pasto: Pasto,
                      evitaPiatti: [String] = []) async throws -> GeneratedDish {
        let istr = Self.istruzioniAllergeni(vincoli)
        let vincoliTesto = vincoli.isEmpty ? "nessuno" : vincoli.joined(separator: ", ")
        let disponibili = ingredienti.isEmpty ? "nessuno, scegli tu liberamente il piatto" : ingredienti.joined(separator: ", ")
        var prompt = "Ingredienti già disponibili (forniti dall'utente, NON elencarli come da comprare): \(disponibili).\n" +
            "Pasto: \(pasto.rawValue). Porzioni: \(porzioni). Altri vincoli: \(vincoliTesto).\n"
        if !evitaPiatti.isEmpty {
            prompt += "Piatti già scelti per altri pasti di questa settimana, NON riproporre questi né varianti troppo simili: \(evitaPiatti.joined(separator: ", ")).\n"
        }
        prompt += "Proponi UN piatto che usi il più possibile gli ingredienti disponibili. In 'ingredientiDaComprare' elenca " +
            "SOLO ciò che la ricetta richiede oltre a quelli già disponibili (comprese eventuali spezie, condimenti o " +
            "altro che dai per scontato: se non è nell'elenco dei disponibili, va comprato), con quantità."

        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": Self.piattoProperties,
            "required": ["nome", "procedimento", "porzioni", "ingredientiDaComprare"],
        ]

        for _ in 0..<2 {
            let data = try await call(prompt: prompt, schema: schema, sistema: istr.sistema, temperature: 1.3)
            var piatto = try decode(GeneratedDish.self, from: data)
            piatto.procedimento = Array(piatto.procedimento.prefix(6))
            if Allergens.violati(Self.testoCompleto(piatto), istr.riconosciuti).isEmpty {
                piatto.allergieVerificate = istr.riconosciuti.map(\.etichetta)
                piatto.allergieNonVerificate = istr.nonRiconosciuti
                return piatto
            }
        }
        throw AIError.message("Non sono riuscito a generare un piatto che rispetti i vincoli indicati. Componilo a mano.")
    }

    /// Kept for parity with the PWA, where it is currently disabled behind a flag.
    func generateWeek(pasti: [(id: String, pasto: Pasto)], vincoli: [String], porzioni: Int) async throws -> [(id: String, generato: GeneratedDish)] {
        let istr = Self.istruzioniAllergeni(vincoli)
        let vincoliTesto = vincoli.isEmpty ? "nessuno" : vincoli.joined(separator: ", ")
        let elenco = pasti.map { "- id \"\($0.id)\": \($0.pasto.rawValue)" }.joined(separator: "\n")
        let prompt = "Proponi un piatto per ciascuno di questi pasti della settimana, uno per riga (usa esattamente " +
            "gli id indicati, senza inventarne altri o ometterne):\n\(elenco)\n" +
            "Porzioni: \(porzioni). Altri vincoli: \(vincoliTesto).\n" +
            "Varia il più possibile tra un pasto e l'altro: alterna proteine principali (carne, pesce, legumi, " +
            "uova, formaggi), tipi di preparazione (primo, secondo, piatto unico) e metodi di cottura. Non " +
            "riproporre mai lo stesso piatto due volte nella settimana. In 'ingredientiDaComprare' elenca tutti " +
            "gli ingredienti richiesti da ciascuna ricetta, comprese spezie e condimenti, con quantità."
        var itemProps = Self.piattoProperties
        itemProps["id"] = ["type": "STRING"]
        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "piatti": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": itemProps,
                        "required": ["id", "nome", "procedimento", "porzioni", "ingredientiDaComprare"],
                    ],
                ],
            ],
            "required": ["piatti"],
        ]

        struct ConId: Decodable { var id: String }
        struct Risposta: Decodable { var piatti: [Riga] }
        struct Riga: Decodable {
            var id: String
            var piatto: GeneratedDish
            init(from decoder: Decoder) throws {
                id = try ConId(from: decoder).id
                piatto = try GeneratedDish(from: decoder)
            }
        }

        let richiesti = Set(pasti.map(\.id))
        for _ in 0..<2 {
            let data = try await call(prompt: prompt, schema: schema, sistema: istr.sistema, temperature: 1.3)
            let righe = try decode(Risposta.self, from: data).piatti.filter { richiesti.contains($0.id) }
            let testo = righe.map { Self.testoCompleto($0.piatto) }.joined(separator: " ")
            if Allergens.violati(testo, istr.riconosciuti).isEmpty {
                return righe.map { riga in
                    var p = riga.piatto
                    p.allergieVerificate = istr.riconosciuti.map(\.etichetta)
                    p.allergieNonVerificate = istr.nonRiconosciuti
                    return (riga.id, p)
                }
            }
        }
        throw AIError.message("Non sono riuscito a generare la settimana rispettando i vincoli indicati. Riprova.")
    }

    /// Classifies ingredients into the app's departments (temperature 0, clamped to the list).
    func classifyDepartments(ingredienti: [String], reparti: [String]) async throws -> [(nome: String, reparto: String)] {
        let ripiego = reparti.contains("Dispensa") ? "Dispensa" : (reparti.last ?? "Dispensa")
        let prompt = "Assegna ogni ingrediente a UNO SOLO di questi reparti (usa esattamente queste etichette, " +
            "senza inventarne altre): \(reparti.joined(separator: ", ")).\n" +
            "Se un ingrediente non rientra chiaramente in nessuno, usa \"\(ripiego)\".\n" +
            "Ingredienti:\n\(ingredienti.prefix(60).map { "- \($0)" }.joined(separator: "\n"))"
        let schema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "assegnazioni": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "nome": ["type": "STRING"],
                            "reparto": ["type": "STRING", "format": "enum", "enum": reparti],
                        ],
                        "required": ["nome", "reparto"],
                    ],
                ],
            ],
            "required": ["assegnazioni"],
        ]
        struct Risposta: Decodable { var assegnazioni: [A] }
        struct A: Decodable { var nome: String; var reparto: String }
        let data = try await call(prompt: prompt, schema: schema, sistema: Self.sistemaClassifica, temperature: 0)
        let consentiti = Set(reparti)
        return try decode(Risposta.self, from: data).assegnazioni.map {
            ($0.nome, consentiti.contains($0.reparto) ? $0.reparto : ripiego)
        }
    }

    // MARK: - Transport

    private func call(prompt: String, schema: [String: Any], sistema: String, temperature: Double) async throws -> Data {
        guard let key = apiKey(), !key.isEmpty else { throw AIError.apiKeyRequired }
        guard let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(Self.model):generateContent") else {
            throw AIError.message("Il piatto non è arrivato. Riprova o componilo a mano.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 60
        let body: [String: Any] = [
            "contents": [["parts": [["text": "\(sistema)\n\n\(prompt)"]]]],
            "generationConfig": [
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": temperature,
            ],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .notConnectedToInternet || error.code == .networkConnectionLost {
            throw AIError.message("Serve la connessione per generare. Il resto dell'app funziona anche offline.")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard (200..<300).contains(status) else {
            let err = json?["error"] as? [String: Any]
            let messaggio = (err?["message"] as? String) ?? "Il piatto non è arrivato. Riprova o componilo a mano."
            if status == 400 || status == 401 || status == 403,
               messaggio.localizedCaseInsensitiveContains("api key") {
                throw AIError.message("La chiave Gemini non è valida. Controllala in Opzioni.")
            }
            throw AIError.message(messaggio.replacingOccurrences(of: key, with: "[redacted]"))
        }
        guard let candidates = json?["candidates"] as? [[String: Any]],
              let content = candidates.first?["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]],
              let text = (parts.first?["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty, let out = text.data(using: .utf8) else {
            throw AIError.message("La risposta AI è vuota.")
        }
        return out
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw AIError.message("Il piatto non è arrivato. Riprova o componilo a mano.")
        }
    }
}
