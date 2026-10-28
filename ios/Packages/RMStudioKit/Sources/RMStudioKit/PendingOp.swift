import Foundation

/// A user intent recorded locally and replayed against the *latest* server blob.
/// Ops are "set" style, so replaying one that already landed is a no-op (idempotent).
public enum PendingOp: Codable, Equatable, Sendable {
    case completeDeliverable(seed: DeliverableRow, itemKey: String, url: String?, by: String, at: String)
    case setPayment(seed: DeliverableRow, field: PaymentField, value: Bool)
    case setCardScript(cardId: String, baseText: String, newText: String, at: String)
    case setTodoCompleted(todoId: String, completed: Bool, at: String)
    case addTodo(todo: JSONValue)
    case addCashTransaction(tx: JSONValue)
    case deleteCashTransaction(id: String)
    case setScriptApproval(scriptId: String, docId: String?, approved: Bool)
    case addLocalRow(row: JSONValue)
    case addCard(card: JSONValue)
    case moveCard(cardId: String, toColumnId: String, at: String)
    case setCardTitle(cardId: String, title: String, at: String)

    /// The sync blob this op edits; nil for REST-only ops.
    public var syncKey: SyncKey? {
        switch self {
        case .completeDeliverable, .setPayment: .deliverableOverrides
        case .setCardScript: .kanban
        case .setTodoCompleted, .addTodo: .todos
        case .addCashTransaction, .deleteCashTransaction: .cash
        case .setScriptApproval: nil
        case .addLocalRow: .deliverableLocalRows
        case .addCard, .moveCard, .setCardTitle: .kanban
        }
    }

    public var summary: String {
        switch self {
        case .completeDeliverable(let seed, let key, _, _, _): "Complete \(key) · \(seed.brand)"
        case .setPayment(let seed, let field, let value): "\(field.rawValue)=\(value) · \(seed.brand)"
        case .setCardScript: "Script edit"
        case .setTodoCompleted(_, let completed, _): completed ? "Complete task" : "Reopen task"
        case .addTodo: "Add task"
        case .addCashTransaction: "Add cash entry"
        case .deleteCashTransaction: "Delete cash entry"
        case .setScriptApproval(_, _, let approved): approved ? "Approve script" : "Unapprove script"
        case .addLocalRow: "New deliverable"
        case .addCard: "New card"
        case .moveCard: "Move card"
        case .setCardTitle: "Rename card"
        }
    }
}

public struct QueuedOp: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var createdAt: Date
    public var attempts: Int
    public var lastError: String?
    public var op: PendingOp

    public init(op: PendingOp, id: String = UUID().uuidString, createdAt: Date = Date()) {
        self.id = id; self.createdAt = createdAt; self.attempts = 0; self.lastError = nil; self.op = op
    }
}

/// A script edit that could not be applied because the text changed elsewhere.
public struct ScriptConflict: Codable, Equatable, Sendable, Identifiable {
    public var id: String          // queued op id
    public var cardId: String
    public var localText: String
    public var remoteText: String
    public var at: String
}

public enum ApplyOutcome: Equatable, Sendable {
    case applied
    case noChange
    case conflict(remoteText: String)
    case missingTarget
}

/// Pure application of an op to a decoded sync blob. No I/O, fully unit-testable.
public enum OpApplier {
    public static func apply(_ op: PendingOp, to blob: inout JSONValue) -> ApplyOutcome {
        switch op {
        case .completeDeliverable(let seed, let key, let url, let by, let at):
            return mutateOverride(&blob, seed: seed) { DeliverableLogic.completing($0, itemKey: key, url: url, by: by, at: at) }
        case .setPayment(let seed, let field, let value):
            return mutateOverride(&blob, seed: seed) { DeliverableLogic.settingPayment($0, field: field, value: value) }
        case .setCardScript(let cardId, let baseText, let newText, let at):
            guard let card = blob["cards"]?[cardId] else { return .missingTarget }
            let remote = card["description"]?.stringValue ?? ""
            if remote == newText { return .noChange }
            if remote != baseText { return .conflict(remoteText: remote) }
            blob["cards"]?[cardId]?["description"] = .string(newText)
            blob["cards"]?[cardId]?["updatedAt"] = .string(at)
            return .applied
        case .setTodoCompleted(let id, let completed, let at):
            guard var todos = blob["todos"]?.arrayValue,
                  let i = todos.firstIndex(where: { $0["id"]?.stringValue == id }) else { return .missingTarget }
            if todos[i]["completed"] == .bool(completed) { return .noChange }
            todos[i]["completed"] = .bool(completed)
            todos[i]["updatedAt"] = .string(at)
            blob["todos"] = .array(todos)
            return .applied
        case .addTodo(let todo):
            guard let id = todo["id"]?.stringValue else { return .missingTarget }
            var todos = blob["todos"]?.arrayValue ?? []
            if todos.contains(where: { $0["id"]?.stringValue == id }) { return .noChange }
            todos.append(todo)
            if case .object = blob { blob["todos"] = .array(todos) } else { blob = .object(["todos": .array(todos)]) }
            return .applied
        case .addCashTransaction(let tx):
            guard let id = tx["id"]?.stringValue else { return .missingTarget }
            var list = blob["transactions"]?.arrayValue ?? []
            if list.contains(where: { $0["id"]?.stringValue == id }) { return .noChange }
            list.insert(tx, at: 0)
            if case .object = blob { blob["transactions"] = .array(list) } else { blob = .object(["transactions": .array(list)]) }
            return .applied
        case .deleteCashTransaction(let id):
            guard var list = blob["transactions"]?.arrayValue else { return .noChange }
            let before = list.count
            list.removeAll { $0["id"]?.stringValue == id }
            if list.count == before { return .noChange }
            blob["transactions"] = .array(list)
            return .applied
        case .setScriptApproval:
            return .noChange // REST op, handled by SyncEngine
        case .addLocalRow(let row):
            guard let id = row["id"]?.stringValue else { return .missingTarget }
            var list = blob.arrayValue ?? []
            if list.contains(where: { $0["id"]?.stringValue == id }) { return .noChange }
            list.insert(row, at: 0) // the web app prepends new rows
            blob = .array(list)
            return .applied
        case .addCard(let card):
            guard let id = card["id"]?.stringValue, let columnId = card["columnId"]?.stringValue,
                  var ids = blob["columns"]?[columnId]?["cardIds"]?.arrayValue else { return .missingTarget }
            if blob["cards"]?[id] != nil { return .noChange }
            ids.append(.string(id))
            blob["columns"]?[columnId]?["cardIds"] = .array(ids)
            if blob["cards"] == nil { blob["cards"] = .object([:]) }
            blob["cards"]?[id] = card
            return .applied
        case .setCardTitle(let cardId, let title, let at):
            guard let card = blob["cards"]?[cardId] else { return .missingTarget }
            if card["title"]?.stringValue == title { return .noChange }
            blob["cards"]?[cardId]?["title"] = .string(title)
            blob["cards"]?[cardId]?["updatedAt"] = .string(at)
            return .applied
        case .moveCard(let cardId, let toColumnId, let at):
            guard let card = blob["cards"]?[cardId], blob["columns"]?[toColumnId] != nil else { return .missingTarget }
            if card["columnId"]?.stringValue == toColumnId { return .noChange }
            for (colId, col) in blob["columns"]?.objectValue ?? [:] {
                guard var ids = col["cardIds"]?.arrayValue, ids.contains(.string(cardId)) else { continue }
                ids.removeAll { $0 == .string(cardId) }
                blob["columns"]?[colId]?["cardIds"] = .array(ids)
            }
            var target = blob["columns"]?[toColumnId]?["cardIds"]?.arrayValue ?? []
            target.append(.string(cardId))
            blob["columns"]?[toColumnId]?["cardIds"] = .array(target)
            blob["cards"]?[cardId]?["columnId"] = .string(toColumnId)
            blob["cards"]?[cardId]?["updatedAt"] = .string(at)
            return .applied
        }
    }

    /// Overrides blob is a map {rowId: row}; tolerates the legacy `{overrides: {...}}` wrapper.
    private static func mutateOverride(_ blob: inout JSONValue, seed: DeliverableRow,
                                       change: (DeliverableRow) -> DeliverableRow) -> ApplyOutcome {
        var map: [String: JSONValue]
        var wrapped = false
        if case .object(let o) = blob {
            if let inner = o["overrides"]?.objectValue { map = inner; wrapped = true } else { map = o }
        } else { map = [:] }

        let current: DeliverableRow
        if let existing = map[seed.id], let row = try? existing.decode(DeliverableRow.self) {
            current = row
        } else {
            current = DeliverableLogic.forOverrideStorage(seed)
        }
        let updated = DeliverableLogic.forOverrideStorage(change(current))
        guard let newJSON = try? JSONValue.from(updated) else { return .missingTarget }
        if let oldJSON = map[seed.id], oldJSON == newJSON { return .noChange }
        if map[seed.id] == nil && updated == current { return .noChange }
        map[seed.id] = newJSON
        blob = wrapped ? .object(["overrides": .object(map)]) : .object(map)
        return .applied
    }
}
