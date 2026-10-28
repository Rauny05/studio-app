import Foundation

/// Everything the UI reads, assembled from cached/synced backend data.
public struct Workspace: Codable, Equatable, Sendable {
    public var sheetRows: [DeliverableRow] = []
    public var overrides: [String: DeliverableRow] = [:]
    public var localRows: [DeliverableRow] = []
    public var hiddenIds: [String] = []
    public var kanban: JSONValue?
    public var todos: JSONValue?
    public var cash: JSONValue?
    public var scripts: [InboxScript] = []
    public var versions: [String: String] = [:] // sync key -> updatedAt last read
    public var refreshedAt: Date?

    public init() {}

    public var deliverables: [DeliverableRow] {
        DeliverableLogic.displayRows(sheet: sheetRows, overrides: overrides, localRows: localRows, hidden: Set(hiddenIds))
    }
    public var kanbanData: KanbanData? { try? kanban?.decode(KanbanData.self) }
    public var todoList: [Todo] { (try? todos?.decode(TodoData.self))?.todos ?? [] }
    public var cashData: CashData? { try? cash?.decode(CashData.self) }
}

// MARK: - Home

public struct AttentionItem: Identifiable, Equatable, Sendable {
    public enum Kind: String, Sendable { case overdueGoLive, goLiveToday, goLiveSoon, awaitingPayment, scriptReview }
    public var id: String
    public var kind: Kind
    public var title: String
    public var detail: String
    public var rowId: String?
    public var scriptId: String?
    public var sortKey: Int
}

public struct StudioOverview: Equatable, Sendable {
    public var activeProjects = 0
    public var pendingItems = 0
    public var completedItems = 0
    public var awaitingPayment = 0
    public var upcomingGoLives = 0
    public var openTodos = 0
}

public enum Insights {
    private static func hasPending(_ r: DeliverableRow) -> Bool { r.deliverables.contains { $0.status == .pending } }

    public static func overview(_ ws: Workspace, today: String = ISTCalendar.today()) -> StudioOverview {
        var o = StudioOverview()
        for r in ws.deliverables {
            if r.overallStatus == .pending || r.overallStatus == .inProgress { o.activeProjects += 1 }
            o.pendingItems += r.deliverables.filter { $0.status == .pending }.count
            o.completedItems += r.deliverables.filter { $0.status == .completed }.count
            if r.overallStatus == .awaitingPayment { o.awaitingPayment += 1 }
            if let d = r.goLiveDate, hasPending(r), let n = ISTCalendar.days(from: today, to: d), n >= 0, n <= 7 { o.upcomingGoLives += 1 }
        }
        o.openTodos = ws.todoList.filter { !$0.completed }.count
        return o
    }

    public static func attention(_ ws: Workspace, today: String = ISTCalendar.today()) -> [AttentionItem] {
        var items: [AttentionItem] = []
        for r in ws.deliverables {
            if let d = r.goLiveDate, hasPending(r), let n = ISTCalendar.days(from: today, to: d) {
                let pending = r.deliverables.filter { $0.status == .pending }.count
                if n < 0 {
                    items.append(.init(id: "late-\(r.id)", kind: .overdueGoLive, title: r.brand,
                        detail: "\(pending) pending · go-live \(-n) day\(n == -1 ? "" : "s") ago", rowId: r.id, scriptId: nil, sortKey: n))
                } else if n == 0 {
                    items.append(.init(id: "today-\(r.id)", kind: .goLiveToday, title: r.brand,
                        detail: "\(pending) pending · goes live today", rowId: r.id, scriptId: nil, sortKey: 0))
                } else if n <= 2 {
                    items.append(.init(id: "soon-\(r.id)", kind: .goLiveSoon, title: r.brand,
                        detail: "\(pending) pending · goes live in \(n) day\(n == 1 ? "" : "s")", rowId: r.id, scriptId: nil, sortKey: 100 + n))
                }
            }
            if r.overallStatus == .awaitingPayment {
                items.append(.init(id: "pay-\(r.id)", kind: .awaitingPayment, title: r.brand,
                    detail: "Delivered · \(paymentStageText(r))", rowId: r.id, scriptId: nil, sortKey: 200))
            }
        }
        for s in ws.scripts where s.docs.contains(where: { $0.status == .pending }) {
            let n = s.docs.filter { $0.status == .pending }.count
            items.append(.init(id: "script-\(s.id)", kind: .scriptReview, title: s.title,
                detail: "\(n) script\(n == 1 ? "" : "s") awaiting approval", rowId: nil, scriptId: s.id, sortKey: 300))
        }
        return items.sorted { $0.sortKey < $1.sortKey }
    }

    public static func paymentStageText(_ r: DeliverableRow) -> String {
        if r.payment100 { return "Paid in full" }
        if r.advance50 { return "Balance outstanding" }
        if r.emailSent { return "Awaiting advance" }
        return "Not invoiced"
    }

    public static func goLivesToday(_ ws: Workspace, today: String = ISTCalendar.today()) -> [DeliverableRow] {
        ws.deliverables.filter { $0.goLiveDate == today && hasPending($0) }
    }
}

// MARK: - Finance

/// Payment pipeline derived from the sheet columns (invoice email / 50% advance / 100%).
/// The backend stores NO amounts or due dates for client payments, so the summary is
/// counts by stage; it never invents totals.
public struct PaymentSummary: Equatable, Sendable {
    public var notInvoiced: [DeliverableRow] = []
    public var awaitingAdvance: [DeliverableRow] = []
    public var awaitingBalance: [DeliverableRow] = []
    public var paid: [DeliverableRow] = []
    /// Work fully delivered but not fully paid: the closest honest proxy for "overdue".
    public var deliveredUnpaid: [DeliverableRow] = []
}

public struct CashSummary: Equatable, Sendable {
    public var income: Double
    public var expense: Double
    public var balance: Double { income - expense }
}

public enum Finance {
    public static func payments(_ rows: [DeliverableRow]) -> PaymentSummary {
        var s = PaymentSummary()
        for r in rows where !r.deliverables.isEmpty {
            if r.payment100 { s.paid.append(r) }
            else if r.advance50 { s.awaitingBalance.append(r) }
            else if r.emailSent { s.awaitingAdvance.append(r) }
            else { s.notInvoiced.append(r) }
            if r.overallStatus == .awaitingPayment { s.deliveredUnpaid.append(r) }
        }
        return s
    }

    public static func cash(_ txs: [CashTransaction], month: String? = nil) -> CashSummary {
        let scoped = month.map { m in txs.filter { $0.date.hasPrefix(m) } } ?? txs
        return CashSummary(income: scoped.filter(\.isIncome).reduce(0) { $0 + $1.amount },
                           expense: scoped.filter { !$0.isIncome }.reduce(0) { $0 + $1.amount })
    }
}

// MARK: - Contacts (derived: the backend has no contact table)

public struct Contact: Identifiable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var company: String
    public var email: String?
    public var phone: String?
    public var rowIds: [String]
}

public enum Contacts {
    public static func derive(from rows: [DeliverableRow]) -> [Contact] {
        var byKey: [String: Contact] = [:]
        for r in rows {
            let name = r.pocName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            let company = r.pocCompany.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = (name + "|" + company).lowercased()
            var c = byKey[key] ?? Contact(id: key, name: name, company: company, email: nil, phone: nil, rowIds: [])
            if c.email == nil { c.email = firstMatch(r.poc, "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}") }
            if c.phone == nil { c.phone = firstMatch(r.poc, "\\+?\\d[\\d\\s-]{8,}\\d") }
            if !c.rowIds.contains(r.id) { c.rowIds.append(r.id) }
            byKey[key] = c
        }
        return byKey.values.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func firstMatch(_ text: String, _ pattern: String) -> String? {
        guard let range = text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
        return String(text[range]).trimmingCharacters(in: .whitespaces)
    }
}

// MARK: - Search

public struct SearchHit: Identifiable, Equatable, Sendable {
    public enum Kind: String, CaseIterable, Sendable {
        case deliverable = "Deliverables", script = "Scripts", card = "Production", contact = "Contacts", todo = "Tasks", payment = "Payments"
    }
    public var id: String
    public var kind: Kind
    public var title: String
    public var subtitle: String
    public var targetId: String
}

public enum SearchIndex {
    /// In-memory search across the cached workspace. There is no server-side search API.
    public static func search(_ query: String, in ws: Workspace, limitPerKind: Int = 6) -> [SearchHit] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard q.count >= 2 else { return [] }

        func matches(_ fields: [String]) -> Bool {
            for f in fields where f.lowercased().contains(q) { return true }
            return false
        }

        var hits: [SearchHit] = []
        var counts: [SearchHit.Kind: Int] = [:]
        func add(_ hit: SearchHit) {
            let n = counts[hit.kind] ?? 0
            guard n < limitPerKind else { return }
            counts[hit.kind] = n + 1
            hits.append(hit)
        }

        let rows = ws.deliverables
        for r in rows {
            var fields: [String] = [r.brand, r.pnNo, r.note, r.poc]
            for d in r.deliverables { fields.append(d.label) }
            if matches(fields) {
                add(SearchHit(id: "d-" + r.id, kind: .deliverable, title: r.brand,
                              subtitle: r.pnNo + " · " + r.overallStatus.title, targetId: r.id))
            }
            if !r.invoiceNumber.isEmpty && matches([r.invoiceNumber]) {
                add(SearchHit(id: "p-" + r.id, kind: .payment, title: "Invoice " + r.invoiceNumber,
                              subtitle: r.brand + " · " + Insights.paymentStageText(r), targetId: r.id))
            }
        }
        for s in ws.scripts {
            var fields: [String] = [s.title, s.senderName]
            for d in s.docs { fields.append(d.name) }
            if matches(fields) {
                add(SearchHit(id: "s-" + s.id, kind: .script, title: s.title, subtitle: s.senderName, targetId: s.id))
            }
        }
        if let k = ws.kanbanData {
            let cards = k.cards.values.sorted { $0.updatedAt > $1.updatedAt }
            for c in cards where matches([c.title, c.description, c.notes]) {
                add(SearchHit(id: "c-" + c.id, kind: .card, title: c.title,
                              subtitle: c.deliverableType ?? "Card", targetId: c.id))
            }
        }
        for c in Contacts.derive(from: rows) where matches([c.name, c.company, c.email ?? ""]) {
            add(SearchHit(id: "ct-" + c.id, kind: .contact, title: c.name, subtitle: c.company, targetId: c.id))
        }
        for t in ws.todoList where matches([t.title, t.description ?? ""]) {
            add(SearchHit(id: "t-" + t.id, kind: .todo, title: t.title,
                          subtitle: t.completed ? "Done" : "Open", targetId: t.id))
        }
        return hits
    }
}
