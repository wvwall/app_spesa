import Foundation

/// Port of src/lib/departments.ts and src/lib/alternatives.ts.
enum Departments {
    /// Sorts departments by the user's order; unknown departments go last.
    static func sort(_ reparti: [String], ordine: [String]) -> [String] {
        reparti.enumerated().sorted { a, b in
            let ia = ordine.firstIndex(of: a.element) ?? 999
            let ib = ordine.firstIndex(of: b.element) ?? 999
            return ia != ib ? ia < ib : a.offset < b.offset
        }.map(\.element)
    }

    /// Groups items by department, in the configured order (stable within a department).
    static func group<T>(_ voci: [T], ordine: [String], reparto: (T) -> String) -> [(reparto: String, voci: [T])] {
        var gruppi: [String: [T]] = [:]
        var chiavi: [String] = []
        for v in voci {
            let r = reparto(v)
            if gruppi[r] == nil { chiavi.append(r) }
            gruppi[r, default: []].append(v)
        }
        return sort(chiavi, ordine: ordine).map { ($0, gruppi[$0] ?? []) }
    }

    private static func normalize(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Name/alias → department index from the catalog; exact names override colliding aliases.
    static func buildIndex(_ catalogo: [Ingrediente]) -> [String: String] {
        var indice: [String: String] = [:]
        for ing in catalogo where ing.deletedAt == nil {
            for alias in ing.alias { indice[normalize(alias)] = ing.reparto }
        }
        for ing in catalogo where ing.deletedAt == nil {
            indice[normalize(ing.nome)] = ing.reparto
        }
        return indice
    }

    static func inferLocally(_ nome: String, indice: [String: String]) -> String? {
        indice[normalize(nome)]
    }
}

/// Hand-curated substitutions: instant, free and offline (RF7).
enum Alternatives {
    private static let gruppi: [[String]] = [
        ["Spinaci freschi", "Bietole", "Cime di rapa", "Friarielli surgelati", "Rucola"],
        ["Limoni", "Arance"],
        ["Ricotta", "Stracchino", "Formaggio spalmabile"],
        ["Parmigiano Reggiano", "Grana Padano", "Pecorino"],
        ["Prosciutto cotto", "Prosciutto crudo", "Speck", "Bresaola", "Salame"],
        ["Macinato di manzo", "Macinato misto"],
        ["Petto di pollo", "Cosce di pollo", "Tacchino a fette"],
        ["Merluzzo fresco", "Filetti di merluzzo surgelati", "Sogliola", "Orata", "Branzino"],
        ["Cozze", "Vongole", "Gamberi", "Gamberetti surgelati", "Calamari", "Misto mare surgelato"],
        ["Passata di pomodoro", "Pomodori pelati", "Concentrato di pomodoro"],
        ["Spaghetti", "Tagliatelle secche", "Pasta fresca all'uovo"],
        ["Penne", "Orecchiette"],
        ["Ceci in scatola", "Fagioli in scatola", "Lenticchie secche", "Ceci secchi"],
        ["Riso", "Riso per risotti", "Farro", "Orzo perlato", "Cous cous", "Polenta"],
        ["Piselli surgelati", "Verdure miste surgelate", "Spinaci surgelati", "Spinaci in cubetti"],
        ["Olive verdi", "Olive nere", "Capperi"],
        ["Pane comune", "Pane in cassetta", "Focaccia", "Piadine", "Pane carasau"],
        ["Aranciata", "Cola", "Tè freddo"],
        ["Aceto balsamico", "Aceto di vino"],
        ["Cipolle", "Cipollotto", "Porri"],
        ["Zucchine", "Melanzane"],
        ["Yogurt bianco", "Yogurt greco"],
        ["Latte fresco", "Latte a lunga conservazione"],
    ]

    private static let indice: [String: [String]] = {
        var m: [String: [String]] = [:]
        for g in gruppi { for n in g { m[n.lowercased()] = g } }
        return m
    }()

    /// Up to three alternatives, or none when the ingredient is not in a curated group.
    static func find(_ nome: String) -> [String] {
        let key = nome.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let gruppo = indice[key] else { return [] }
        return Array(gruppo.filter { $0.lowercased() != key }.prefix(3))
    }
}

/// Port of src/lib/listExport.ts.
enum ListExport {
    static func text(voci: [VoceLista], ordine: [String], titolo: String) -> String {
        var testo = "\(titolo)\n"
        for gruppo in Departments.group(voci, ordine: ordine, reparto: \.reparto) {
            testo += "\n── \(gruppo.reparto) ──\n"
            for v in gruppo.voci {
                let simbolo = v.checked ? "☑" : "☐"
                let nome = v.sostituitoCon.map { "\($0) (al posto di \(v.nome))" } ?? v.nome
                let nota = v.nota.flatMap { $0.isEmpty ? nil : " — “\($0)”" } ?? ""
                let quantita = v.quantita.isEmpty ? "" : " \(v.quantita)"
                testo += "\(simbolo) \(nome)\(quantita)\(nota)\n"
            }
        }
        return testo
    }
}
