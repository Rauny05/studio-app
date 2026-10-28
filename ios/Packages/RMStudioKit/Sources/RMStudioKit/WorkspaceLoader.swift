import Foundation

public struct RefreshResult: Sendable {
    public var workspace: Workspace
    /// Per-source failures; sources that failed keep their previously cached data.
    public var errors: [String: String]
    public var unauthorized: Bool
}

public enum WorkspaceLoader {
    public static func refresh(backend: Backend, current: Workspace, isAdmin: Bool) async -> RefreshResult {
        async let sheet = capture { try await backend.sheetDeliverables() }
        async let overrides = capture { try await backend.readSync(.deliverableOverrides) }
        async let localRows = capture { try await backend.readSync(.deliverableLocalRows) }
        async let hidden = capture { try await backend.readSync(.deliverableHidden) }
        async let kanban = capture { try await backend.readSync(.kanban) }
        async let todos = capture { try await backend.readSync(.todos) }
        async let cash = capture { try await backend.readSync(.cash) }
        async let scripts = capture { try await backend.scripts() }

        var ws = current
        var errors: [String: String] = [:]
        var unauthorized = false

        func note(_ name: String, _ error: Error) {
            if let api = error as? APIError {
                if api == .unauthorized { unauthorized = true }
                errors[name] = api.errorDescription ?? "failed"
            } else { errors[name] = error.localizedDescription }
        }

        let sheetResult = await sheet
        switch sheetResult {
        case .success(let rows): ws.sheetRows = rows
        case .failure(let e): note("Deliverables sheet", e)
        }
        let overridesResult = await overrides
        switch overridesResult {
        case .success(let env):
            var map: [String: DeliverableRow] = [:]
            if let obj = env.data?.objectValue {
                let inner = obj["overrides"]?.objectValue ?? obj
                for (k, v) in inner { if let row = try? v.decode(DeliverableRow.self) { map[k] = row } }
            }
            ws.overrides = map
            ws.versions[SyncKey.deliverableOverrides.rawValue] = env.updatedAt ?? ""
        case .failure(let e): note("Deliverable state", e)
        }
        let localRowsResult = await localRows
        switch localRowsResult {
        case .success(let env):
            ws.localRows = (try? env.data?.decode([DeliverableRow].self)) ?? []
        case .failure(let e): note("Local deliverables", e)
        }
        let hiddenResult = await hidden
        switch hiddenResult {
        case .success(let env): ws.hiddenIds = (try? env.data?.decode([String].self)) ?? []
        case .failure(let e): note("Hidden deliverables", e)
        }
        let kanbanResult = await kanban
        switch kanbanResult {
        case .success(let env): ws.kanban = env.data; ws.versions[SyncKey.kanban.rawValue] = env.updatedAt ?? ""
        case .failure(let e): note("Production boards", e)
        }
        let todosResult = await todos
        switch todosResult {
        case .success(let env): ws.todos = env.data; ws.versions[SyncKey.todos.rawValue] = env.updatedAt ?? ""
        case .failure(let e): note("Tasks", e)
        }
        let cashResult = await cash
        switch cashResult {
        case .success(let env): ws.cash = env.data; ws.versions[SyncKey.cash.rawValue] = env.updatedAt ?? ""
        case .failure(let e): note("Cash book", e)
        }
        let scriptsResult = await scripts
        switch scriptsResult {
        case .success(let list): ws.scripts = list
        case .failure(let e): note("Scripts", e)
        }

        if errors.isEmpty { ws.refreshedAt = Date() }
        return RefreshResult(workspace: ws, errors: errors, unauthorized: unauthorized)
    }

    private static func capture<T: Sendable>(_ work: @escaping @Sendable () async throws -> T) async -> Result<T, Error> {
        do { return .success(try await work()) } catch { return .failure(error) }
    }
}
