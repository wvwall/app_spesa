import SwiftData
import SwiftUI
import WidgetKit

/// "Oggi": today's lunch and dinner from the weekly plan, plus the week's list progress.
struct TodayEntry: TimelineEntry {
    var date: Date
    var tema: Tema
    var giorno: String
    /// nil = no such meal today in the cycle (e.g. lunch on the shopping day).
    var pranzo: Meal?
    var cena: Meal?
    var listaFatti: Int
    var listaTotale: Int

    struct Meal { var nome: String? }

    static let placeholder = TodayEntry(
        date: .now, tema: .sistema, giorno: "Lunedì 9",
        pranzo: Meal(nome: "Insalata di riso"), cena: Meal(nome: "Zucchine ripiene"),
        listaFatti: 9, listaTotale: 23
    )
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(context.isPreview ? .placeholder : load(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        // Refresh just after midnight (new day); the app also reloads on every change.
        let tomorrow = CycleCalendar.calendar.date(byAdding: .day, value: 1, to: CycleCalendar.calendar.startOfDay(for: now)) ?? now
        completion(Timeline(entries: [load(at: now)], policy: .after(tomorrow.addingTimeInterval(60))))
    }

    private func load(at date: Date) -> TodayEntry {
        let giorno = CycleCalendar.formatDayLabel(date)
        guard let container = try? SharedStore.makeContainer(readOnly: true) else {
            return TodayEntry(date: date, tema: .sistema, giorno: giorno, pranzo: nil, cena: nil, listaFatti: 0, listaTotale: 0)
        }
        let context = ModelContext(container)
        let profilo = (try? context.fetch(FetchDescriptor<Profilo>()))?.first
        let start = CycleCalendar.cycle(offset: 0, giornoSpesa: profilo?.giornoSpesa ?? 5, now: date)
        let cicloIso = CycleCalendar.toIsoDate(start)
        let oggiIso = CycleCalendar.toIsoDate(date)

        var pranzo: TodayEntry.Meal?
        var cena: TodayEntry.Meal?
        var fatti = 0, totale = 0
        if let piano = (try? context.fetch(FetchDescriptor<PianoSettimanale>(predicate: #Predicate { $0.settimanaIso == cicloIso })))?.first {
            let pianoId = piano.id
            let slots = (try? context.fetch(FetchDescriptor<SlotPasto>(predicate: #Predicate { $0.pianoId == pianoId && $0.data == oggiIso }))) ?? []
            let piatti = (try? context.fetch(FetchDescriptor<Piatto>())) ?? []
            func nome(_ s: SlotPasto) -> String? { s.piattoId.flatMap { id in piatti.first { $0.id == id }?.nome } }
            for s in slots {
                if s.pasto == .pranzo { pranzo = .init(nome: nome(s)) } else { cena = .init(nome: nome(s)) }
            }
            let liste = (try? context.fetch(FetchDescriptor<ListaSpesa>(predicate: #Predicate { $0.pianoId == pianoId }))) ?? []
            if let lista = liste.max(by: { $0.updatedAt < $1.updatedAt }) {
                let listaId = lista.id
                let voci = (try? context.fetch(FetchDescriptor<VoceLista>(predicate: #Predicate { $0.listaId == listaId }))) ?? []
                totale = voci.count
                fatti = voci.filter(\.checked).count
            }
        }
        return TodayEntry(date: date, tema: profilo?.tema ?? .sistema, giorno: giorno,
                          pranzo: pranzo, cena: cena, listaFatti: fatti, listaTotale: totale)
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "it.waltervelardo.laspesadicasa.oggi", provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Oggi")
        .description("Pranzo e cena di oggi e la lista della settimana.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let entry: TodayEntry

    private var palette: Palette { Palette.per(entry.tema, system: scheme) }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text(inlineText)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.giorno).font(.headline).widgetAccentable()
                    mealLine(.pranzo, entry.pranzo, compact: true)
                    mealLine(.cena, entry.cena, compact: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 16) {
                    meals
                    Rectangle().fill(palette.borderQuiet).frame(width: 1)
                    listSummary.frame(width: 110, alignment: .leading)
                }
            default:
                meals
            }
        }
        .containerBackground(for: .widget) {
            ZStack {
                palette.surfacePage
                GraphPaper(lineColor: palette.gridLine)
            }
        }
        .environment(\.palette, palette)
    }

    private var inlineText: String {
        if let n = entry.cena?.nome { return "Cena: \(n)" }
        if let n = entry.pranzo?.nome { return "Pranzo: \(n)" }
        return "Menù da scegliere"
    }

    private var meals: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.giorno)
                .font(AppFont.hand(22, .semibold))
                .foregroundStyle(palette.biro)
                .lineLimit(1)
            if entry.pranzo == nil && entry.cena == nil {
                Text("Nessun pasto oggi").font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
            }
            mealLine(.pranzo, entry.pranzo, compact: false)
            mealLine(.cena, entry.cena, compact: false)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func mealLine(_ pasto: Pasto, _ meal: TodayEntry.Meal?, compact: Bool) -> some View {
        if let meal {
            if compact {
                Text("\(pasto.etichetta): \(meal.nome ?? "—")").font(.caption).lineLimit(1)
            } else {
                VStack(alignment: .leading, spacing: 1) {
                    Label(pasto.etichetta, systemImage: pasto == .cena ? "moon" : "sun.max")
                        .font(AppFont.text(11)).foregroundStyle(palette.textSecondary)
                    Text(meal.nome ?? "da scegliere")
                        .font(AppFont.text(14, meal.nome == nil ? .medium : .semibold))
                        .foregroundStyle(meal.nome == nil ? palette.textSecondary : palette.textBody)
                        .lineLimit(2)
                }
            }
        }
    }

    private var listSummary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Lista").font(AppFont.text(11, .bold)).textCase(.uppercase).tracking(1.3)
                .foregroundStyle(palette.textSecondary)
            if entry.listaTotale == 0 {
                Text("Nessuna lista").font(AppFont.text(13)).foregroundStyle(palette.textSecondary)
            } else {
                Text("\(entry.listaFatti) di \(entry.listaTotale)")
                    .font(AppFont.display(24)).foregroundStyle(palette.textBody).monospacedDigit()
                ProgressView(value: Double(entry.listaFatti), total: Double(max(entry.listaTotale, 1)))
                    .tint(palette.basilico)
            }
            Spacer(minLength: 0)
        }
    }
}

#Preview(as: .systemMedium) {
    TodayWidget()
} timeline: {
    TodayEntry.placeholder
}
