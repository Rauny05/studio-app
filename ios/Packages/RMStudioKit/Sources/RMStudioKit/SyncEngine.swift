import Foundation

public struct FlushReport: Equatable, Sendable {
    public var applied = 0
    public var conflicts = 0
    public var remaining = 0
    public var error: String?
}

/// Replays queued ops against the latest server state with optimistic concurrency.
/// An op is only removed from the queue after the server confirmed the write.
public actor SyncEngine {
    private let backend: Backend
    private let queue: OfflineQueue
    private var flushing = false

    public init(backend: Backend, queue: OfflineQueue) {
        self.backend = backend
        self.queue = queue
    }

    public func flush() async -> FlushReport {
        var report = FlushReport()
        guard !flushing else { report.remaining = await queue.count; return report }
        flushing = true
        defer { flushing = false }

        let pending = await queue.ops

        // 1. Blob-backed ops, grouped per key (one read-modify-write per key).
        var byKey: [SyncKey: [QueuedOp]] = [:]
        for q in pending { if let k = q.op.syncKey { byKey[k, default: []].append(q) } }

        for (key, ops) in byKey {
            do {
                let result = try await applyOps(ops, to: key)
                await queue.remove(ids: result.done)
                report.applied += result.applied
                for c in result.conflicts { await queue.addConflict(c); report.conflicts += 1 }
            } catch {
                let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
                await queue.markFailed(ids: Set(ops.map(\.id)), error: message)
                report.error = message
                if let api = error as? APIError, api == .unauthorized { break }
            }
        }

        // 2. REST ops (script approval). PATCH is idempotent: it sets a status.
        for q in pending {
            guard case .setScriptApproval(let id, let docId, let approved) = q.op else { continue }
            do {
                try await backend.setScriptStatus(id: id, docId: docId, approved: approved)
                await queue.remove(ids: [q.id])
                report.applied += 1
            } catch {
                let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
                if let api = error as? APIError, !api.isTransient, api != .unauthorized {
                    // Permanent rejection (e.g. 403/404): drop it so it can't retry forever.
                    await queue.remove(ids: [q.id])
                }
                await queue.markFailed(ids: [q.id], error: message)
                report.error = message
            }
        }

        report.remaining = await queue.count
        return report
    }

    struct BatchResult { var done: Set<String> = []; var applied = 0; var conflicts: [ScriptConflict] = [] }

    func applyOps(_ ops: [QueuedOp], to key: SyncKey) async throws -> BatchResult {
        var lastError: Error = APIError.offline
        for _ in 0..<3 {
            let envelope = try await backend.readSync(key)
            var blob = envelope.data ?? .null
            var result = BatchResult()
            var changed = false

            for q in ops {
                switch OpApplier.apply(q.op, to: &blob) {
                case .applied: changed = true; result.applied += 1; result.done.insert(q.id)
                case .noChange, .missingTarget: result.done.insert(q.id)
                case .conflict(let remote):
                    result.done.insert(q.id)
                    if case .setCardScript(let cardId, _, let newText, let at) = q.op {
                        result.conflicts.append(ScriptConflict(id: q.id, cardId: cardId, localText: newText, remoteText: remote, at: at))
                    }
                }
            }
            guard changed else { return result }
            do {
                _ = try await backend.writeSync(key, data: blob, baseUpdatedAt: envelope.updatedAt)
                return result
            } catch APIError.conflict {
                lastError = APIError.conflict(nil) // blob moved on: re-read and re-apply
                continue
            }
        }
        throw lastError
    }
}
