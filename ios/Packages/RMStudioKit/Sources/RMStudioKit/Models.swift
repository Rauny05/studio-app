import Foundation

// MARK: - Deliverables (Google Sheet + Redis overrides)

public enum ItemStatus: String, Codable, Sendable { case pending = "Pending", completed = "Completed" }

public enum OverallStatus: String, Codable, Sendable, CaseIterable {
    case pending, inProgress = "in-progress", awaitingPayment = "awaiting-payment", done

    public var title: String {
        switch self {
        case .pending: "Pending"
        case .inProgress: "In progress"
        case .awaitingPayment: "Awaiting payment"
        case .done: "Done"
        }
    }
}

public struct DeliverableItem: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String?
    public var label: String
    public var type: String?
    public var status: ItemStatus
    public var completedAt: String?
    public var completedBy: String?
    public var publishedUrl: String?
    public var emailDrafted: Bool?

    public var stableKey: String { id ?? label }

    public init(id: String? = nil, label: String, type: String? = nil, status: ItemStatus = .pending,
                completedAt: String? = nil, completedBy: String? = nil, publishedUrl: String? = nil,
                emailDrafted: Bool? = nil) {
        self.id = id; self.label = label; self.type = type; self.status = status
        self.completedAt = completedAt; self.completedBy = completedBy
        self.publishedUrl = publishedUrl; self.emailDrafted = emailDrafted
    }

    enum CodingKeys: String, CodingKey { case id, label, type, status, completedAt, completedBy, publishedUrl, emailDrafted }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenientOptional(.id)
        label = c.lenient(.label, "")
        type = c.lenientOptional(.type)
        status = c.lenient(.status, ItemStatus.pending)
        completedAt = c.lenientOptional(.completedAt)
        completedBy = c.lenientOptional(.completedBy)
        publishedUrl = c.lenientOptional(.publishedUrl)
        emailDrafted = c.lenientOptional(.emailDrafted)
    }
}

public struct ActivityEntry: Codable, Equatable, Hashable, Sendable {
    public var type: String // deliverable_completed | email_generated | url_added
    public var message: String
    public var deliverableId: String?
    public var deliverableLabel: String?
    public var createdAt: String

    public init(type: String, message: String, deliverableId: String? = nil,
                deliverableLabel: String? = nil, createdAt: String) {
        self.type = type; self.message = message; self.deliverableId = deliverableId
        self.deliverableLabel = deliverableLabel; self.createdAt = createdAt
    }
}

public struct DeliverableRow: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var pnNo: String
    public var brand: String
    public var deliverables: [DeliverableItem]
    public var poc: String
    public var pocName: String
    public var pocCompany: String
    public var emailSent: Bool
    public var advance50: Bool
    public var payment100: Bool
    public var invoiceNumber: String
    public var note: String
    public var paymentStep: Int
    public var overallStatus: OverallStatus
    public var month: String
    public var goLiveDate: String? // YYYY-MM-DD, owned by the sheet
    public var activityLog: [ActivityEntry]?

    public init(id: String, pnNo: String = "", brand: String, deliverables: [DeliverableItem] = [],
                poc: String = "", pocName: String = "", pocCompany: String = "",
                emailSent: Bool = false, advance50: Bool = false, payment100: Bool = false,
                invoiceNumber: String = "", note: String = "", month: String = "",
                goLiveDate: String? = nil, activityLog: [ActivityEntry]? = nil) {
        self.id = id; self.pnNo = pnNo; self.brand = brand; self.deliverables = deliverables
        self.poc = poc; self.pocName = pocName; self.pocCompany = pocCompany
        self.emailSent = emailSent; self.advance50 = advance50; self.payment100 = payment100
        self.invoiceNumber = invoiceNumber; self.note = note
        self.paymentStep = payment100 ? 3 : advance50 ? 2 : emailSent ? 1 : 0
        self.overallStatus = DeliverableLogic.overallStatus(deliverables, payment100: payment100)
        self.month = month; self.goLiveDate = goLiveDate; self.activityLog = activityLog
    }

    enum CodingKeys: String, CodingKey {
        case id, pnNo, brand, deliverables, poc, pocName, pocCompany, emailSent, advance50, payment100
        case invoiceNumber, note, paymentStep, overallStatus, month, goLiveDate, activityLog
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        pnNo = c.lenient(.pnNo, "")
        brand = c.lenient(.brand, "")
        deliverables = c.lenient(.deliverables, [DeliverableItem]())
        poc = c.lenient(.poc, "")
        pocName = c.lenient(.pocName, "")
        pocCompany = c.lenient(.pocCompany, "")
        emailSent = c.lenient(.emailSent, false)
        advance50 = c.lenient(.advance50, false)
        payment100 = c.lenient(.payment100, false)
        invoiceNumber = c.lenient(.invoiceNumber, "")
        note = c.lenient(.note, "")
        paymentStep = c.lenient(.paymentStep, 0)
        overallStatus = c.lenient(.overallStatus, OverallStatus.pending)
        month = c.lenient(.month, "")
        goLiveDate = c.lenientOptional(.goLiveDate)
        activityLog = c.lenientOptional(.activityLog)
    }
}

struct DeliverablesResponse: Decodable { let deliverables: [DeliverableRow] }

// MARK: - Scripts (Gmail-ingested Google Doc scripts awaiting approval)

public enum ApprovalStatus: String, Codable, Sendable { case pending, approved }

public struct ScriptDoc: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var docUrl: String
    public var status: ApprovalStatus
    public var approvedAt: String?
    public var approvedBy: String?

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case docUrl = "doc_url", approvedAt = "approved_at", approvedBy = "approved_by"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, UUID().uuidString)
        name = c.lenient(.name, "Script")
        docUrl = c.lenient(.docUrl, "")
        status = c.lenient(.status, ApprovalStatus.pending)
        approvedAt = c.lenientOptional(.approvedAt)
        approvedBy = c.lenientOptional(.approvedBy)
    }
}

public struct InboxScript: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var docs: [ScriptDoc]
    public var senderName: String
    public var senderEmail: String
    public var receivedAt: String
    public var status: ApprovalStatus

    enum CodingKeys: String, CodingKey {
        case id, title, docs, status
        case senderName = "sender_name", senderEmail = "sender_email", receivedAt = "received_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        title = c.lenient(.title, "Untitled")
        docs = c.lenient(.docs, [ScriptDoc]())
        senderName = c.lenient(.senderName, "")
        senderEmail = c.lenient(.senderEmail, "")
        receivedAt = c.lenient(.receivedAt, "")
        status = c.lenient(.status, ApprovalStatus.pending)
    }
}

struct ScriptsResponse: Decodable { let scripts: [InboxScript] }

// MARK: - Production boards (kanban sync blob)

public struct KanbanTag: Codable, Equatable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var color: String
}

/// A content card. `description` is the script body written in the web app.
public struct KanbanCard: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var columnId: String
    public var boardId: String
    public var title: String
    public var description: String
    public var deliverableType: String?
    public var videoLink: String?
    public var tags: [KanbanTag]
    public var priority: String
    public var dueDate: String?
    public var notes: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, columnId, boardId, title, description, deliverableType, videoLink, tags, priority, dueDate, notes, createdAt, updatedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        columnId = c.lenient(.columnId, "")
        boardId = c.lenient(.boardId, "")
        title = c.lenient(.title, "Untitled")
        description = c.lenient(.description, "")
        deliverableType = c.lenientOptional(.deliverableType)
        videoLink = c.lenientOptional(.videoLink)
        tags = c.lenient(.tags, [KanbanTag]())
        priority = c.lenient(.priority, "medium")
        dueDate = c.lenientOptional(.dueDate)
        notes = c.lenient(.notes, "")
        createdAt = c.lenient(.createdAt, "")
        updatedAt = c.lenient(.updatedAt, "")
    }
}

public struct KanbanColumn: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var cardIds: [String]
}

public struct KanbanBoard: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var description: String
    public var color: String
    public var emoji: String
    public var columnIds: [String]

    enum CodingKeys: String, CodingKey { case id, title, description, color, emoji, columnIds }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        title = c.lenient(.title, "Board")
        description = c.lenient(.description, "")
        color = c.lenient(.color, "#7c3aed")
        emoji = c.lenient(.emoji, "")
        columnIds = c.lenient(.columnIds, [String]())
    }
}

public struct KanbanData: Decodable, Sendable {
    public var boards: [KanbanBoard]
    public var columns: [String: KanbanColumn]
    public var cards: [String: KanbanCard]

    enum CodingKeys: String, CodingKey { case boards, columns, cards }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        boards = c.lenient(.boards, [KanbanBoard]())
        columns = c.lenient(.columns, [String: KanbanColumn]())
        cards = c.lenient(.cards, [String: KanbanCard]())
    }
}

// MARK: - Todos, cash

public struct Todo: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var description: String?
    public var link: String?
    public var completed: Bool
    public var updatedAt: String
    public var createdBy: String

    enum CodingKeys: String, CodingKey { case id, title, description, link, completed, updatedAt, createdBy }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        title = c.lenient(.title, "")
        description = c.lenientOptional(.description)
        link = c.lenientOptional(.link)
        completed = c.lenient(.completed, false)
        updatedAt = c.lenient(.updatedAt, "")
        createdBy = c.lenient(.createdBy, "")
    }
}

public struct TodoData: Decodable, Sendable {
    public var todos: [Todo]
    enum CodingKeys: String, CodingKey { case todos }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        todos = c.lenient(.todos, [Todo]())
    }
}

public struct CashTransaction: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var id: String
    public var amount: Double
    public var type: String // income | expense
    public var category: String
    public var note: String?
    public var date: String // YYYY-MM-DD
    public var time: String
    public var createdAt: String

    public var isIncome: Bool { type == "income" }

    enum CodingKeys: String, CodingKey { case id, amount, type, category, note, date, time, createdAt }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(.id, "")
        amount = c.lenient(.amount, 0)
        type = c.lenient(.type, "expense")
        category = c.lenient(.category, "Misc")
        note = c.lenientOptional(.note)
        date = c.lenient(.date, "")
        time = c.lenient(.time, "")
        createdAt = c.lenient(.createdAt, "")
    }
}

public struct CashData: Decodable, Sendable {
    public var transactions: [CashTransaction]
    public var categories: [String]
    enum CodingKeys: String, CodingKey { case transactions, categories }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        transactions = c.lenient(.transactions, [CashTransaction]())
        categories = c.lenient(.categories, [String]())
    }
}

// MARK: - Auth

public struct AuthUser: Codable, Equatable, Sendable {
    public var name: String
    public var email: String
    public var role: String
    public var isAdmin: Bool { role == "admin" }

    public init(name: String, email: String, role: String) {
        self.name = name; self.email = email; self.role = role
    }
}

public struct AuthResponse: Codable, Sendable {
    public var token: String
    public var user: AuthUser
}
