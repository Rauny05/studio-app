import SwiftUI
import Network
import UserNotifications
import RMStudioKit

enum ScriptSyncState { case synced, pending, conflict }

struct Toast: Identifiable, Equatable {
    let id = UUID()
    let message: String
    var undoOp: PendingOp?
}

@MainActor @Observable
final class AppModel {
    // Session
    private(set) var user: AuthUser?
    var isSignedIn: Bool { user != nil }
    var isAdmin: Bool { user?.isAdmin ?? false }

    // Data
    private(set) var workspace = Workspace()
    private(set) var errors: [String: String] = [:]
    private(set) var isRefreshing = false
    private(set) var isOnline = true
    private(set) var pendingCount = 0
    private(set) var pendingScriptCards: Set<String> = []
    private(set) var conflicts: [ScriptConflict] = []
    var toast: Toast?

    // Navigation
    var selectedTab: AppTab = .home
    var paths: [AppTab: [Route]] = [:]
    var showSearch = false
    var activeSheet: QuickAction?

    // Preferences
    var goLiveRemindersOn: Bool { didSet { UserDefaults.standard.set(goLiveRemindersOn, forKey: "pref.golive"); rescheduleNotifications() } }
    var paymentRemindersOn: Bool { didSet { UserDefaults.standard.set(paymentRemindersOn, forKey: "pref.payments"); rescheduleNotifications() } }

    let baseURL: URL
    private let tokenBox: TokenBox
    private let disk: DiskStore
    private let queue: OfflineQueue
    @ObservationIgnored private var backend: Backend!
    @ObservationIgnored private var engine: SyncEngine!
    private let monitor = NWPathMonitor()
    @ObservationIgnored private var refreshTask: Task<Void, Never>?

    init() {
        let configured = Bundle.main.object(forInfoDictionaryKey: "RMStudioBaseURL") as? String
        baseURL = URL(string: configured ?? "") ?? URL(string: "https://rmmedia-studio.vercel.app")!
        let token = CommandLine.arguments.contains("-ui-testing-signed-out") ? nil : Keychain.get("token")
        tokenBox = TokenBox(token)
        disk = DiskStore(directory: DiskStore.defaultDirectory())
        queue = OfflineQueue(store: disk)
        let defaults = UserDefaults.standard
        goLiveRemindersOn = defaults.object(forKey: "pref.golive") as? Bool ?? true
        paymentRemindersOn = defaults.object(forKey: "pref.payments") as? Bool ?? true

        let box = tokenBox
        let client = APIClient(baseURL: baseURL, tokenProvider: { box.token },
                               onUnauthorized: { [weak self] in Task { @MainActor in self?.sessionExpired() } })
        backend = Backend(client: client)
        engine = SyncEngine(backend: backend, queue: queue)

        if let token, let claims = SessionClaims.decode(token: token), !claims.isExpired {
            user = AuthUser(name: claims.name, email: claims.email, role: claims.role)
            workspace = disk.load(Workspace.self, name: "workspace") ?? Workspace()
        } else if token != nil {
            Keychain.delete("token")
            tokenBox.token = nil
        }
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let wasOffline = !self.isOnline
                self.isOnline = path.status == .satisfied
                if wasOffline && self.isOnline { self.syncNow() }
            }
        }
        monitor.start(queue: DispatchQueue(label: "rm.network"))
    }

    // MARK: Auth

    func signIn(passcode: String, email: String) async throws {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        let response = try await backend.signIn(passcode: passcode, email: trimmed.isEmpty ? nil : trimmed)
        completeSignIn(token: response.token, user: response.user)
    }

    func signInWithGoogle() async throws {
        let url = try await backend.googleAuthURL()
        let token = try await WebAuthRunner.run(url: url, callbackScheme: "rmstudio")
        guard let claims = SessionClaims.decode(token: token) else { throw APIError.decoding("token") }
        completeSignIn(token: token, user: AuthUser(name: claims.name, email: claims.email, role: claims.role))
    }

    private func completeSignIn(token: String, user: AuthUser) {
        Keychain.set(token, for: "token")
        tokenBox.token = token
        self.user = user
        Task { await recoverDrafts(); await updatePending(); syncNow() }
        requestNotificationPermission()
    }

    func signOut() {
        Keychain.delete("token")
        tokenBox.token = nil
        user = nil
        workspace = Workspace()
        disk.removeAll()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        Task {
            let ids = Set(await queue.ops.map(\.id))
            await queue.remove(ids: ids)
            await updatePending()
        }
    }

    private func sessionExpired() {
        guard user != nil else { return }
        Keychain.delete("token")
        tokenBox.token = nil
        user = nil
        toast = Toast(message: "Session expired. Sign in again; unsynced edits are kept.")
    }

    // MARK: Sync

    func syncNow() {
        guard isSignedIn else { return }
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            guard let self else { return }
            _ = await self.engine.flush()
            await self.updatePending()
            await self.refresh()
        }
    }

    func refresh() async {
        guard isSignedIn, !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        let result = await WorkspaceLoader.refresh(backend: backend, current: workspace, isAdmin: isAdmin)
        var ws = result.workspace
        // Keep unsynced edits visible: replay the queue over fresh server data.
        for q in await queue.ops { ws.applyLocally(q.op) }
        workspace = ws
        errors = result.errors
        disk.save(ws, name: "workspace")
        await updatePending()
        rescheduleNotifications()
    }

    private func updatePending() async {
        let ops = await queue.ops
        pendingCount = ops.count
        pendingScriptCards = Set(ops.compactMap { q -> String? in
            if case .setCardScript(let id, _, _, _) = q.op { return id } else { return nil }
        })
        conflicts = await queue.conflicts
    }

    /// Records the intent locally first (optimistic + durable), then syncs.
    func perform(_ op: PendingOp, toast message: String? = nil) {
        workspace.applyLocally(op)
        disk.save(workspace, name: "workspace")
        if let message { toast = Toast(message: message) }
        Task {
            _ = await queue.enqueue(op)
            await updatePending()
            syncNow()
        }
    }

    // MARK: Scripts

    func card(_ id: String) -> KanbanCard? { workspace.kanbanData?.cards[id] }

    func scriptState(_ cardId: String) -> ScriptSyncState {
        if conflicts.contains(where: { $0.cardId == cardId }) { return .conflict }
        return pendingScriptCards.contains(cardId) ? .pending : .synced
    }

    func saveDraft(cardId: String, base: String, text: String) {
        disk.save(ScriptDraft(cardId: cardId, baseText: base, text: text, updatedAt: Date()), name: "draft-" + cardId)
    }

    func draft(cardId: String) -> ScriptDraft? { disk.load(ScriptDraft.self, name: "draft-" + cardId) }

    func commitScript(cardId: String, base: String, text: String) {
        guard let current = card(cardId), current.description != text else { return }
        perform(.setCardScript(cardId: cardId, baseText: base, newText: text, at: RecordFactory.iso()))
        disk.remove(name: "draft-" + cardId)
    }

    private func recoverDrafts() async {
        for name in disk.names(prefix: "draft-") {
            guard let d = disk.load(ScriptDraft.self, name: name) else { continue }
            if let c = card(d.cardId), c.description != d.text {
                workspace.applyLocally(.setCardScript(cardId: d.cardId, baseText: d.baseText, newText: d.text, at: RecordFactory.iso()))
                _ = await queue.enqueue(.setCardScript(cardId: d.cardId, baseText: d.baseText, newText: d.text, at: RecordFactory.iso()))
            }
            disk.remove(name: name)
        }
    }

    func resolveConflictKeepingMine(_ c: ScriptConflict) {
        Task {
            await queue.resolveConflict(cardId: c.cardId)
            // Re-base on what the server has now, so this edit wins deliberately.
            perform(.setCardScript(cardId: c.cardId, baseText: c.remoteText, newText: c.localText, at: RecordFactory.iso()))
        }
    }

    func resolveConflictKeepingTheirs(_ c: ScriptConflict) {
        Task {
            await queue.resolveConflict(cardId: c.cardId)
            workspace.applyLocally(.setCardScript(cardId: c.cardId, baseText: c.localText, newText: c.remoteText, at: RecordFactory.iso()))
            await updatePending()
            await refresh()
        }
    }

    // MARK: Navigation

    func open(_ tab: AppTab, _ route: Route?) {
        selectedTab = tab
        showSearch = false
        if let route { paths[tab, default: []].append(route) }
    }

    func handle(url: URL) {
        guard let (tab, route) = DeepLink.parse(url) else { return }
        open(tab, route)
    }

    func pathBinding(_ tab: AppTab) -> Binding<[Route]> {
        Binding(get: { self.paths[tab] ?? [] }, set: { self.paths[tab] = $0 })
    }

    // MARK: Push + notifications

    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted { Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() } }
        }
    }

    func registerPushToken(_ data: Data) {
        let hex = data.map { String(format: "%02x", $0) }.joined()
        #if DEBUG
        let production = false
        #else
        let production = true
        #endif
        Task { try? await backend.registerAPNs(token: hex, production: production) }
    }

    func rescheduleNotifications() {
        NotificationScheduler.reschedule(workspace: workspace, goLive: goLiveRemindersOn, payments: paymentRemindersOn)
    }
}

enum QuickAction: String, Identifiable {
    case newScript, newCard, newDeliverable, newTask, recordPayment, newCash
    var id: String { rawValue }
}
