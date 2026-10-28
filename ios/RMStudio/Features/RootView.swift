import SwiftUI
import RMStudioKit

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.isSignedIn { MainTabs() } else { SignInView() }
        }
        .animation(.snappy, value: model.isSignedIn)
        .overlay(alignment: .bottom) { ToastHost() }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            Tab("Home", systemImage: "square.grid.2x2", value: AppTab.home) { HomeView() }
            Tab("Production", systemImage: "film.stack", value: AppTab.production) { ProductionView() }
            Tab("Scripts", systemImage: "text.alignleft", value: AppTab.scripts) { ScriptsView() }
            Tab("Finance", systemImage: "indianrupeesign.circle", value: AppTab.finance) { FinanceView() }
            Tab("More", systemImage: "ellipsis.circle", value: AppTab.more) { MoreView() }
        }
        .tabViewStyle(.sidebarAdaptable) // sidebar on iPad, tab bar on iPhone
        .sheet(isPresented: $model.showSearch) { SearchView() }
        .sheet(item: $model.activeSheet) { QuickActionSheet(action: $0) }
    }
}

struct ToastHost: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let toast = model.toast {
            HStack(spacing: RM.Space.m) {
                Text(toast.message).font(.subheadline).foregroundStyle(RM.ink)
                if let undo = toast.undoOp {
                    Button("Undo") { model.perform(undo); model.toast = nil }.font(.subheadline.weight(.semibold))
                }
            }
            .padding(.horizontal, RM.Space.l).padding(.vertical, RM.Space.m)
            .background(.regularMaterial, in: Capsule())
            .overlay(Capsule().stroke(RM.hairline))
            .padding(.bottom, 90)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: toast.id) {
                try? await Task.sleep(for: .seconds(4))
                if model.toast?.id == toast.id { withAnimation { model.toast = nil } }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// Navigation destinations shared by every tab.
struct RouteView: View {
    let route: Route
    var body: some View {
        switch route {
        case .deliverable(let id): DeliverableDetailView(rowId: id)
        case .board(let id): BoardView(boardId: id)
        case .card(let id): CardDetailView(cardId: id)
        case .script(let id): ScriptEditorView(cardId: id)
        case .inboxScript(let id): InboxScriptDetailView(scriptId: id)
        case .contact(let id): ContactDetailView(contactId: id)
        case .tasks: TasksView()
        case .contacts: ContactsView()
        case .settings: SettingsView()
        }
    }
}

struct SyncBadge: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let (text, icon, tint) = state
        Label(text, systemImage: icon)
            .font(.caption.weight(.medium))
            .foregroundStyle(tint)
            .labelStyle(.titleAndIcon)
            .accessibilityElement(children: .combine)
    }

    private var state: (String, String, Color) {
        if !model.isOnline {
            return (model.pendingCount > 0 ? "Offline · \(model.pendingCount) saved on device" : "Offline", "icloud.slash", RM.caution)
        }
        if model.pendingCount > 0 { return ("\(model.pendingCount) waiting to sync", "arrow.triangle.2.circlepath", RM.caution) }
        if model.isRefreshing { return ("Syncing…", "arrow.triangle.2.circlepath", RM.inkSecondary) }
        if !model.errors.isEmpty { return ("Some data couldn't refresh", "exclamationmark.triangle", RM.alert) }
        return ("Synced", "checkmark.icloud", RM.positive)
    }
}
