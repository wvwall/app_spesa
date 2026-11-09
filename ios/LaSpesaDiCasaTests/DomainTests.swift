import Foundation
import SwiftData
import Testing
@testable import LaSpesaDiCasa

private let testoEsempio = """
Spesa
Venerdì cena: affettati e formaggi
Sabato pranzo: spinaci e uova
Sabato cena: noodles al cipollotto
Domenica pranzo: gamberi e cavolo cappuccio
Lunedì pranzo: polipo e insalata
Lunedì cena: zuppa di farro
Martedì pranzo: insalata
Mercoledì pranzo: insalata
Mercoledì cena (Walter):
Giovedì pranzo: tonno e ceci
Venerdì pranzo: insalata

4 uova
1 confezione di spinaci
1 confezione di cipollotto
2 confezioni di gamberi
1 confezione di cavolo cappuccio (già tagliato)
1 confezione di polipo
1 confezione di insalata lattughino
1 confezione di ceci (da 3 piccoline)
1 confezione di soffritto
1 avocado
1 confezione di pomodorini
5 yogurt (+ Walter)
1 confezione di latte di avena
1 confezione di latte
1 coca zero
2 confezioni di acqua
5 mele
5 prugne
1 confezione di Danacol
5 pappe Mimmo
1 detersivo lavatrice
"""

private let reparti = Store.defaultDepartments

private func slotsEsempio() -> [TextImport.SlotRef] {
    let inizio = CycleCalendar.calendar.date(from: DateComponents(year: 2026, month: 11, day: 6))! // Friday.
    let giorni = CycleCalendar.cycleDays(inizio)
    return giorni.enumerated().flatMap { indice, giorno in
        CycleCalendar.mealsForDay(indice, totale: giorni.count).map { pasto in
            let iso = CycleCalendar.toIsoDate(giorno)
            return TextImport.SlotRef(id: "\(iso)-\(pasto.rawValue)", data: iso, pasto: pasto)
        }
    }
}

private func catalogo() throws -> [TextImport.CatalogEntry] {
    let url = try #require(Bundle.main.url(forResource: "ingredients", withExtension: "json"))
    let seed = try JSONDecoder().decode(Store.SeedFile<Store.SeedIngredient>.self, from: Data(contentsOf: url))
    return seed.items.enumerated().map { i, s in
        TextImport.CatalogEntry(nome: s.nome, reparto: s.reparto, alias: s.alias ?? [], id: "ing-\(i)")
    }
}

@Suite("Import da testo")
struct TextImportTests {
    @Test("legge i pasti del ciclo e distingue i due venerdì")
    func pasti() {
        let r = TextImport.parseMealText(testoEsempio, slots: slotsEsempio())
        #expect(r.pasti.count == 11)
        #expect(r.senzaSlot.isEmpty)
        #expect(r.pasti.first { $0.dataIso == "2026-11-06" && $0.pasto == .cena }?.nome == "affettati e formaggi")
        #expect(r.pasti.first { $0.dataIso == "2026-11-13" && $0.pasto == .pranzo }?.nome == "insalata")
        #expect(r.pasti.first { $0.dataIso == "2026-11-11" && $0.pasto == .cena }?.nome == "")
    }

    @Test("legge gli ingredienti con quantità, note e reparto")
    func spesa() throws {
        let r = TextImport.parseShoppingText(testoEsempio, catalogo: try catalogo(), ordineReparti: reparti)
        #expect(r.righe.count == 21)
        #expect(r.ignorate.isEmpty)

        let uova = r.righe[0]
        #expect(uova.nome == "uova" && uova.quantita == "4" && uova.reparto == "Banco frigo")
        let spinaci = r.righe[1]
        #expect(spinaci.nome == "spinaci" && spinaci.quantita == "1" && spinaci.nota == "confezione" && spinaci.reparto == "Ortofrutta")

        func riga(_ n: String) -> TextImport.ShoppingDraft? { r.righe.first { $0.nome == n } }
        #expect(riga("gamberi")?.quantita == "2")
        #expect(riga("gamberi")?.nota == "confezioni")
        #expect(riga("cavolo cappuccio")?.nota == "confezione · già tagliato")
        #expect(riga("cavolo cappuccio")?.reparto == "Ortofrutta")
        #expect(riga("ceci")?.nota == "confezione · da 3 piccoline")
        #expect(riga("ceci")?.reparto == "Dispensa")
        #expect(riga("yogurt")?.quantita == "5")
        #expect(riga("yogurt")?.nota == "+ Walter")
        #expect(riga("yogurt")?.reparto == "Banco frigo")
        #expect(riga("latte di avena")?.reparto == "Bevande")
        #expect(riga("latte")?.reparto == "Banco frigo")
        #expect(riga("detersivo lavatrice")?.reparto == "Casa e igiene")
    }

    @Test("ignora le righe dei pasti quando importa la spesa")
    func ignoraPasti() throws {
        let r = TextImport.parseShoppingText("Sabato pranzo: spinaci e uova\nSpesa\n1 confezione di spinaci",
                                             catalogo: try catalogo(), ordineReparti: reparti)
        #expect(r.righe.count == 1)
        #expect(r.righe.first?.nome == "spinaci")
    }

    @Test("separa e ricompone unità e nota")
    func unitaNota() {
        #expect(TextImport.splitUnitFromNote("kg") == ("kg", nil))
        #expect(TextImport.splitUnitFromNote("confezione · già tagliato") == ("confezione", "già tagliato"))
        #expect(TextImport.splitUnitFromNote("quella in vetro") == (nil, "quella in vetro"))
        #expect(TextImport.splitUnitFromNote("+ Walter") == (nil, "+ Walter"))
        #expect(TextImport.splitUnitFromNote(nil) == (nil, nil))
        #expect(TextImport.joinUnitAndNote("kg", "quella in vetro") == "kg · quella in vetro")
        #expect(TextImport.joinUnitAndNote("  ", "solo nota") == "solo nota")
        #expect(TextImport.joinUnitAndNote("g", "") == "g")
        #expect(TextImport.joinUnitAndNote(nil, nil) == nil)
        let rt = TextImport.splitUnitFromNote(TextImport.joinUnitAndNote("confezione", "già tagliato"))
        #expect(rt == ("confezione", "già tagliato"))
    }
}

@Suite("Calendario del ciclo")
struct CalendarTests {
    @Test("il ciclo parte dall'ultimo giorno della spesa, oggi incluso")
    func inizio() {
        let mercoledi = CycleCalendar.calendar.date(from: DateComponents(year: 2026, month: 11, day: 11, hour: 15))!
        #expect(CycleCalendar.toIsoDate(CycleCalendar.cycleStart(mercoledi, giornoInizio: 5)) == "2026-11-06")
        let venerdi = CycleCalendar.calendar.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 9))!
        #expect(CycleCalendar.toIsoDate(CycleCalendar.cycleStart(venerdi, giornoInizio: 5)) == "2026-11-13")
    }

    @Test("otto giorni: solo cena il primo, solo pranzo l'ultimo")
    func pasti() {
        #expect(CycleCalendar.mealsForDay(0, totale: 8) == [.cena])
        #expect(CycleCalendar.mealsForDay(3, totale: 8) == [.pranzo, .cena])
        #expect(CycleCalendar.mealsForDay(7, totale: 8) == [.pranzo])
        #expect(slotsEsempio().count == 14)
    }

    @Test("etichette in italiano")
    func etichette() {
        let inizio = CycleCalendar.calendar.date(from: DateComponents(year: 2026, month: 11, day: 6))!
        #expect(CycleCalendar.formatDayLabel(inizio) == "Venerdì 6")
        #expect(CycleCalendar.formatCycleLabel(inizio) == "Settimana 6–13 novembre")
        let fineMese = CycleCalendar.calendar.date(from: DateComponents(year: 2026, month: 11, day: 27))!
        #expect(CycleCalendar.formatCycleLabel(fineMese) == "Settimana 27 novembre – 4 dicembre")
    }
}

@Suite("Allergeni e alternative")
struct AllergenTests {
    @Test("riconosce le noci e separa i vincoli liberi")
    func riconoscimento() {
        #expect(Allergens.riconosciuti(["noci", "Nocciole", "sedano"]).map(\.id) == ["frutta-a-guscio"])
        #expect(Allergens.nonRiconosciuti(["noci", "sedano"]) == ["sedano"])
        let noci = Allergens.riconosciuti(["noci"])
        #expect(!Allergens.violati("Pesto con pinoli", noci).isEmpty)
        #expect(Allergens.violati("Pasta al pomodoro", noci).isEmpty)
    }

    @Test("alternative locali, al massimo tre")
    func alternative() {
        #expect(Alternatives.find("Cime di rapa") == ["Spinaci freschi", "Bietole", "Friarielli surgelati"])
        #expect(Alternatives.find("Sconosciuto").isEmpty)
    }

    @Test("prompt di sistema esclude gli allergeni riconosciuti")
    func prompt() {
        let i = GeminiClient.istruzioniAllergeni(["noci", "sedano"])
        #expect(i.sistema.contains("NON includere mai noci e frutta a guscio"))
        #expect(i.sistema.contains("evitare: sedano"))
    }
}

@Suite("Dati e backup", .serialized)
struct StoreTests {
    private func store() throws -> Store {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: Schema(AppSchema.models), configurations: config)
        return Store(context: ModelContext(container))
    }

    @Test("il profilo nuovo esclude le noci e fa la spesa di venerdì")
    func profilo() throws {
        let p = try store().profile()
        #expect(p.vincoliAlimentari == ["noci"])
        #expect(p.giornoSpesa == 5)
        #expect(p.ordineReparti == Store.defaultDepartments)
    }

    @Test("l'import aggiorna senza duplicare e il backup fa andata e ritorno")
    func importEBackup() throws {
        let s = try store()
        s.profile()
        s.applySeeds()
        let piano = s.getOrCreateWeeklyPlan("2026-11-06")
        let lista = s.getOrCreateOpenList(piano.id)
        let r1 = s.importShoppingItems(listaId: lista.id, [.init(nome: "Uova", quantita: "4", reparto: "Banco frigo")])
        let r2 = s.importShoppingItems(listaId: lista.id, [.init(nome: "uova", quantita: "6", reparto: "Banco frigo")])
        #expect(r1.aggiunti == 1 && r2.aggiornati == 1)
        #expect(s.items(lista.id).count == 1)
        #expect(s.items(lista.id).first?.quantita == "6")

        let data = try s.exportBackupData()
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["versione"] as? Int == 1)
        #expect((json["ingredienti"] as? [Any])?.count == 184)

        let altro = try store()
        try altro.importBackup(data)
        #expect(altro.items(lista.id).first?.nome == "Uova")
        #expect(altro.profile().seedVersion == 1)
    }

    @Test("ordina per reparto usando prima il catalogo locale")
    func ordina() async throws {
        let s = try store()
        s.profile()
        s.applySeeds()
        let lista = s.getOrCreateOpenList(s.getOrCreateWeeklyPlan("2026-11-06").id)
        s.addFreeItem(listaId: lista.id, nome: "Zucchine", quantita: "1", reparto: "Dispensa", foto: nil, nota: nil)
        s.addFreeItem(listaId: lista.id, nome: "Cosa strana", quantita: "1", reparto: "Dispensa", foto: nil, nota: nil)
        let r = await s.sortListByDepartment(listaId: lista.id, ordine: Store.defaultDepartments, online: false) { _, _ in [] }
        #expect(r.sistemati == 1 && r.irrisolti == 1 && r.aiSaltata)
        #expect(s.items(lista.id).first { $0.nome == "Zucchine" }?.reparto == "Ortofrutta")
    }
}
