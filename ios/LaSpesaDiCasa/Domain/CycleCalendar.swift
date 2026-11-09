import Foundation

/// Port of src/lib/calendar.ts: the shopping cycle anchored to the shopping day, from dinner on
/// that day to lunch on the same weekday one week later (8 days).
enum CycleCalendar {
    static var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.locale = Locale(identifier: "it_IT")
        c.timeZone = .current
        return c
    }()

    static let weekdays = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]

    /// JS Date.getDay(): 0=Sunday … 6=Saturday.
    static func jsWeekday(_ date: Date) -> Int {
        calendar.component(.weekday, from: date) - 1
    }

    /// Most recent occurrence of `giornoInizio` (0=Sunday…6=Saturday), today included, at midnight.
    static func cycleStart(_ date: Date, giornoInizio: Int) -> Date {
        let giorno = jsWeekday(date)
        let offset = (giorno - giornoInizio + 7) % 7
        let start = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: -offset, to: start) ?? start
    }

    static func toIsoDate(_ d: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func fromIsoDate(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    /// Eight days: from the cycle start through the same weekday one week later, inclusive.
    static func cycleDays(_ inizio: Date) -> [Date] {
        (0..<8).compactMap { calendar.date(byAdding: .day, value: $0, to: inizio) }
    }

    /// First day: dinner only. Last day: lunch only. Others: both.
    static func mealsForDay(_ indice: Int, totale: Int) -> [Pasto] {
        if indice == 0 { return [.cena] }
        if indice == totale - 1 { return [.pranzo] }
        return [.pranzo, .cena]
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "it_IT")
        f.calendar = calendar
        f.dateFormat = "EEEE d"
        return f
    }()

    private static let monthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "it_IT")
        f.calendar = calendar
        f.dateFormat = "LLLL"
        return f
    }()

    /// "Venerdì 14"
    static func formatDayLabel(_ d: Date) -> String {
        let s = dayFormatter.string(from: d)
        return s.prefix(1).uppercased() + s.dropFirst()
    }

    /// "Settimana 14–21 luglio" or "Settimana 28 luglio – 4 agosto".
    static func formatCycleLabel(_ inizio: Date) -> String {
        let fine = calendar.date(byAdding: .day, value: 7, to: inizio) ?? inizio
        let meseInizio = monthFormatter.string(from: inizio)
        let meseFine = monthFormatter.string(from: fine)
        let gInizio = calendar.component(.day, from: inizio)
        let gFine = calendar.component(.day, from: fine)
        let range = meseInizio == meseFine
            ? "\(gInizio)–\(gFine) \(meseFine)"
            : "\(gInizio) \(meseInizio) – \(gFine) \(meseFine)"
        return "Settimana \(range)"
    }

    static func isToday(_ d: Date) -> Bool { calendar.isDateInToday(d) }

    static func shiftCycle(_ inizio: Date, by delta: Int) -> Date {
        calendar.date(byAdding: .day, value: delta * 7, to: inizio) ?? inizio
    }

    /// Start of the cycle displayed for a given offset from the current one.
    static func cycle(offset: Int, giornoSpesa: Int, now: Date = Date()) -> Date {
        shiftCycle(cycleStart(now, giornoInizio: giornoSpesa), by: offset)
    }
}
