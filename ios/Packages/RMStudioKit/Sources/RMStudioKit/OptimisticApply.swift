import Foundation

extension Workspace {
    /// Applies an op to the in-memory workspace so the UI updates instantly (optimistic).
    /// The same op is replayed against the server later; both paths use `OpApplier`.
    public mutating func applyLocally(_ op: PendingOp) {
        switch op {
        case .completeDeliverable(let seed, let key, let url, let by, let at):
            let base = overrides[seed.id] ?? DeliverableLogic.forOverrideStorage(seed)
            overrides[seed.id] = DeliverableLogic.forOverrideStorage(
                DeliverableLogic.completing(base, itemKey: key, url: url, by: by, at: at))
        case .setPayment(let seed, let field, let value):
            let base = overrides[seed.id] ?? DeliverableLogic.forOverrideStorage(seed)
            overrides[seed.id] = DeliverableLogic.forOverrideStorage(
                DeliverableLogic.settingPayment(base, field: field, value: value))
        case .addLocalRow(let row):
            guard let decoded = try? row.decode(DeliverableRow.self),
                  !localRows.contains(where: { $0.id == decoded.id }) else { return }
            localRows.insert(decoded, at: 0)
        case .setScriptApproval(let scriptId, let docId, let approved):
            guard let i = scripts.firstIndex(where: { $0.id == scriptId }) else { return }
            let status: ApprovalStatus = approved ? .approved : .pending
            for d in scripts[i].docs.indices where docId == nil || scripts[i].docs[d].id == docId {
                scripts[i].docs[d].status = status
            }
            scripts[i].status = scripts[i].docs.allSatisfy({ $0.status == .approved }) && !scripts[i].docs.isEmpty ? .approved : .pending
        case .setCardScript, .setCardTitle, .addCard, .moveCard:
            var blob = kanban ?? .null
            _ = OpApplier.apply(op, to: &blob)
            kanban = blob
        case .setTodoCompleted, .addTodo:
            var blob = todos ?? .null
            _ = OpApplier.apply(op, to: &blob)
            todos = blob
        case .addCashTransaction, .deleteCashTransaction:
            var blob = cash ?? .null
            _ = OpApplier.apply(op, to: &blob)
            cash = blob
        }
    }
}

/// Reads claims from a JWT for display and expiry checks only. The server verifies signatures.
public struct SessionClaims: Equatable, Sendable {
    public var email: String
    public var name: String
    public var role: String
    public var expiresAt: Date?

    public static func decode(token: String) -> SessionClaims? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var b64 = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        guard let data = Data(base64Encoded: b64),
              let obj = try? JSONDecoder().decode([String: JSONValue].self, from: data),
              let email = obj["email"]?.stringValue else { return nil }
        var exp: Date?
        if case .number(let n)? = obj["exp"] { exp = Date(timeIntervalSince1970: n) }
        return SessionClaims(email: email, name: obj["name"]?.stringValue ?? email,
                             role: obj["role"]?.stringValue ?? "member", expiresAt: exp)
    }

    public var isExpired: Bool { expiresAt.map { $0 <= Date() } ?? false }
    public var isAdmin: Bool { role == "admin" }
}
