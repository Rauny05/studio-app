import Foundation

/// Port of src/data/script-templates.ts (the web app's script templates).
public struct ScriptTemplate: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let deliverable: String
    public let summary: String
    public let content: String

    public static let all: [ScriptTemplate] = [
        .init(id: "youtube", name: "YouTube Video", deliverable: "YouTube", summary: "Hook + intro + body + CTA",
              content: "# Hook\nStrong opening line that makes them stay...\n\n# Intro\nBriefly introduce yourself and the topic...\n\n# Main Content\n\n## Point 1\n\n## Point 2\n\n## Point 3\n\n# CTA\nLike, subscribe, and comment below..."),
        .init(id: "reel", name: "Reel / Short", deliverable: "Reel", summary: "3-sec hook + value + CTA",
              content: "# Hook (0–3s)\nStrong opening line...\n\n# Value (4–25s)\nCore insight or tip...\n\n# CTA (26–30s)\nFollow for more..."),
        .init(id: "podcast", name: "Podcast Episode", deliverable: "Podcast", summary: "Intro + topics + outro",
              content: "# Opening\nWelcome and episode intro...\n\n# Topic 1\n\n# Topic 2\n\n# Topic 3\n\n# Closing\nThanks + next episode teaser + CTA"),
        .init(id: "thread", name: "Twitter/X Thread", deliverable: "Post", summary: "Hook tweet + body tweets",
              content: "# Tweet 1 — Hook\nControversial or surprising opener...\n\n# Tweet 2\n\n# Tweet 3\n\n# Tweet 4\n\n# Final Tweet — CTA\nFollow for more + RT if useful"),
        .init(id: "blog", name: "Blog Post", deliverable: "Blog", summary: "Standard long-form structure",
              content: "# Introduction\nSet up the problem...\n\n## Section 1\n\n## Section 2\n\n## Section 3\n\n## Conclusion\nKey takeaway + CTA"),
    ]
}

public enum ScriptStats {
    public static func words(_ text: String) -> Int {
        text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }
    /// Reading/speaking time at ~150 wpm, in seconds.
    public static func speakingSeconds(_ text: String) -> Int { Int((Double(words(text)) / 150.0 * 60.0).rounded()) }
}

/// Builders for new records, kept here so the JSON shape matches the web app exactly.
public enum RecordFactory {
    public static func iso(_ date: Date = Date()) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    public static func newID(prefix: String = "") -> String {
        prefix + String(UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(12))
    }

    public static func card(boardId: String, columnId: String, title: String, script: String,
                            deliverableType: String?, now: Date = Date()) -> JSONValue {
        let t = iso(now)
        return .object([
            "id": .string(newID(prefix: "card-")), "boardId": .string(boardId), "columnId": .string(columnId),
            "title": .string(title), "description": .string(script),
            "deliverableType": deliverableType.map { JSONValue.string($0) } ?? JSONValue.null,
            "thumbnailUrl": .null, "videoLink": .null, "tags": .array([]), "priority": .string("medium"),
            "dueDate": .null, "notes": .string(""), "createdAt": .string(t), "updatedAt": .string(t),
        ])
    }

    public static func todo(title: String, createdBy: String, now: Date = Date()) -> JSONValue {
        let t = iso(now)
        return .object([
            "id": .string(newID()), "title": .string(title), "color": .string("#7c3aed"), "completed": .bool(false),
            "viewAccess": .string("all"), "editAccess": .string("all"),
            "createdBy": .string(createdBy), "createdAt": .string(t), "updatedAt": .string(t),
        ])
    }

    public static func cashTransaction(amount: Double, income: Bool, category: String, note: String,
                                       now: Date = Date()) -> JSONValue {
        let day = ISTCalendar.dateString(now)
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = ISTCalendar.zone; f.dateFormat = "HH:mm"
        return .object([
            "id": .string(newID()), "amount": .number(amount), "type": .string(income ? "income" : "expense"),
            "category": .string(category), "note": .string(note), "date": .string(day),
            "time": .string(f.string(from: now)), "createdAt": .string(iso(now)),
        ])
    }

    public static func localRow(brand: String, pnNo: String, deliverableLabels: [String], poc: String,
                                goLiveDate: String?) -> DeliverableRow {
        let id = "local-\(Int(Date().timeIntervalSince1970 * 1000))-\(newID())"
        let items = deliverableLabels.enumerated().map { DeliverableItem(id: "\(id)-del-\($0.offset)", label: $0.element) }
        let parts = poc.components(separatedBy: " - ")
        return DeliverableRow(id: id, pnNo: pnNo, brand: brand, deliverables: items, poc: poc,
                              pocName: parts.first?.trimmingCharacters(in: .whitespaces) ?? poc,
                              pocCompany: parts.dropFirst().joined(separator: " - ").trimmingCharacters(in: .whitespaces),
                              goLiveDate: goLiveDate)
    }
}
