import Foundation

/// Small Codable-on-disk store (JSON files in Application Support).
/// Files are excluded from backups and, on iOS, encrypted until first unlock.
public struct DiskStore: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var dir = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
    }

    public static func defaultDirectory(name: String = "RMStudio") -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent(name, isDirectory: true)
    }

    private func url(_ name: String) -> URL { directory.appendingPathComponent(name + ".json") }

    public func load<T: Decodable>(_ type: T.Type, name: String) -> T? {
        guard let data = try? Data(contentsOf: url(name)) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(T.self, from: data)
    }

    public func save<T: Encodable>(_ value: T, name: String) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(value) else { return }
        #if os(iOS)
        let options: Data.WritingOptions = [.atomic, .completeFileUnlessOpen]
        #else
        let options: Data.WritingOptions = [.atomic]
        #endif
        try? data.write(to: url(name), options: options)
    }

    public func names(prefix: String) -> [String] {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return files.filter { $0.hasPrefix(prefix) && $0.hasSuffix(".json") }.map { String($0.dropLast(5)) }
    }

    public func removeAll() {
        for f in (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? [] {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(f))
        }
    }

    public func remove(name: String) { try? FileManager.default.removeItem(at: url(name)) }
}

/// Unsynced script text, written on every edit so a crash or kill never loses typing.
public struct ScriptDraft: Codable, Equatable, Sendable {
    public var cardId: String
    public var baseText: String
    public var text: String
    public var updatedAt: Date

    public init(cardId: String, baseText: String, text: String, updatedAt: Date = Date()) {
        self.cardId = cardId; self.baseText = baseText; self.text = text; self.updatedAt = updatedAt
    }
}

/// Durable FIFO of pending mutations plus unresolved script conflicts.
public actor OfflineQueue {
    private let store: DiskStore
    public private(set) var ops: [QueuedOp]
    public private(set) var conflicts: [ScriptConflict]

    public init(store: DiskStore) {
        self.store = store
        self.ops = store.load([QueuedOp].self, name: "queue") ?? []
        self.conflicts = store.load([ScriptConflict].self, name: "conflicts") ?? []
    }

    public func enqueue(_ op: PendingOp) -> QueuedOp {
        // A newer script edit for the same card replaces an older queued one (keeping the oldest base).
        if case .setCardScript(let cardId, _, let newText, let at) = op,
           let i = ops.firstIndex(where: { if case .setCardScript(let c, _, _, _) = $0.op { return c == cardId } else { return false } }),
           case .setCardScript(_, let oldBase, _, _) = ops[i].op {
            ops[i].op = .setCardScript(cardId: cardId, baseText: oldBase, newText: newText, at: at)
            persist()
            return ops[i]
        }
        let queued = QueuedOp(op: op)
        ops.append(queued)
        persist()
        return queued
    }

    public func remove(ids: Set<String>) {
        ops.removeAll { ids.contains($0.id) }
        persist()
    }

    public func markFailed(ids: Set<String>, error: String) {
        for i in ops.indices where ids.contains(ops[i].id) {
            ops[i].attempts += 1
            ops[i].lastError = error
        }
        persist()
    }

    public func addConflict(_ c: ScriptConflict) {
        conflicts.removeAll { $0.cardId == c.cardId }
        conflicts.append(c)
        persist()
    }

    public func resolveConflict(cardId: String) {
        conflicts.removeAll { $0.cardId == cardId }
        persist()
    }

    public func hasPendingScriptEdit(cardId: String) -> Bool {
        ops.contains { if case .setCardScript(let c, _, _, _) = $0.op { return c == cardId } else { return false } }
    }

    public var count: Int { ops.count }

    private func persist() {
        store.save(ops, name: "queue")
        store.save(conflicts, name: "conflicts")
    }
}
