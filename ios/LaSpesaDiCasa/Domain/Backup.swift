import Foundation
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// JSON backup v1, byte-compatible in shape with src/lib/backup.ts: a PWA backup imports here and
/// vice versa. The Gemini key is never included.
struct BackupPayload: Codable {
    var versione: Int
    var esportatoIl: String
    var profilo: [ProfiloDTO]
    var ingredienti: [IngredienteDTO]
    var piatti: [PiattoDTO]
    var piattoIngredienti: [PiattoIngredienteDTO]
    var piani: [PianoDTO]
    var slot: [SlotDTO]
    var liste: [ListaDTO]
    var voci: [VoceDTO]

    struct ProfiloDTO: Codable {
        var id: String
        var porzioniDefault: Int
        var vincoliAlimentari: [String]
        var ordineReparti: [String]
        var giornoSpesa: Int?
        var tema: String?
        var seedVersion: Int?
        var seedVersionPiatti: Int?
        var updatedAt: String
    }

    struct IngredienteDTO: Codable {
        var id: String
        var nome: String
        var reparto: String
        var unitaDefault: String
        var alias: [String]?
        var note: String?
        var origine: String
        var updatedAt: String
        var deletedAt: String?
    }

    struct PiattoDTO: Codable {
        var id: String
        var nome: String
        var procedimento: String?
        var preferito: Bool
        var origine: String
        var porzioni: Int
        var allergieVerificate: [String]?
        var updatedAt: String
        var deletedAt: String?
    }

    struct PiattoIngredienteDTO: Codable {
        var id: String
        var piattoId: String
        var ingredienteId: String?
        var nome: String?
        var reparto: String?
        var quantita: Double
        var unita: String
    }

    struct PianoDTO: Codable {
        var id: String
        var settimanaIso: String
        var updatedAt: String
    }

    struct SlotDTO: Codable {
        var id: String
        var pianoId: String
        var data: String
        var pasto: String
        var piattoId: String?
    }

    struct ListaDTO: Codable {
        var id: String
        var pianoId: String
        var chiusa: Bool
        var updatedAt: String
    }

    struct VoceDTO: Codable {
        var id: String
        var listaId: String
        var ingredienteId: String?
        var testoLibero: String?
        var nome: String
        var quantita: String
        var reparto: String
        var checked: Bool
        var checkedAt: String?
        var nota: String?
        var alternative: [String]?
        var sostituitoCon: String?
        var mancante: Bool?
        var fotoDataUrl: String?
    }
}

enum BackupError: LocalizedError {
    case formato
    var errorDescription: String? { "Formato di backup non riconosciuto." }
}

extension Store {
    private func all<T: PersistentModel>(_: T.Type) -> [T] {
        (try? context.fetch(FetchDescriptor<T>())) ?? []
    }

    func exportBackup() -> BackupPayload {
        BackupPayload(
            versione: 1,
            esportatoIl: isoNow(),
            profilo: all(Profilo.self).map {
                .init(id: $0.id, porzioniDefault: $0.porzioniDefault, vincoliAlimentari: $0.vincoliAlimentari,
                      ordineReparti: $0.ordineReparti, giornoSpesa: $0.giornoSpesa, tema: $0.temaRaw,
                      seedVersion: $0.seedVersion, seedVersionPiatti: $0.seedVersionPiatti, updatedAt: $0.updatedAt)
            },
            ingredienti: all(Ingrediente.self).map {
                .init(id: $0.id, nome: $0.nome, reparto: $0.reparto, unitaDefault: $0.unitaDefault, alias: $0.alias,
                      note: $0.note, origine: $0.origineRaw, updatedAt: $0.updatedAt, deletedAt: $0.deletedAt)
            },
            piatti: all(Piatto.self).map {
                .init(id: $0.id, nome: $0.nome, procedimento: $0.procedimento, preferito: $0.preferito, origine: $0.origineRaw,
                      porzioni: $0.porzioni, allergieVerificate: $0.allergieVerificate, updatedAt: $0.updatedAt, deletedAt: $0.deletedAt)
            },
            piattoIngredienti: all(PiattoIngrediente.self).map {
                .init(id: $0.id, piattoId: $0.piattoId, ingredienteId: $0.ingredienteId, nome: $0.nome, reparto: $0.reparto,
                      quantita: $0.quantita, unita: $0.unita)
            },
            piani: all(PianoSettimanale.self).map { .init(id: $0.id, settimanaIso: $0.settimanaIso, updatedAt: $0.updatedAt) },
            slot: all(SlotPasto.self).map { .init(id: $0.id, pianoId: $0.pianoId, data: $0.data, pasto: $0.pastoRaw, piattoId: $0.piattoId) },
            liste: all(ListaSpesa.self).map { .init(id: $0.id, pianoId: $0.pianoId, chiusa: $0.chiusa, updatedAt: $0.updatedAt) },
            voci: all(VoceLista.self).map {
                .init(id: $0.id, listaId: $0.listaId, ingredienteId: $0.ingredienteId, testoLibero: $0.testoLibero, nome: $0.nome,
                      quantita: $0.quantita, reparto: $0.reparto, checked: $0.checked, checkedAt: $0.checkedAt, nota: $0.nota,
                      alternative: $0.alternative, sostituitoCon: $0.sostituitoCon, mancante: $0.mancante,
                      fotoDataUrl: $0.fotoJPEG.map { "data:image/jpeg;base64,\($0.base64EncodedString())" })
            }
        )
    }

    func exportBackupData() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        return try encoder.encode(exportBackup())
    }

    /// Replaces every table with the backup content (the Gemini key in the Keychain is untouched).
    func importBackup(_ data: Data) throws {
        let payload: BackupPayload
        do {
            payload = try JSONDecoder().decode(BackupPayload.self, from: data)
        } catch {
            throw BackupError.formato
        }
        guard payload.versione == 1 else { throw BackupError.formato }

        for m in AppSchema.models { try context.delete(model: m) }

        for p in payload.profilo {
            context.insert(Profilo(id: p.id, porzioniDefault: p.porzioniDefault, vincoliAlimentari: p.vincoliAlimentari,
                                   ordineReparti: p.ordineReparti, giornoSpesa: p.giornoSpesa ?? 5,
                                   tema: Tema(rawValue: p.tema ?? "") ?? .chiaro, seedVersion: p.seedVersion ?? 0,
                                   seedVersionPiatti: p.seedVersionPiatti ?? 0, updatedAt: p.updatedAt))
        }
        for i in payload.ingredienti {
            context.insert(Ingrediente(id: i.id, nome: i.nome, reparto: i.reparto, unitaDefault: i.unitaDefault, alias: i.alias ?? [],
                                       note: i.note, origine: OrigineIngrediente(rawValue: i.origine) ?? .utente,
                                       updatedAt: i.updatedAt, deletedAt: i.deletedAt))
        }
        for p in payload.piatti {
            context.insert(Piatto(id: p.id, nome: p.nome, procedimento: p.procedimento, preferito: p.preferito,
                                  origine: OriginePiatto(rawValue: p.origine) ?? .manuale, porzioni: p.porzioni,
                                  allergieVerificate: p.allergieVerificate, updatedAt: p.updatedAt, deletedAt: p.deletedAt))
        }
        for pi in payload.piattoIngredienti {
            context.insert(PiattoIngrediente(id: pi.id, piattoId: pi.piattoId, ingredienteId: pi.ingredienteId,
                                             nome: pi.nome ?? "", reparto: pi.reparto ?? Store.repartoRipiego,
                                             quantita: pi.quantita, unita: pi.unita))
        }
        for p in payload.piani { context.insert(PianoSettimanale(id: p.id, settimanaIso: p.settimanaIso, updatedAt: p.updatedAt)) }
        for s in payload.slot {
            context.insert(SlotPasto(id: s.id, pianoId: s.pianoId, data: s.data, pasto: Pasto(rawValue: s.pasto) ?? .cena, piattoId: s.piattoId))
        }
        for l in payload.liste { context.insert(ListaSpesa(id: l.id, pianoId: l.pianoId, chiusa: l.chiusa, updatedAt: l.updatedAt)) }
        for v in payload.voci {
            context.insert(VoceLista(id: v.id, listaId: v.listaId, ingredienteId: v.ingredienteId, testoLibero: v.testoLibero,
                                     nome: v.nome, quantita: v.quantita, reparto: v.reparto, checked: v.checked,
                                     checkedAt: v.checkedAt, nota: v.nota, alternative: v.alternative ?? [],
                                     sostituitoCon: v.sostituitoCon, mancante: v.mancante,
                                     fotoJPEG: v.fotoDataUrl.flatMap(Self.dataFromDataURL)))
        }
        try context.save()
    }

    static func dataFromDataURL(_ url: String) -> Data? {
        guard let comma = url.firstIndex(of: ","), url.hasPrefix("data:") else { return nil }
        return Data(base64Encoded: String(url[url.index(after: comma)...]))
    }
}

/// FileDocument wrapper for `.fileExporter`.
struct BackupDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    var data: Data

    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
