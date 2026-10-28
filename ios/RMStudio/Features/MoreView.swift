import SwiftUI
import RMStudioKit

struct MoreView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        NavigationStack(path: model.pathBinding(.more)) {
            List {
                Section {
                    NavigationLink(value: Route.tasks) { Label("Tasks", systemImage: "checkmark.circle") }
                    NavigationLink(value: Route.contacts) { Label("Contacts", systemImage: "person.2") }
                }
                Section {
                    NavigationLink(value: Route.settings) { Label("Settings & sync", systemImage: "gearshape") }
                }
            }
            .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
            .navigationTitle("More")
            .navigationDestination(for: Route.self) { RouteView(route: $0) }
        }
    }
}

struct TasksView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        let todos = model.workspace.todoList
        List {
            if todos.isEmpty { EmptyState(icon: "checkmark.circle", title: "No tasks", message: model.errors["Tasks"] ?? "Add one from the + menu.", actionTitle: "Add task", action: { model.activeSheet = .newTask }).listRowBackground(Color.clear) }
            Section("Open") { ForEach(todos.filter { !$0.completed }) { TodoRow(todo: $0) } }
            Section("Done") { ForEach(todos.filter { $0.completed }) { TodoRow(todo: $0) } }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
        .navigationTitle("Tasks")
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { model.activeSheet = .newTask } label: { Image(systemName: "plus") }.accessibilityLabel("Add task") } }
        .refreshable { await model.refresh() }
    }
}

struct ContactsView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    var body: some View {
        let all = Contacts.derive(from: model.workspace.deliverables)
        let list = query.isEmpty ? all : all.filter { $0.name.localizedCaseInsensitiveContains(query) || $0.company.localizedCaseInsensitiveContains(query) }
        List {
            if list.isEmpty { EmptyState(icon: "person.2", title: "No contacts", message: "Contacts are the points of contact on your deliverables. There is no separate contact database.").listRowBackground(Color.clear) }
            ForEach(list) { c in
                NavigationLink(value: Route.contact(c.id)) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(c.name).font(.headline)
                        Text("\(c.company.isEmpty ? "—" : c.company) · \(c.rowIds.count) project\(c.rowIds.count == 1 ? "" : "s")").font(.footnote).foregroundStyle(RM.inkSecondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
        .searchable(text: $query, prompt: "Name or company")
        .navigationTitle("Contacts")
    }
}

struct ContactDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    let contactId: String
    var body: some View {
        let contact = Contacts.derive(from: model.workspace.deliverables).first { $0.id == contactId }
        if let c = contact {
            List {
                Section { VStack(alignment: .leading, spacing: 4) {
                    Text(c.name).font(RM.display(28))
                    if !c.company.isEmpty { Text(c.company).foregroundStyle(RM.inkSecondary) }
                }.listRowBackground(Color.clear) }
                if c.email != nil || c.phone != nil {
                    Section("Reach out") {
                        if let e = c.email, let u = URL(string: "mailto:\(e)") { Button { openURL(u) } label: { Label(e, systemImage: "envelope") } }
                        if let p = c.phone, let u = URL(string: "tel:\(p.filter { $0.isNumber || $0 == "+" })") { Button { openURL(u) } label: { Label(p, systemImage: "phone") } }
                    }
                }
                let projects = model.workspace.deliverables.filter { row in c.rowIds.contains(row.id) }
                Section("Projects") {
                    ForEach(projects) { r in
                        Button { model.open(.production, .deliverable(r.id)) } label: {
                            HStack { Text(r.brand); Spacer(); StatusPill(text: r.overallStatus.title, tint: r.overallStatus.tint) }
                        }.foregroundStyle(RM.ink)
                    }
                }
            }
            .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
            .navigationBarTitleDisplayMode(.inline)
        } else {
            EmptyState(icon: "person.crop.circle.badge.questionmark", title: "Contact not found", message: "It may no longer appear on any deliverable.")
        }
    }
}

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false

    var body: some View {
        @Bindable var model = model
        List {
            Section("Account") {
                LabeledContent("Name", value: model.user?.name ?? "")
                LabeledContent("Email", value: model.user?.email ?? "")
                LabeledContent("Role", value: model.user?.role.capitalized ?? "")
            }
            Section("Sync") {
                LabeledContent("Status") { SyncBadge() }
                LabeledContent("Waiting to sync", value: "\(model.pendingCount)")
                if let at = model.workspace.refreshedAt { LabeledContent("Last full refresh", value: at.formatted(.relative(presentation: .named))) }
                LabeledContent("Server", value: model.baseURL.host() ?? "")
                Button("Sync now") { model.syncNow() }
                ForEach(model.errors.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                    VStack(alignment: .leading) { Text(k).font(.subheadline.weight(.semibold)); Text(v).font(.footnote).foregroundStyle(RM.alert) }
                }
            }
            Section {
                Toggle("Go-live reminders", isOn: $model.goLiveRemindersOn)
                Toggle("Payment follow-ups", isOn: $model.paymentRemindersOn)
            } header: { Text("Notifications") } footer: {
                Text("Reminders are scheduled on this device from your latest synced data: 9:00 on go-live day and 18:00 the evening before. Server push needs APNs credentials (see README).")
            }
            Section {
                Button("Sign out", role: .destructive) { confirmSignOut = true }
            } footer: { Text("Signing out removes cached data from this device. Edits not yet synced will be lost.") }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
        .navigationTitle("Settings")
        .confirmationDialog(model.pendingCount > 0 ? "\(model.pendingCount) unsynced change(s) will be lost." : "Sign out of RM Studio?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { model.signOut() }
        }
    }
}
