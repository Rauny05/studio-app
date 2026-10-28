import SwiftUI
import RMStudioKit

struct CompletionTarget: Identifiable {
    let row: DeliverableRow
    let item: DeliverableItem
    var id: String { row.id + "|" + item.stableKey }
}

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var completion: CompletionTarget?

    var body: some View {
        NavigationStack(path: model.pathBinding(.home)) {
            ScrollView {
                VStack(alignment: .leading, spacing: RM.Space.xl) {
                    header
                    if !model.errors.isEmpty { errorBanner }
                    attentionSection
                    todaySection
                    overviewSection
                }
                .padding(.horizontal, RM.Space.l)
                .padding(.bottom, RM.Space.xxl)
                .frame(maxWidth: 820)
                .frame(maxWidth: .infinity)
            }
            .rmScreen()
            .refreshable { await model.refresh() }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { SyncBadge() }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { model.showSearch = true } label: { Image(systemName: "magnifyingglass") }
                        .accessibilityLabel("Search workspace")
                        .keyboardShortcut("k", modifiers: .command)
                    QuickActionsMenu()
                }
            }
            .navigationDestination(for: Route.self) { RouteView(route: $0) }
            .sheet(item: $completion) { CompletionSheet(row: $0.row, item: $0.item) }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide))).font(.subheadline).foregroundStyle(RM.inkSecondary)
            Text("Today").font(RM.display(40))
        }
        .padding(.top, RM.Space.s)
    }

    private var errorBanner: some View {
        RMCard {
            VStack(alignment: .leading, spacing: 4) {
                Label("Some data couldn't refresh", systemImage: "exclamationmark.triangle").font(.subheadline.weight(.semibold)).foregroundStyle(RM.caution)
                ForEach(model.errors.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                    Text("\(k): \(v)").font(.footnote).foregroundStyle(RM.inkSecondary)
                }
                Button("Retry") { Task { await model.refresh() } }.font(.footnote.weight(.semibold))
            }
        }
    }

    // MARK: Needs attention

    private var attentionSection: some View {
        let items = Insights.attention(model.workspace)
        return VStack(alignment: .leading, spacing: RM.Space.m) {
            SectionHeader(title: "Needs attention", trailing: items.isEmpty ? nil : "\(items.count)")
            if items.isEmpty {
                RMCard { Label("Nothing is late or waiting on you.", systemImage: "checkmark.circle").foregroundStyle(RM.inkSecondary) }
            } else {
                RMCard(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(items.prefix(8).enumerated()), id: \.element.id) { idx, item in
                            Button { openAttention(item) } label: { AttentionRow(item: item) }
                                .buttonStyle(.plain)
                            if idx < min(items.count, 8) - 1 { Divider().overlay(RM.hairline).padding(.leading, 44) }
                        }
                    }
                }
            }
        }
    }

    private func openAttention(_ item: AttentionItem) {
        if let id = item.rowId { model.open(.production, .deliverable(id)) }
        else if let id = item.scriptId { model.open(.scripts, .inboxScript(id)) }
    }

    // MARK: Today

    private var todaySection: some View {
        let live = Insights.goLivesToday(model.workspace)
        let todos = model.workspace.todoList.filter { !$0.completed }.prefix(5)
        return VStack(alignment: .leading, spacing: RM.Space.m) {
            SectionHeader(title: "Today's work")
            if live.isEmpty && todos.isEmpty {
                RMCard { Label("No go-lives or open tasks today.", systemImage: "sun.max").foregroundStyle(RM.inkSecondary) }
            }
            ForEach(live) { row in
                RMCard {
                    VStack(alignment: .leading, spacing: RM.Space.s) {
                        HStack {
                            Text(row.brand).font(.headline)
                            Spacer()
                            StatusPill(text: "Live today", tint: RM.accent)
                        }
                        ForEach(row.deliverables.filter { $0.status == .pending }, id: \.stableKey) { item in
                            HStack {
                                Text(item.label).font(.subheadline)
                                Spacer()
                                Button("Complete") { completion = CompletionTarget(row: row, item: item) }
                                    .buttonStyle(.bordered).controlSize(.small)
                                    .accessibilityLabel("Complete \(item.label)")
                            }
                        }
                    }
                }
                .onTapGesture { model.open(.production, .deliverable(row.id)) }
            }
            if !todos.isEmpty {
                RMCard(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(todos)) { todo in
                            TodoRow(todo: todo).padding(.horizontal, RM.Space.l).padding(.vertical, RM.Space.s)
                            if todo.id != todos.last?.id { Divider().overlay(RM.hairline) }
                        }
                    }
                }
            }
        }
    }

    // MARK: Overview

    private var overviewSection: some View {
        let o = Insights.overview(model.workspace)
        return VStack(alignment: .leading, spacing: RM.Space.m) {
            SectionHeader(title: "Studio overview", trailing: model.workspace.refreshedAt.map { "Updated " + $0.formatted(.relative(presentation: .named)) })
            RMCard {
                Grid(horizontalSpacing: RM.Space.l, verticalSpacing: RM.Space.l) {
                    GridRow { MetricTile(value: o.activeProjects, label: "Active projects"); MetricTile(value: o.upcomingGoLives, label: "Go-live in 7 days", tint: RM.accent); MetricTile(value: o.openTodos, label: "Open tasks") }
                    GridRow { MetricTile(value: o.pendingItems, label: "Pending deliverables", tint: RM.caution); MetricTile(value: o.completedItems, label: "Completed", tint: RM.positive); MetricTile(value: o.awaitingPayment, label: "Awaiting payment", tint: RM.info) }
                }
            }
        }
    }
}

struct AttentionRow: View {
    let item: AttentionItem
    var body: some View {
        HStack(spacing: RM.Space.m) {
            Image(systemName: icon).foregroundStyle(tint).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title).font(.subheadline.weight(.semibold)).foregroundStyle(RM.ink)
                Text(item.detail).font(.footnote).foregroundStyle(RM.inkSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.footnote).foregroundStyle(RM.inkSecondary)
        }
        .padding(.horizontal, RM.Space.l).padding(.vertical, RM.Space.m)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
    private var icon: String {
        switch item.kind {
        case .overdueGoLive: "exclamationmark.circle.fill"
        case .goLiveToday: "bolt.fill"
        case .goLiveSoon: "clock"
        case .awaitingPayment: "indianrupeesign.circle"
        case .scriptReview: "doc.text.magnifyingglass"
        }
    }
    private var tint: Color {
        switch item.kind {
        case .overdueGoLive: RM.alert
        case .goLiveToday: RM.accent
        case .goLiveSoon: RM.caution
        case .awaitingPayment: RM.info
        case .scriptReview: RM.inkSecondary
        }
    }
}

struct QuickActionsMenu: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Menu {
            Button { model.activeSheet = .newScript } label: { Label("New script", systemImage: "text.badge.plus") }
            Button { model.activeSheet = .newCard } label: { Label("Start production", systemImage: "film") }
            Button { model.activeSheet = .newDeliverable } label: { Label("New deliverable", systemImage: "checklist") }
            Button { model.activeSheet = .newTask } label: { Label("Add task", systemImage: "checkmark.circle") }
            Button { model.activeSheet = .recordPayment } label: { Label("Record payment", systemImage: "indianrupeesign.circle") }
            Button { model.activeSheet = .newCash } label: { Label("Add cash entry", systemImage: "banknote") }
        } label: {
            Image(systemName: "plus.circle.fill").font(.title3)
        }
        .accessibilityLabel("Quick actions")
    }
}

struct TodoRow: View {
    @Environment(AppModel.self) private var model
    let todo: Todo
    var body: some View {
        HStack(spacing: RM.Space.m) {
            Button {
                Haptics.tap()
                model.perform(.setTodoCompleted(todoId: todo.id, completed: !todo.completed, at: RecordFactory.iso()))
            } label: {
                Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                    .font(.title3).foregroundStyle(todo.completed ? RM.positive : RM.inkSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(todo.completed ? "Mark \(todo.title) not done" : "Mark \(todo.title) done")
            Text(todo.title).strikethrough(todo.completed).foregroundStyle(todo.completed ? RM.inkSecondary : RM.ink)
            Spacer()
            if let link = todo.link, let url = URL(string: link) { Link(destination: url) { Image(systemName: "arrow.up.right") } }
        }
    }
}
