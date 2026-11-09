import Foundation
import SwiftData

// Port of src/lib/models.ts. Rows reference each other by string id (like the Dexie tables)
// rather than SwiftData relationships, so the JSON v1 backup maps 1:1 in both directions.

enum Pasto: String, Codable, Sendable {
    case pranzo, cena
    var etichetta: String { self == .pranzo ? "Pranzo" : "Cena" }
}

enum OrigineIngrediente: String, Codable, Sendable { case seed, utente }
enum OriginePiatto: String, Codable, Sendable { case manuale, ai }

/// Singleton profile (id "profilo"). New profiles exclude nuts by default.
@Model
final class Profilo {
    @Attribute(.unique) var id: String
    var porzioniDefault: Int
    var vincoliAlimentari: [String]
    var ordineReparti: [String]
    /// Shopping day: 0=Sunday … 6=Saturday (JS Date.getDay() convention). Defaults to Friday.
    var giornoSpesa: Int
    var temaRaw: String
    var seedVersion: Int
    var seedVersionPiatti: Int
    var updatedAt: String

    var tema: Tema {
        get { Tema(rawValue: temaRaw) ?? .chiaro }
        set { temaRaw = newValue.rawValue }
    }

    init(
        id: String = Store.profileID,
        porzioniDefault: Int = 2,
        vincoliAlimentari: [String] = ["noci"],
        ordineReparti: [String] = Store.defaultDepartments,
        giornoSpesa: Int = 5,
        tema: Tema = .sistema,
        seedVersion: Int = 0,
        seedVersionPiatti: Int = 0,
        updatedAt: String = isoNow()
    ) {
        self.id = id
        self.porzioniDefault = porzioniDefault
        self.vincoliAlimentari = vincoliAlimentari
        self.ordineReparti = ordineReparti
        self.giornoSpesa = giornoSpesa
        self.temaRaw = tema.rawValue
        self.seedVersion = seedVersion
        self.seedVersionPiatti = seedVersionPiatti
        self.updatedAt = updatedAt
    }
}

@Model
final class Ingrediente {
    @Attribute(.unique) var id: String
    var nome: String
    var reparto: String
    var unitaDefault: String
    var alias: [String]
    var note: String?
    var origineRaw: String
    var updatedAt: String
    var deletedAt: String?

    init(id: String = newID(), nome: String, reparto: String, unitaDefault: String, alias: [String] = [],
         note: String? = nil, origine: OrigineIngrediente, updatedAt: String = isoNow(), deletedAt: String? = nil) {
        self.id = id
        self.nome = nome
        self.reparto = reparto
        self.unitaDefault = unitaDefault
        self.alias = alias
        self.note = note
        self.origineRaw = origine.rawValue
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

@Model
final class Piatto {
    @Attribute(.unique) var id: String
    var nome: String
    var procedimento: String?
    var preferito: Bool
    var origineRaw: String
    var porzioni: Int
    /// Allergens recognized and verified when the dish was generated (a snapshot of that moment).
    var allergieVerificate: [String]?
    var updatedAt: String
    var deletedAt: String?

    var origine: OriginePiatto { OriginePiatto(rawValue: origineRaw) ?? .manuale }

    init(id: String = newID(), nome: String, procedimento: String? = nil, preferito: Bool = false,
         origine: OriginePiatto, porzioni: Int, allergieVerificate: [String]? = nil,
         updatedAt: String = isoNow(), deletedAt: String? = nil) {
        self.id = id
        self.nome = nome
        self.procedimento = procedimento
        self.preferito = preferito
        self.origineRaw = origine.rawValue
        self.porzioni = porzioni
        self.allergieVerificate = allergieVerificate
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

/// A dish ingredient with a permanent name/department snapshot, so catalog changes never make an
/// ingredient disappear from the shopping list.
@Model
final class PiattoIngrediente {
    @Attribute(.unique) var id: String
    var piattoId: String
    var ingredienteId: String?
    var nome: String
    var reparto: String
    var quantita: Double
    var unita: String

    init(id: String = newID(), piattoId: String, ingredienteId: String?, nome: String, reparto: String,
         quantita: Double, unita: String) {
        self.id = id
        self.piattoId = piattoId
        self.ingredienteId = ingredienteId
        self.nome = nome
        self.reparto = reparto
        self.quantita = quantita
        self.unita = unita
    }
}

@Model
final class PianoSettimanale {
    @Attribute(.unique) var id: String
    /// Start day of the cycle, ISO "yyyy-MM-dd".
    var settimanaIso: String
    var updatedAt: String

    init(id: String = newID(), settimanaIso: String, updatedAt: String = isoNow()) {
        self.id = id
        self.settimanaIso = settimanaIso
        self.updatedAt = updatedAt
    }
}

@Model
final class SlotPasto {
    @Attribute(.unique) var id: String
    var pianoId: String
    /// ISO date "yyyy-MM-dd".
    var data: String
    var pastoRaw: String
    var piattoId: String?

    var pasto: Pasto { Pasto(rawValue: pastoRaw) ?? .cena }

    init(id: String = newID(), pianoId: String, data: String, pasto: Pasto, piattoId: String? = nil) {
        self.id = id
        self.pianoId = pianoId
        self.data = data
        self.pastoRaw = pasto.rawValue
        self.piattoId = piattoId
    }
}

@Model
final class ListaSpesa {
    @Attribute(.unique) var id: String
    var pianoId: String
    /// True once shopping has started.
    var chiusa: Bool
    var updatedAt: String

    init(id: String = newID(), pianoId: String, chiusa: Bool = false, updatedAt: String = isoNow()) {
        self.id = id
        self.pianoId = pianoId
        self.chiusa = chiusa
        self.updatedAt = updatedAt
    }
}

@Model
final class VoceLista {
    @Attribute(.unique) var id: String
    var listaId: String
    var ingredienteId: String?
    /// Set on manually added/imported rows, so "Genera lista" preserves them.
    var testoLibero: String?
    var nome: String
    var quantita: String
    var reparto: String
    var checked: Bool
    var checkedAt: String?
    var nota: String?
    var alternative: [String]
    var sostituitoCon: String?
    var mancante: Bool?
    /// Resized JPEG. Exported as a data URL (`fotoDataUrl`) for backup compatibility.
    @Attribute(.externalStorage) var fotoJPEG: Data?

    init(id: String = newID(), listaId: String, ingredienteId: String? = nil, testoLibero: String? = nil,
         nome: String, quantita: String, reparto: String, checked: Bool = false, checkedAt: String? = nil,
         nota: String? = nil, alternative: [String] = [], sostituitoCon: String? = nil, mancante: Bool? = nil,
         fotoJPEG: Data? = nil) {
        self.id = id
        self.listaId = listaId
        self.ingredienteId = ingredienteId
        self.testoLibero = testoLibero
        self.nome = nome
        self.quantita = quantita
        self.reparto = reparto
        self.checked = checked
        self.checkedAt = checkedAt
        self.nota = nota
        self.alternative = alternative
        self.sostituitoCon = sostituitoCon
        self.mancante = mancante
        self.fotoJPEG = fotoJPEG
    }
}

// MARK: - Helpers

nonisolated func newID() -> String { UUID().uuidString.lowercased() }

nonisolated(unsafe) private let isoFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

/// Same shape as JS `new Date().toISOString()`.
nonisolated func isoNow() -> String { isoFormatter.string(from: Date()) }

enum AppSchema {
    static let models: [any PersistentModel.Type] = [
        Profilo.self, Ingrediente.self, Piatto.self, PiattoIngrediente.self,
        PianoSettimanale.self, SlotPasto.self, ListaSpesa.self, VoceLista.self,
    ]
}
