import Foundation

/// Port of src/lib/textImport.ts: pure parsing for the two import flows (weekly menu and shopping
/// list). Nothing here touches the database: screens preview the result for review first.
enum TextImport {
    struct MealDraft: Equatable, Identifiable {
        var slotId: String
        var dataIso: String
        var pasto: Pasto
        var nome: String
        var raw: String
        var id: String { slotId }
    }

    struct MealParseResult {
        var pasti: [MealDraft]
        var senzaSlot: [String]
    }

    struct ShoppingDraft: Equatable {
        var nome: String
        /// Numeric quantity only ("2"); units live in `nota`.
        var quantita: String
        var nota: String?
        var reparto: String
        var ingredienteId: String?
        var riconosciuto: Bool
        var raw: String
    }

    struct ShoppingParseResult {
        var righe: [ShoppingDraft]
        var ignorate: [String]
    }

    struct CatalogEntry {
        var nome: String
        var reparto: String
        var alias: [String] = []
        var id: String?
        var deletedAt: String?
    }

    struct SlotRef {
        var id: String
        var data: String
        var pasto: Pasto
    }

    static let unitaSuggerite = ["g", "kg", "ml", "l", "pz", "confezione", "bottiglia", "vasetto", "busta"]

    private static let prefissiGiorno: [String: Int] = ["dom": 0, "lun": 1, "mar": 2, "mer": 3, "gio": 4, "ven": 5, "sab": 6]
    private static let repartoRipiego = "Dispensa"

    private static let reRigaPasto = JSRegex(
        #"^\s*(?:[-•*]\s*)?(dom(?:enica)?|lun(?:edi)?|mar(?:tedi)?|mer(?:coledi)?|gio(?:vedi)?|ven(?:erdi)?|sab(?:ato)?)\s+(pranzo|cena)\b\s*(?:\([^)]*\))?\s*:\s*(.*)$"#
    )
    private static let reIntestazione = JSRegex(#"^(spesa|lista(?: della spesa)?|ingredienti|menu)$"#)
    private static let unita = "confezion[ei]|pacchett[oi]|pacch[ei]|bottigli[ae]|barattol[oi]|vasett[oi]|sacchett[oi]|scatol[ae]|vaschett[ae]|bust[ae]|pezz[oi]|pz|kg|g|gr|ml|l|lt|ett[oi]|litr[oi]"
    private static let reQuantita = JSRegex(#"^(\d+(?:[.,]\d+)?)\s*(?:x\s*)?((?:"# + unita + #")\b)?\s*(?:di\s+)?(.+)$"#, caseInsensitive: true)
    private static let reSoloUnita = JSRegex("^(?:" + unita + ")$", caseInsensitive: true)
    private static let reNoteTraParentesi = JSRegex(#"\s*\(([^)]*)\)"#)

    private static let indiziReparto: [(reparto: String, regex: JSRegex)] = [
        ("Casa e igiene", JSRegex(#"\b(detersivo|ammorbidente|sapone|shampoo|dentifricio|carta igienica|sacchi|spugne|tovaglioli)\b"#)),
        ("Bevande", JSRegex(#"\b(acqua|coca|cola|aranciata|succo|birra|vino|latte di avena|latte di soia|latte di mandorla|te freddo)\b"#)),
        ("Ortofrutta", JSRegex(#"\b(avocado|mela|mele|prugna|prugne|insalata|lattuga|lattughino|spinaci|cavolo|cipollotto|pomodorini|pomodori|zucchine|melanzane|carote|patate|cipolle|limoni|banane|fragole|kiwi|pere|uva|finocchi|radicchio|porri|funghi|basilico|prezzemolo)\b"#)),
        ("Surgelati", JSRegex(#"\b(surgelat|piselli|minestrone|gelato|bastoncini)\b"#)),
        ("Macelleria e pesce", JSRegex(#"\b(gamberi|polipo|salmone|merluzzo|orata|branzino|sogliola|calamari|cozze|vongole|tonno fresco|pollo|manzo|maiale|tacchino|salsiccia|bistecca|spezzatino)\b"#)),
        ("Banco frigo", JSRegex(#"\b(uova|uovo|yogurt|latte|formaggio|formaggi|affettati|danacol|ricotta|mozzarella|parmigiano|grana|burro|panna|pecorino|scamorza|stracchino|prosciutto|bresaola|salame|pancetta|wurstel|tortellini)\b"#)),
        ("Forno", JSRegex(#"\b(pane|grissini|focaccia|piadine|cracker|fette biscottate|brioche)\b"#)),
        ("Dispensa", JSRegex(#"\b(ceci|farro|noodles|pappe|soffritto|tonno|riso|pasta|spaghetti|penne|olio|sale|zucchero|farina|biscotti|marmellata|miele|caffe)\b"#)),
    ]

    // MARK: - Normalization

    static func normalizza(_ testo: String) -> String {
        compattaSpazi(testo.folding(options: .diacriticInsensitive, locale: nil).lowercased())
    }

    static func compattaSpazi(_ testo: String) -> String {
        testo.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static func righe(_ testo: String) -> [String] {
        testo.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
    }

    // MARK: - Unit and note

    /// The parser stores the unit as the first segment of `nota`; split it back for display.
    static func splitUnitFromNote(_ nota: String?) -> (unita: String?, nota: String?) {
        guard let nota else { return (nil, nil) }
        let parti = nota.components(separatedBy: " · ")
        let primo = parti[0].trimmingCharacters(in: .whitespaces)
        guard reSoloUnita.test(primo) else { return (nil, nota) }
        return (primo, parti.count > 1 ? parti.dropFirst().joined(separator: " · ") : nil)
    }

    /// Inverse of splitUnitFromNote.
    static func joinUnitAndNote(_ unita: String?, _ nota: String?) -> String? {
        let parti = [unita, nota].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return parti.isEmpty ? nil : parti.joined(separator: " · ")
    }

    // MARK: - Meals

    /// Binds each meal line to a free slot of the selected week by actual slot weekday, so in a
    /// Friday–Friday cycle "Venerdì cena" lands on the first Friday and "Venerdì pranzo" on the last.
    static func parseMealText(_ testo: String, slots: [SlotRef]) -> MealParseResult {
        var pasti: [MealDraft] = []
        var senzaSlot: [String] = []
        var usati = Set<String>()

        for riga in righe(testo) {
            let originale = riga.trimmingCharacters(in: .whitespaces)
            guard !originale.isEmpty, let m = reRigaPasto.match(normalizza(originale)),
                  let g = m[1], let p = m[2], let pasto = Pasto(rawValue: p),
                  let giorno = prefissiGiorno[String(g.prefix(3))] else { continue }

            var nome = ""
            if let duePunti = originale.firstIndex(of: ":") {
                nome = compattaSpazi(String(originale[originale.index(after: duePunti)...]))
                nome = nome.replacingOccurrences(of: #"^[-•*]\s*"#, with: "", options: .regularExpression)
                nome = nome.replacingOccurrences(of: #"[.;,]+$"#, with: "", options: .regularExpression)
                    .trimmingCharacters(in: .whitespaces)
            }

            guard let slot = slots.first(where: {
                $0.pasto == pasto && giornoDellaData($0.data) == giorno && !usati.contains($0.id)
            }) else {
                senzaSlot.append(originale)
                continue
            }
            usati.insert(slot.id)
            pasti.append(MealDraft(slotId: slot.id, dataIso: slot.data, pasto: slot.pasto, nome: nome, raw: originale))
        }
        return MealParseResult(pasti: pasti, senzaSlot: senzaSlot)
    }

    private static func giornoDellaData(_ iso: String) -> Int? {
        CycleCalendar.fromIsoDate(iso).map(CycleCalendar.jsWeekday)
    }

    // MARK: - Shopping

    private static func indiceCatalogo(_ catalogo: [CatalogEntry]) -> [String: (reparto: String, id: String?)] {
        var indice: [String: (String, String?)] = [:]
        for ing in catalogo where ing.deletedAt == nil {
            for alias in ing.alias { indice[normalizza(alias)] = (ing.reparto, ing.id) }
        }
        for ing in catalogo where ing.deletedAt == nil {
            indice[normalizza(ing.nome)] = (ing.reparto, ing.id)
        }
        return indice
    }

    private static func repartoValido(_ reparto: String?, _ ordine: [String]) -> String {
        if let reparto, ordine.contains(reparto) { return reparto }
        if ordine.contains(repartoRipiego) { return repartoRipiego }
        return ordine.first ?? repartoRipiego
    }

    /// Separates numeric quantity from unit (kept as note) and notes like "(già tagliato)".
    /// Meal lines and headings are ignored. Catalog matches give the department; otherwise a
    /// local keyword rule, with "Dispensa" as fallback.
    static func parseShoppingText(_ testo: String, catalogo: [CatalogEntry], ordineReparti: [String]) -> ShoppingParseResult {
        var out: [ShoppingDraft] = []
        var ignorate: [String] = []
        let indice = indiceCatalogo(catalogo)
        let reparti = ordineReparti.isEmpty ? [repartoRipiego] : ordineReparti

        for riga in righe(testo) {
            let originale = riga.trimmingCharacters(in: .whitespaces)
            guard !originale.isEmpty else { continue }
            let normalizzata = normalizza(originale)
            if reRigaPasto.test(normalizzata) || reIntestazione.test(normalizzata) { continue }

            var note: [String] = []
            for m in reNoteTraParentesi.allMatches(originale) {
                let n = (m[1] ?? "").trimmingCharacters(in: .whitespaces)
                if !n.isEmpty { note.append(n) }
            }
            let senzaNote = reNoteTraParentesi.replace(originale, with: "").trimmingCharacters(in: .whitespaces)
            let rigaPulita = senzaNote.replacingOccurrences(of: #"^[-•*]\s*"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            guard !rigaPulita.isEmpty else { continue }

            var quantita = ""
            var nome = rigaPulita
            if let m = reQuantita.match(rigaPulita) {
                quantita = m[1] ?? ""
                if let unita = m[2]?.lowercased() { note.insert(unita, at: 0) }
                nome = m[3] ?? ""
            }

            nome = compattaSpazi(nome)
                .replacingOccurrences(of: #"^[\s.:;,-]+"#, with: "", options: .regularExpression)
                .replacingOccurrences(of: #"[.;,]+$"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            guard !nome.isEmpty else {
                ignorate.append(originale)
                continue
            }

            let trovato = indice[normalizza(nome)]
            var reparto = trovato?.reparto
            var riconosciuto = trovato != nil
            if reparto == nil, let indizio = indiziReparto.first(where: { $0.regex.test(normalizza(nome)) }) {
                reparto = indizio.reparto
                riconosciuto = true
            }

            out.append(ShoppingDraft(
                nome: nome,
                quantita: quantita,
                nota: note.isEmpty ? nil : note.joined(separator: " · "),
                reparto: repartoValido(reparto, reparti),
                ingredienteId: trovato?.id ?? nil,
                riconosciuto: riconosciuto,
                raw: originale
            ))
        }
        return ShoppingParseResult(righe: out, ignorate: ignorate)
    }
}

/// Thin NSRegularExpression wrapper with JS-like semantics (capture groups as optionals).
struct JSRegex: @unchecked Sendable {
    let re: NSRegularExpression

    init(_ pattern: String, caseInsensitive: Bool = false) {
        // Patterns are compile-time constants: a failure here is a programming error.
        re = try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
    }

    func test(_ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    func match(_ s: String) -> [String?]? {
        guard let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return groups(m, in: s)
    }

    func allMatches(_ s: String) -> [[String?]] {
        re.matches(in: s, range: NSRange(s.startIndex..., in: s)).map { groups($0, in: s) }
    }

    func replace(_ s: String, with template: String) -> String {
        re.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: template)
    }

    private func groups(_ m: NSTextCheckingResult, in s: String) -> [String?] {
        (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            guard r.location != NSNotFound, let range = Range(r, in: s) else { return nil }
            return String(s[range])
        }
    }
}
