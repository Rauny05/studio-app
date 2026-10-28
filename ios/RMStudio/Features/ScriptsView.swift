import SwiftUI
import UniformTypeIdentifiers
import RMStudioKit

struct ScriptsView: View {
    @Environment(AppModel.self) private var model
    enum Mode: String, CaseIterable { case library = "Library", inbox = "Inbox" }
    @State private var mode: Mode = .library

    var body: some View {
        NavigationStack(path: model.pathBinding(.scripts)) {
            VStack(spacing: 0) {
                Picker("Scripts", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { m in
                        let pending = m == .inbox ? model.workspace.scripts.filter { $0.status == .pending }.count : 0
                        Text(pending > 0 ? "\(m.rawValue) \(pending)" : m.rawValue).tag(m)
                    }
                }
                .pickerStyle(.segmented).padding(.horizontal, RM.Space.l).padding(.bottom, RM.Space.s)
                switch mode {
                case .library: ScriptLibrary()
                case .inbox: ScriptInbox()
                }
            }
            .rmScreen()
            .navigationTitle("Scripts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { model.activeSheet = .newScript } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("New script")
                        .keyboardShortcut("n", modifiers: .command)
                }
            }
            .navigationDestination(for: Route.self) { RouteView(route: $0) }
        }
    }
}

// MARK: - Library (production cards that carry script text)

struct ScriptLibrary: View {
    @Environment(AppModel.self) private var model
    enum Sort: String, CaseIterable { case recent = "Recently edited", created = "Newest", title = "Title", length = "Longest" }
    enum Scope: String, CaseIterable { case withText = "Has script", all = "All cards" }
    @State private var query = ""
    @State private var sort: Sort = .recent
    @State private var scope: Scope = .withText
    @State private var boardFilter: String?

    private var cards: [KanbanCard] {
        guard let data = model.workspace.kanbanData else { return [] }
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        var list = Array(data.cards.values)
        if scope == .withText { list = list.filter { !$0.description.isEmpty } }
        if let b = boardFilter { list = list.filter { $0.boardId == b } }
        if !q.isEmpty { list = list.filter { $0.title.lowercased().contains(q) || $0.description.lowercased().contains(q) } }
        switch sort {
        case .recent: list.sort { $0.updatedAt > $1.updatedAt }
        case .created: list.sort { $0.createdAt > $1.createdAt }
        case .title: list.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .length: list.sort { $0.description.count > $1.description.count }
        }
        return list
    }

    var body: some View {
        let data = model.workspace.kanbanData
        List {
            if cards.isEmpty {
                EmptyState(icon: "text.alignleft", title: query.isEmpty ? "No scripts yet" : "No matches",
                           message: query.isEmpty ? (model.errors["Production boards"] ?? "Write your first script. It's saved to a production card.") : "Try a different word.",
                           actionTitle: query.isEmpty ? "New script" : nil, action: { model.activeSheet = .newScript })
                    .listRowBackground(Color.clear)
            }
            ForEach(cards) { card in
                NavigationLink(value: Route.script(card.id)) { ScriptRow(card: card, boardTitle: data?.boards.first { $0.id == card.boardId }?.title) }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .searchable(text: $query, prompt: "Search titles and script text")
        .refreshable { await model.refresh() }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Picker("Sort", selection: $sort) { ForEach(Sort.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                    Picker("Show", selection: $scope) { ForEach(Scope.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                    Picker("Board", selection: $boardFilter) {
                        Text("All boards").tag(String?.none)
                        ForEach(data?.boards ?? []) { Text($0.title).tag(Optional($0.id)) }
                    }
                } label: { Image(systemName: "line.3.horizontal.decrease.circle") }
                .accessibilityLabel("Sort and filter")
            }
        }
    }
}

struct ScriptRow: View {
    @Environment(AppModel.self) private var model
    let card: KanbanCard
    let boardTitle: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(card.title).font(.headline).lineLimit(1)
                Spacer()
                switch model.scriptState(card.id) {
                case .pending: Image(systemName: "arrow.triangle.2.circlepath").foregroundStyle(RM.caution).accessibilityLabel("Waiting to sync")
                case .conflict: Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(RM.alert).accessibilityLabel("Conflict")
                case .synced: EmptyView()
                }
            }
            if !card.description.isEmpty {
                Text(card.description.replacingOccurrences(of: "\n", with: " ")).font(.subheadline).foregroundStyle(RM.inkSecondary).lineLimit(2)
            }
            HStack(spacing: RM.Space.s) {
                if let boardTitle { Text(boardTitle) }
                Text("\(ScriptStats.words(card.description)) words")
                if let d = Date.fromISO(card.updatedAt) { Text(d.formatted(.relative(presentation: .named))) }
            }.font(.footnote).foregroundStyle(RM.inkSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Editor

struct ScriptEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.undoManager) private var undoManager
    @Environment(\.scenePhase) private var scenePhase
    let cardId: String

    @State private var text = ""
    @State private var base = ""
    @State private var loaded = false
    @State private var showFind = false
    @State private var renaming = false
    @State private var newTitle = ""
    @State private var commitTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    var body: some View {
        Group {
            if let card = model.card(cardId) { editor(card) }
            else { EmptyState(icon: "questionmark.folder", title: "Script not found", message: "It may have been removed on another device.") }
        }
        .rmScreen()
    }

    private func editor(_ card: KanbanCard) -> some View {
        VStack(spacing: 0) {
            if let conflict = model.conflicts.first(where: { $0.cardId == cardId }) { ConflictBanner(conflict: conflict) }
            TextEditor(text: $text)
                .font(.system(.body, design: .serif))
                .lineSpacing(5)
                .padding(.horizontal, RM.Space.m)
                .focused($focused)
                .scrollContentBackground(.hidden)
                .findNavigator(isPresented: $showFind)
                .accessibilityLabel("Script text")
            statusBar
        }
        .navigationTitle(card.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar(card) }
        .onAppear { load(card) }
        .onChange(of: text) { _, new in
            guard loaded else { return }
            model.saveDraft(cardId: cardId, base: base, text: new)
            commitTask?.cancel()
            commitTask = Task {
                try? await Task.sleep(for: .seconds(1.2))
                if !Task.isCancelled { model.commitScript(cardId: cardId, base: base, text: new) }
            }
        }
        .onDisappear { commitTask?.cancel(); if loaded { model.commitScript(cardId: cardId, base: base, text: text) } }
        .onChange(of: scenePhase) { _, p in if p != .active, loaded { model.commitScript(cardId: cardId, base: base, text: text) } }
        .onChange(of: card.description) { _, remote in
            // Server text arrived while we're not editing a divergent version: follow it.
            if loaded, !model.pendingScriptCards.contains(cardId), remote != text, !focused { text = remote; base = remote }
        }
        .alert("Rename script", isPresented: $renaming) {
            TextField("Title", text: $newTitle)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                let t = newTitle.trimmingCharacters(in: .whitespaces)
                if !t.isEmpty { model.perform(.setCardTitle(cardId: cardId, title: t, at: RecordFactory.iso())) }
            }
        }
    }

    private func load(_ card: KanbanCard) {
        guard !loaded else { return }
        base = card.description
        // Recover unsynced typing from a crash/kill before the last commit.
        if let d = model.draft(cardId: cardId), d.text != card.description { text = d.text; base = d.baseText }
        else { text = card.description }
        loaded = true
    }

    private var statusBar: some View {
        HStack(spacing: RM.Space.m) {
            switch model.scriptState(cardId) {
            case .synced: Label(text == (model.card(cardId)?.description ?? "") ? "Synced" : "Saving on device…", systemImage: "checkmark.icloud").foregroundStyle(RM.positive)
            case .pending: Label(model.isOnline ? "Saved on device · syncing" : "Saved on device · offline", systemImage: "internaldrive").foregroundStyle(RM.caution)
            case .conflict: Label("Conflict", systemImage: "exclamationmark.triangle.fill").foregroundStyle(RM.alert)
            }
            Spacer()
            Text("\(ScriptStats.words(text)) words · \(text.count) chars").foregroundStyle(RM.inkSecondary).monospacedDigit()
        }
        .font(.footnote)
        .padding(.horizontal, RM.Space.l).padding(.vertical, RM.Space.s)
        .background(.bar)
        .accessibilityElement(children: .combine)
    }

    @ToolbarContentBuilder private func toolbar(_ card: KanbanCard) -> some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { undoManager?.undo() } label: { Image(systemName: "arrow.uturn.backward") }
                .disabled(!(undoManager?.canUndo ?? false)).accessibilityLabel("Undo")
            Button { undoManager?.redo() } label: { Image(systemName: "arrow.uturn.forward") }
                .disabled(!(undoManager?.canRedo ?? false)).accessibilityLabel("Redo")
            Menu {
                Button { showFind = true } label: { Label("Find in script", systemImage: "magnifyingglass") }
                    .keyboardShortcut("f", modifiers: .command)
                Button { newTitle = card.title; renaming = true } label: { Label("Rename", systemImage: "pencil") }
                Button { duplicate(card) } label: { Label("Duplicate", systemImage: "plus.square.on.square") }
                Menu {
                    ForEach(ScriptTemplate.all) { t in
                        Button(t.name) { text += (text.isEmpty ? "" : "\n\n") + t.content }
                    }
                } label: { Label("Insert template", systemImage: "doc.badge.plus") }
                ShareLink(item: ScriptExport(title: card.title, body: text),
                          preview: SharePreview(card.title)) { Label("Export as Markdown", systemImage: "square.and.arrow.up") }
                Button { model.open(.production, .card(cardId)) } label: { Label("Open production card", systemImage: "film") }
            } label: { Image(systemName: "ellipsis.circle") }
        }
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("Done") { focused = false }
        }
    }

    private func duplicate(_ card: KanbanCard) {
        let copy = RecordFactory.card(boardId: card.boardId, columnId: card.columnId, title: card.title + " copy",
                                      script: text, deliverableType: card.deliverableType)
        model.perform(.addCard(card: copy), toast: "Duplicated")
    }
}

/// Exports a script as a .md file, written only when the user actually shares.
struct ScriptExport: Transferable {
    let title: String
    let body: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .plainText) { item in
            let safe = item.title.replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe).md")
            try ("# \(item.title)\n\n" + item.body).write(to: url, atomically: true, encoding: .utf8)
            return SentTransferredFile(url)
        }
    }
}

struct ConflictBanner: View {
    @Environment(AppModel.self) private var model
    let conflict: ScriptConflict
    @State private var showCompare = false
    var body: some View {
        VStack(alignment: .leading, spacing: RM.Space.s) {
            Label("This script changed on another device", systemImage: "exclamationmark.triangle.fill").font(.subheadline.weight(.semibold)).foregroundStyle(RM.alert)
            Text("Your offline edit was not applied, so nothing was overwritten.").font(.footnote).foregroundStyle(RM.inkSecondary)
            HStack {
                Button("Keep mine") { model.resolveConflictKeepingMine(conflict) }.buttonStyle(.borderedProminent)
                Button("Keep theirs") { model.resolveConflictKeepingTheirs(conflict) }.buttonStyle(.bordered)
                Button("Compare") { showCompare = true }.buttonStyle(.bordered)
            }.controlSize(.small)
        }
        .padding(RM.Space.l).frame(maxWidth: .infinity, alignment: .leading).background(RM.alert.opacity(0.1))
        .sheet(isPresented: $showCompare) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: RM.Space.l) {
                        Text("Yours (offline)").font(.headline); Text(conflict.localText).textSelection(.enabled)
                        Divider()
                        Text("On the server").font(.headline); Text(conflict.remoteText).textSelection(.enabled)
                    }.padding()
                }
                .navigationTitle("Compare").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showCompare = false } } }
            }
        }
    }
}

// MARK: - Inbox (Gmail-ingested Google Doc scripts awaiting approval)

struct ScriptInbox: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""

    var body: some View {
        let list = model.workspace.scripts.filter {
            query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.senderName.localizedCaseInsensitiveContains(query)
        }
        List {
            if list.isEmpty {
                EmptyState(icon: "tray", title: "Inbox is empty", message: model.errors["Scripts"] ?? "Scripts emailed to the studio arrive here for approval.")
                    .listRowBackground(Color.clear)
            }
            ForEach(list) { s in
                NavigationLink(value: Route.inboxScript(s.id)) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(s.title).font(.headline); Spacer(); StatusPill(text: s.status == .approved ? "Approved" : "Pending", tint: s.status == .approved ? RM.positive : RM.caution) }
                        Text("\(s.senderName) · \(s.docs.count) doc\(s.docs.count == 1 ? "" : "s")").font(.footnote).foregroundStyle(RM.inkSecondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .searchable(text: $query, prompt: "Search inbox")
        .refreshable { await model.refresh() }
    }
}

struct InboxScriptDetailView: View {
    @Environment(AppModel.self) private var model
    let scriptId: String
    var body: some View {
        if let s = model.workspace.scripts.first(where: { $0.id == scriptId }) {
            List {
                Section { VStack(alignment: .leading, spacing: 4) {
                    Text(s.title).font(RM.display(26))
                    Text("From \(s.senderName.isEmpty ? s.senderEmail : s.senderName)").foregroundStyle(RM.inkSecondary)
                }.listRowBackground(Color.clear) }
                Section("Scripts") {
                    ForEach(s.docs) { doc in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(doc.name)
                                if let url = URL(string: doc.docUrl) { Link("Open in Google Docs", destination: url).font(.footnote) }
                            }
                            Spacer()
                            if model.isAdmin {
                                Button(doc.status == .approved ? "Approved" : "Approve") {
                                    Haptics.success()
                                    model.perform(.setScriptApproval(scriptId: s.id, docId: doc.id, approved: doc.status != .approved))
                                }
                                .buttonStyle(.bordered).tint(doc.status == .approved ? RM.positive : RM.accent).controlSize(.small)
                            } else {
                                StatusPill(text: doc.status == .approved ? "Approved" : "Pending", tint: doc.status == .approved ? RM.positive : RM.caution)
                            }
                        }
                    }
                }
                if !model.isAdmin { Section { Text("Only admins can approve scripts.").font(.footnote).foregroundStyle(RM.inkSecondary) } }
            }
            .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
            .navigationBarTitleDisplayMode(.inline)
        } else {
            EmptyState(icon: "questionmark.folder", title: "Script not found", message: "Pull to refresh the inbox.")
        }
    }
}
