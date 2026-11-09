import Foundation

/// Port of src/lib/allergens.ts. `termini` are matched as substrings on generated text (prudent:
/// false positives just trigger a regeneration); `sinonimi` match what users type in the profile.
struct Allergene: Sendable, Equatable {
    let id: String
    let etichetta: String
    let sinonimi: [String]
    let termini: [String]
}

enum Allergens {
    static let catalogo: [Allergene] = [
        Allergene(
            id: "frutta-a-guscio",
            etichetta: "noci e frutta a guscio",
            sinonimi: ["noci", "noce", "nocciole", "nocciola", "frutta a guscio", "mandorle", "mandorla", "pistacchi",
                       "pistacchio", "anacardi", "pinoli", "pinolo", "noci pecan", "macadamia"],
            termini: ["noce", "noci", "nocciola", "nocciole", "gheriglio", "gherigli", "macadamia", "anacardi",
                      "anacardio", "pistacchio", "pistacchi", "mandorla", "mandorle", "pinolo", "pinoli", "pecan",
                      "noce del brasile"]
        ),
        Allergene(
            id: "arachidi",
            etichetta: "arachidi",
            sinonimi: ["arachidi", "arachide", "burro di arachidi"],
            termini: ["arachide", "arachidi"]
        ),
        Allergene(
            id: "latte",
            etichetta: "latte e lattosio",
            sinonimi: ["latte", "lattosio", "latticini", "formaggio", "burro"],
            termini: ["latte", "latticini", "burro", "panna", "formaggio", "formaggi", "mozzarella", "ricotta", "yogurt",
                      "parmigiano", "grana", "pecorino", "mascarpone", "gorgonzola", "provolone", "scamorza",
                      "stracchino", "fontina", "besciamella"]
        ),
        Allergene(
            id: "glutine",
            etichetta: "glutine",
            sinonimi: ["glutine", "grano", "frumento", "celiachia"],
            termini: ["glutine", "farina", "frumento", "grano", "semola", "pasta", "pane", "pizz", "orzo", "segale",
                      "avena", "farro", "spaghett", "penne", "fusilli", "tagliatell", "cracker", "biscott",
                      "pangrattato", "cous cous", "bulgur"]
        ),
        Allergene(
            id: "crostacei",
            etichetta: "crostacei",
            sinonimi: ["crostacei", "gamberi", "gamberetti"],
            termini: ["gamber", "scampi", "aragosta", "granchio", "astice", "mazzancolle", "crostacei"]
        ),
        Allergene(
            id: "molluschi",
            etichetta: "molluschi",
            sinonimi: ["molluschi", "vongole", "cozze"],
            termini: ["vongole", "cozze", "calamari", "seppie", "polpo", "ostriche", "molluschi", "frutti di mare"]
        ),
        Allergene(
            id: "soia",
            etichetta: "soia",
            sinonimi: ["soia", "edamame", "tofu"],
            termini: ["soia", "edamame", "tofu", "tamari"]
        ),
    ]

    private static func normalizza(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func trova(_ nome: String) -> Allergene? {
        let n = normalizza(nome)
        guard !n.isEmpty else { return nil }
        return catalogo.first { normalizza($0.etichetta) == n || $0.sinonimi.contains { normalizza($0) == n } }
    }

    /// Recognized allergens (automatically checked) among the constraints, without duplicates.
    static func riconosciuti(_ vincoli: [String]) -> [Allergene] {
        var visti = Set<String>()
        var out: [Allergene] = []
        for v in vincoli {
            if let a = trova(v), !visti.contains(a.id) {
                visti.insert(a.id)
                out.append(a)
            }
        }
        return out
    }

    /// User-written constraints that do not match a catalog allergen.
    static func nonRiconosciuti(_ vincoli: [String]) -> [String] {
        vincoli.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty && trova($0) == nil }
    }

    /// Catalog allergens whose terms appear in the generated text.
    static func violati(_ testo: String, _ allergeni: [Allergene]) -> [Allergene] {
        let t = testo.lowercased()
        return allergeni.filter { a in a.termini.contains { t.contains($0) } }
    }
}
