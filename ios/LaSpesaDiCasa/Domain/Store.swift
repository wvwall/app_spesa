import Foundation
import SwiftData
import WidgetKit

/// Data operations ported from src/lib/{database,weeklyPlan,shoppingList,dishes}.ts and
/// src/seed/apply*.ts. Views read with @Query and mutate through these helpers.
@MainActor
struct Store {
    let context: ModelContext

    nonisolated static let profileID = AppConstants.profileID
    nonisolated static let defaultDepartments = AppConstants.defaultDepartments
    /// Catch-all department for items whose department is unknown.
    nonisolated static let repartoRipiego = "Dispensa"

    private func save() {
        try? context.save()
        // The "Oggi" widget reads the same store through the App Group.
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func fetch<T: PersistentModel>(_ predicate: Predicate<T>? = nil) -> [T] {
        (try? context.fetch(FetchDescriptor<T>(predicate: predicate))) ?? []
    }

    // MARK: - Profile

    @discardableResult
    func profile() -> Profilo {
        let id = Self.profileID
        if let p = fetch(#Predicate<Profilo> { $0.id == id }).first { return p }
        let nuovo = Profilo()
        context.insert(nuovo)
        save()
        return nuovo
    }

    // MARK: - Weekly plan

    func getOrCreateWeeklyPlan(_ cicloIso: String) -> PianoSettimanale {
        if let p = fetch(#Predicate<PianoSettimanale> { $0.settimanaIso == cicloIso }).first { return p }
        let piano = PianoSettimanale(settimanaIso: cicloIso)
        context.insert(piano)
        save()
        return piano
    }

    /// Creates the 8-day cycle's meals: first day dinner only, last day lunch only.
    @discardableResult
    func getOrCreatePlanSlots(pianoId: String, cycleStart: Date) -> [SlotPasto] {
        let esistenti = fetch(#Predicate<SlotPasto> { $0.pianoId == pianoId })
        if !esistenti.isEmpty { return esistenti }
        let giorni = CycleCalendar.cycleDays(cycleStart)
        var nuovi: [SlotPasto] = []
        for (indice, giorno) in giorni.enumerated() {
            for pasto in CycleCalendar.mealsForDay(indice, totale: giorni.count) {
                let s = SlotPasto(pianoId: pianoId, data: CycleCalendar.toIsoDate(giorno), pasto: pasto)
                context.insert(s)
                nuovi.append(s)
            }
        }
        save()
        return nuovi
    }

    func assignDish(slotId: String, piattoId: String?) {
        guard let slot = fetch(#Predicate<SlotPasto> { $0.id == slotId }).first else { return }
        slot.piattoId = piattoId
        save()
    }

    struct MealImportResult { var assegnati = 0, svuotati = 0, piattiCreati = 0 }

    private static func normalizzaNome(_ nome: String) -> String {
        TextImport.compattaSpazi(nome).lowercased()
    }

    /// Applies reviewed meal rows: reuses a dish with the same name or creates a manual one; an
    /// empty name clears the slot. Slots not mentioned stay untouched.
    func importMealsIntoPlan(_ righe: [(slotId: String, nome: String)], porzioni: Int) -> MealImportResult {
        var perNome: [String: Piatto] = [:]
        for p in fetch(Predicate<Piatto>?.none) where p.deletedAt == nil {
            perNome[Self.normalizzaNome(p.nome)] = p
        }
        var r = MealImportResult()
        for riga in righe {
            let nome = TextImport.compattaSpazi(riga.nome)
            if nome.isEmpty {
                assignDish(slotId: riga.slotId, piattoId: nil)
                r.svuotati += 1
                continue
            }
            let chiave = Self.normalizzaNome(nome)
            let piatto: Piatto
            if let p = perNome[chiave] {
                piatto = p
            } else {
                piatto = Piatto(nome: nome, origine: .manuale, porzioni: porzioni)
                context.insert(piatto)
                perNome[chiave] = piatto
                r.piattiCreati += 1
            }
            assignDish(slotId: riga.slotId, piattoId: piatto.id)
            r.assegnati += 1
        }
        save()
        return r
    }

    // MARK: - Dishes

    @discardableResult
    func createManualDish(nome: String, porzioni: Int, ingredienti: [(Ingrediente, quantita: Double, unita: String)] = []) -> Piatto {
        let piatto = Piatto(nome: nome, origine: .manuale, porzioni: porzioni)
        context.insert(piatto)
        for (ing, q, u) in ingredienti {
            context.insert(PiattoIngrediente(piattoId: piatto.id, ingredienteId: ing.id, nome: ing.nome,
                                             reparto: ing.reparto, quantita: q, unita: u))
        }
        save()
        return piatto
    }

    /// Saves an AI dish with the user's available ingredients (never invented by the AI) and the
    /// ones to buy; bought items inherit department and link when the name matches the catalog.
    @discardableResult
    func saveGeneratedDish(_ g: GeneratedDish, disponibili: [Ingrediente], catalogo: [Ingrediente]) -> String {
        let piatto = Piatto(nome: g.nome, procedimento: g.procedimento.joined(separator: "\n"), origine: .ai,
                            porzioni: Int(g.porzioni.rounded()), allergieVerificate: g.allergieVerificate)
        context.insert(piatto)
        for ing in disponibili {
            context.insert(PiattoIngrediente(piattoId: piatto.id, ingredienteId: ing.id, nome: ing.nome,
                                             reparto: ing.reparto, quantita: 1, unita: ing.unitaDefault))
        }
        for voce in g.ingredientiDaComprare {
            let nomeVoce = voce.nome.trimmingCharacters(in: .whitespaces).isEmpty ? "Ingrediente da comprare" : voce.nome.trimmingCharacters(in: .whitespaces)
            let match = catalogo.first { $0.nome.lowercased() == nomeVoce.lowercased() }
            context.insert(PiattoIngrediente(piattoId: piatto.id, ingredienteId: match?.id, nome: match?.nome ?? nomeVoce,
                                             reparto: match?.reparto ?? Self.repartoRipiego, quantita: 1, unita: voce.quantita))
        }
        save()
        return piatto.id
    }

    func deleteDish(_ piattoId: String) {
        for p in fetch(#Predicate<Piatto> { $0.id == piattoId }) { context.delete(p) }
        for pi in fetch(#Predicate<PiattoIngrediente> { $0.piattoId == piattoId }) { context.delete(pi) }
        for s in fetch(#Predicate<SlotPasto> { $0.piattoId == piattoId }) { s.piattoId = nil }
        save()
    }

    @discardableResult
    func addIngredient(nome: String, reparto: String) -> Ingrediente {
        let ing = Ingrediente(nome: nome, reparto: reparto, unitaDefault: "1 pz", origine: .utente)
        context.insert(ing)
        save()
        return ing
    }

    // MARK: - Shopping list

    /// The plan's single list (closed ones included); with legacy duplicates, the most recent.
    func listForPlan(_ pianoId: String) -> ListaSpesa? {
        fetch(#Predicate<ListaSpesa> { $0.pianoId == pianoId }).max { $0.updatedAt < $1.updatedAt }
    }

    func getOrCreateOpenList(_ pianoId: String) -> ListaSpesa {
        if let l = listForPlan(pianoId) { return l }
        let lista = ListaSpesa(pianoId: pianoId)
        context.insert(lista)
        save()
        return lista
    }

    func items(_ listaId: String) -> [VoceLista] {
        fetch(#Predicate<VoceLista> { $0.listaId == listaId })
    }

    /// Rebuilds the dish-derived rows of the plan's list, keeping manual ones (disabled in the
    /// PWA UI for now, kept for parity).
    @discardableResult
    func generateListFromPlan(_ pianoId: String) -> ListaSpesa {
        let slots = fetch(#Predicate<SlotPasto> { $0.pianoId == pianoId })
        var visti = Set<String>()
        let piattoIds = slots.compactMap(\.piattoId).filter { visti.insert($0).inserted }
        var ordine: [String] = []
        var aggregate: [String: (nome: String, reparto: String, ingredienteId: String?)] = [:]
        func put(_ k: String, _ v: (String, String, String?)) {
            if aggregate[k] == nil { aggregate[k] = v; ordine.append(k) }
        }
        for piattoId in piattoIds {
            let ingredienti = fetch(#Predicate<PiattoIngrediente> { $0.piattoId == piattoId })
            if ingredienti.isEmpty {
                let nome = fetch(#Predicate<Piatto> { $0.id == piattoId }).first?.nome ?? "Piatto da verificare"
                put("piatto:\(piattoId)", (nome, Self.repartoRipiego, nil))
                continue
            }
            for pi in ingredienti {
                let nome = pi.nome.isEmpty ? "Ingrediente da verificare" : pi.nome
                put(pi.ingredienteId ?? nome.lowercased(), (nome, pi.reparto, pi.ingredienteId))
            }
        }
        let lista = getOrCreateOpenList(pianoId)
        for v in items(lista.id) where v.testoLibero == nil { context.delete(v) }
        for k in ordine {
            guard let r = aggregate[k] else { continue }
            context.insert(VoceLista(listaId: lista.id, ingredienteId: r.ingredienteId, nome: r.nome, quantita: "",
                                     reparto: r.reparto, alternative: Alternatives.find(r.nome)))
        }
        save()
        return lista
    }

    func addFreeItem(listaId: String, nome: String, quantita: String, reparto: String, foto: Data?, nota: String?) {
        context.insert(VoceLista(listaId: listaId, testoLibero: nome, nome: nome, quantita: quantita, reparto: reparto,
                                 nota: nota, alternative: Alternatives.find(nome), fotoJPEG: foto))
        save()
    }

    struct ShoppingImportEntry {
        var nome: String
        var quantita: String
        var reparto: String
        var nota: String?
        var ingredienteId: String?
    }

    /// Adds reviewed rows or updates a same-name row (marked manual), never touching its checked
    /// state, photo or alternatives.
    func importShoppingItems(listaId: String, _ righe: [ShoppingImportEntry]) -> (aggiunti: Int, aggiornati: Int) {
        var perNome: [String: VoceLista] = [:]
        for v in items(listaId) { perNome[Self.normalizzaNome(v.nome)] = v }
        var aggiunti = 0, aggiornati = 0
        for riga in righe {
            let nome = TextImport.compattaSpazi(riga.nome)
            guard !nome.isEmpty else { continue }
            let chiave = Self.normalizzaNome(nome)
            if let e = perNome[chiave] {
                if !riga.quantita.isEmpty { e.quantita = riga.quantita }
                if !riga.reparto.isEmpty { e.reparto = riga.reparto }
                e.nota = riga.nota
                e.ingredienteId = e.ingredienteId ?? riga.ingredienteId
                e.testoLibero = nome
                aggiornati += 1
            } else {
                let v = VoceLista(listaId: listaId, ingredienteId: riga.ingredienteId, testoLibero: nome, nome: nome,
                                  quantita: riga.quantita, reparto: riga.reparto.isEmpty ? Self.repartoRipiego : riga.reparto,
                                  nota: riga.nota, alternative: Alternatives.find(nome))
                context.insert(v)
                perNome[chiave] = v
                aggiunti += 1
            }
        }
        save()
        return (aggiunti, aggiornati)
    }

    func toggle(_ v: VoceLista, checked: Bool) {
        v.checked = checked
        v.checkedAt = checked ? isoNow() : nil
        // Taking an item off the shelf means it was found after all.
        if checked { v.mancante = false }
        save()
    }

    func setMissing(_ v: VoceLista, _ mancante: Bool) {
        v.mancante = mancante
        save()
    }

    func delete(_ v: VoceLista) {
        context.delete(v)
        save()
    }

    func updateQuantity(_ v: VoceLista, _ quantita: String) {
        guard v.quantita != quantita else { return }
        v.quantita = quantita
        save()
    }

    func update(_ v: VoceLista, nome: String, quantita: String, reparto: String, foto: Data?, nota: String?) {
        v.nome = nome
        v.quantita = quantita
        v.reparto = reparto
        v.fotoJPEG = foto
        v.nota = nota
        v.alternative = Alternatives.find(nome)
        if v.testoLibero != nil { v.testoLibero = nome }
        save()
    }

    func replace(_ v: VoceLista, with sostituto: String) {
        v.sostituitoCon = sostituto
        v.mancante = false
        save()
    }

    func close(_ lista: ListaSpesa) {
        lista.chiusa = true
        save()
    }

    func deleteCompleteList(_ lista: ListaSpesa) {
        for v in items(lista.id) { context.delete(v) }
        context.delete(lista)
        save()
    }

    struct DepartmentSortResult { var sistemati = 0, viaAI = 0, irrisolti = 0; var aiSaltata = false }

    /// Assigns departments to uncategorized items: local catalog first (offline, free), then AI
    /// only for unknown names, constrained to the app's departments.
    func sortListByDepartment(listaId: String, ordine: [String], online: Bool,
                              classify: ([String], [String]) async throws -> [(nome: String, reparto: String)]) async -> DepartmentSortResult {
        let daSistemare = items(listaId).filter { $0.reparto.isEmpty || $0.reparto == Self.repartoRipiego }
        guard !daSistemare.isEmpty else { return DepartmentSortResult() }
        let indice = Departments.buildIndex(fetch(Predicate<Ingrediente>?.none))

        var nuovo: [String: String] = [:]
        var irrisolte: [VoceLista] = []
        for v in daSistemare {
            if let locale = Departments.inferLocally(v.nome, indice: indice) {
                if locale != v.reparto { nuovo[v.id] = locale }
            } else {
                irrisolte.append(v)
            }
        }

        var r = DepartmentSortResult()
        if !irrisolte.isEmpty {
            if !online {
                r.aiSaltata = true
            } else {
                do {
                    var visti = Set<String>()
                    let nomi = irrisolte.map(\.nome).filter { visti.insert($0).inserted }
                    let assegnazioni = try await classify(nomi, ordine)
                    var perNome: [String: String] = [:]
                    for a in assegnazioni { perNome[a.nome.trimmingCharacters(in: .whitespaces).lowercased()] = a.reparto }
                    for v in irrisolte {
                        if let rep = perNome[v.nome.trimmingCharacters(in: .whitespaces).lowercased()], rep != v.reparto {
                            nuovo[v.id] = rep
                            r.viaAI += 1
                        }
                    }
                } catch {
                    r.aiSaltata = true
                }
            }
        }
        for v in daSistemare { if let rep = nuovo[v.id] { v.reparto = rep } }
        save()
        r.sistemati = nuovo.count
        r.irrisolti = daSistemare.count - nuovo.count
        return r
    }

    // MARK: - Seed

    struct SeedIngredient: Decodable { var nome: String; var reparto: String; var unitaDefault: String; var alias: [String]? }
    struct SeedDish: Decodable { var nome: String; var porzioni: Int; var procedimento: [String]; var ingredienti: [String] }
    struct SeedFile<T: Decodable>: Decodable { var version: Int; var items: [T] }

    private func loadSeed<T: Decodable>(_ name: String) -> SeedFile<T>? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(SeedFile<T>.self, from: data)
    }

    /// Additive seeds: add what is missing by name, never overwrite user changes. Dishes run
    /// after ingredients because they resolve ingredients by name from the catalog.
    func applySeeds() {
        let profilo = profile()
        if let seed: SeedFile<SeedIngredient> = loadSeed("ingredients"), profilo.seedVersion < seed.version {
            let esistenti = Set(fetch(Predicate<Ingrediente>?.none).map { $0.nome.lowercased() })
            for s in seed.items where !esistenti.contains(s.nome.lowercased()) {
                context.insert(Ingrediente(nome: s.nome, reparto: s.reparto, unitaDefault: s.unitaDefault,
                                           alias: s.alias ?? [], origine: .seed))
            }
            profilo.seedVersion = seed.version
            save()
        }
        if let seed: SeedFile<SeedDish> = loadSeed("dishes"), profilo.seedVersionPiatti < seed.version {
            var perNome: [String: Ingrediente] = [:]
            for i in fetch(Predicate<Ingrediente>?.none) { perNome[i.nome.lowercased()] = i }
            let esistenti = Set(fetch(Predicate<Piatto>?.none).map { $0.nome.lowercased() })
            for s in seed.items where !esistenti.contains(s.nome.lowercased()) {
                let piatto = Piatto(nome: s.nome, procedimento: s.procedimento.joined(separator: "\n"),
                                    origine: .manuale, porzioni: s.porzioni)
                context.insert(piatto)
                for n in s.ingredienti {
                    guard let ing = perNome[n.lowercased()] else { continue }
                    context.insert(PiattoIngrediente(piattoId: piatto.id, ingredienteId: ing.id, nome: ing.nome,
                                                     reparto: ing.reparto, quantita: 1, unita: ing.unitaDefault))
                }
            }
            profilo.seedVersionPiatti = seed.version
            save()
        }
    }
}

// MARK: - Undoable deletes (port of the PWA's undo toast)
//
// Restores re-create rows with NEW ids: on the on-disk store SwiftData does not reliably accept a
// fresh insert reusing the unique id of a row deleted moments before (the row silently vanished).
// References (list → items, dish → ingredients and slots) are re-pointed to the new ids.

private struct VoceSnapshot {
    var ingredienteId: String?, testoLibero: String?, nome: String, quantita: String, reparto: String
    var checked: Bool, checkedAt: String?, nota: String?, alternative: [String]
    var sostituitoCon: String?, mancante: Bool?, fotoJPEG: Data?

    init(_ v: VoceLista) {
        ingredienteId = v.ingredienteId; testoLibero = v.testoLibero; nome = v.nome; quantita = v.quantita
        reparto = v.reparto; checked = v.checked; checkedAt = v.checkedAt; nota = v.nota
        alternative = v.alternative; sostituitoCon = v.sostituitoCon; mancante = v.mancante; fotoJPEG = v.fotoJPEG
    }

    func make(listaId: String) -> VoceLista {
        VoceLista(listaId: listaId, ingredienteId: ingredienteId, testoLibero: testoLibero, nome: nome,
                  quantita: quantita, reparto: reparto, checked: checked, checkedAt: checkedAt, nota: nota,
                  alternative: alternative, sostituitoCon: sostituitoCon, mancante: mancante, fotoJPEG: fotoJPEG)
    }
}

extension Store {
    /// Deletes an item and returns a closure that puts it back.
    func deleteWithUndo(_ v: VoceLista) -> () -> Void {
        let snap = VoceSnapshot(v)
        let listaId = v.listaId
        delete(v)
        return {
            context.insert(snap.make(listaId: listaId))
            try? context.save()
        }
    }

    /// Deletes a list with all its items and returns a closure that restores them.
    func deleteCompleteListWithUndo(_ lista: ListaSpesa) -> () -> Void {
        let pianoId = lista.pianoId, chiusa = lista.chiusa
        let voci = items(lista.id).map(VoceSnapshot.init)
        deleteCompleteList(lista)
        return {
            let nuova = ListaSpesa(pianoId: pianoId, chiusa: chiusa)
            context.insert(nuova)
            for v in voci { context.insert(v.make(listaId: nuova.id)) }
            try? context.save()
        }
    }

    /// Deletes a dish (with its ingredients, clearing it from the plan) and returns a closure
    /// that restores all of it.
    func deleteDishWithUndo(_ piattoId: String) -> (nome: String, restore: () -> Void)? {
        guard let p = (try? context.fetch(FetchDescriptor<Piatto>(predicate: #Predicate { $0.id == piattoId })))?.first else { return nil }
        let piatto = (p.nome, p.procedimento, p.preferito, p.origine, p.porzioni, p.allergieVerificate, p.deletedAt)
        let ingredienti = ((try? context.fetch(FetchDescriptor<PiattoIngrediente>(predicate: #Predicate { $0.piattoId == piattoId }))) ?? [])
            .map { ($0.ingredienteId, $0.nome, $0.reparto, $0.quantita, $0.unita) }
        let slotIds = ((try? context.fetch(FetchDescriptor<SlotPasto>(predicate: #Predicate { $0.piattoId == piattoId }))) ?? []).map(\.id)
        deleteDish(piattoId)
        return (piatto.0, {
            let nuovo = Piatto(nome: piatto.0, procedimento: piatto.1, preferito: piatto.2, origine: piatto.3,
                               porzioni: piatto.4, allergieVerificate: piatto.5, deletedAt: piatto.6)
            context.insert(nuovo)
            for i in ingredienti {
                context.insert(PiattoIngrediente(piattoId: nuovo.id, ingredienteId: i.0, nome: i.1, reparto: i.2,
                                                 quantita: i.3, unita: i.4))
            }
            for id in slotIds { assignDish(slotId: id, piattoId: nuovo.id) }
            try? context.save()
        })
    }
}

// MARK: - Recipe book (detail, edit, favorites) and ingredient catalog

/// One editable ingredient row of a dish (used by the dish editor).
struct RigaPiatto: Identifiable, Equatable {
    var id = newID()
    var ingredienteId: String?
    var nome: String
    var reparto: String
    var quantita: String
    var unita: String
}

extension Store {
    func ingredients(of piattoId: String) -> [PiattoIngrediente] {
        (try? context.fetch(FetchDescriptor<PiattoIngrediente>(predicate: #Predicate { $0.piattoId == piattoId }))) ?? []
    }

    func toggleFavorite(_ p: Piatto) {
        p.preferito.toggle()
        p.updatedAt = isoNow()
        try? context.save()
    }

    /// Creates or updates a dish with its full ingredient list (rows are replaced).
    @discardableResult
    func saveDish(_ existing: Piatto?, nome: String, porzioni: Int, procedimento: String, righe: [RigaPiatto]) -> Piatto {
        let piatto: Piatto
        if let existing {
            piatto = existing
            piatto.nome = nome
            piatto.porzioni = porzioni
            piatto.procedimento = procedimento.isEmpty ? nil : procedimento
            piatto.updatedAt = isoNow()
            for old in ingredients(of: piatto.id) { context.delete(old) }
        } else {
            piatto = Piatto(nome: nome, procedimento: procedimento.isEmpty ? nil : procedimento, origine: .manuale, porzioni: porzioni)
            context.insert(piatto)
        }
        for r in righe where !r.nome.trimmingCharacters(in: .whitespaces).isEmpty {
            let q = Double(r.quantita.replacingOccurrences(of: ",", with: ".")) ?? 1
            context.insert(PiattoIngrediente(piattoId: piatto.id, ingredienteId: r.ingredienteId,
                                             nome: r.nome.trimmingCharacters(in: .whitespaces),
                                             reparto: r.reparto, quantita: q, unita: r.unita))
        }
        try? context.save()
        return piatto
    }

    func updateIngredient(_ ing: Ingrediente, nome: String, reparto: String, unita: String) {
        ing.nome = nome
        ing.reparto = reparto
        ing.unitaDefault = unita
        ing.updatedAt = isoNow()
        try? context.save()
    }

    /// Soft delete (deletedAt), like the PWA model: dishes keep their name/department snapshot.
    func deleteIngredientWithUndo(_ ing: Ingrediente) -> () -> Void {
        ing.deletedAt = isoNow()
        try? context.save()
        return {
            ing.deletedAt = nil
            try? context.save()
        }
    }
}

/// Formats a dish ingredient quantity: "500 g", "1 confezione", "2".
func formatQuantita(_ q: Double, _ unita: String) -> String {
    let n = q.rounded() == q ? String(Int(q)) : String(q).replacingOccurrences(of: ".", with: ",")
    let u = unita.trimmingCharacters(in: .whitespaces)
    if u.isEmpty { return n }
    // Catalog units often already carry a number ("1 kg"): do not prefix "1 ".
    if u.first?.isNumber == true { return q == 1 ? u : "\(n) × \(u)" }
    return "\(n) \(u)"
}
