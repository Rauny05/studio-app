import SwiftUI
import RMStudioKit

struct BoardsList: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let data = model.workspace.kanbanData
        List {
            if data?.boards.isEmpty ?? true {
                EmptyState(icon: "rectangle.3.group", title: "No production boards",
                           message: model.errors["Production boards"] ?? "Boards created in the web app appear here.")
                    .listRowBackground(Color.clear)
            }
            ForEach(data?.boards ?? []) { board in
                NavigationLink(value: Route.board(board.id)) {
                    HStack(spacing: RM.Space.m) {
                        RoundedRectangle(cornerRadius: 6).fill(Color(hexString: board.color)).frame(width: 6, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(board.emoji) \(board.title)".trimmingCharacters(in: .whitespaces)).font(.headline)
                            let count = data?.cards.values.filter { $0.boardId == board.id }.count ?? 0
                            Text("\(count) card\(count == 1 ? "" : "s") · \(board.columnIds.count) stages").font(.footnote).foregroundStyle(RM.inkSecondary)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await model.refresh() }
    }
}

struct BoardView: View {
    @Environment(AppModel.self) private var model
    let boardId: String
    @State private var selectedColumn: String?

    var body: some View {
        if let data = model.workspace.kanbanData, let board = data.boards.first(where: { $0.id == boardId }) {
            let columns = board.columnIds.compactMap { data.columns[$0] }
            let active = selectedColumn ?? columns.first?.id
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(columns) { col in
                            Button { withAnimation(.snappy) { selectedColumn = col.id } } label: {
                                Text("\(col.title) \(col.cardIds.count)")
                                    .font(.subheadline.weight(.medium)).padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(active == col.id ? Color(hexString: board.color) : RM.surface, in: Capsule())
                                    .foregroundStyle(active == col.id ? Color.white : RM.ink)
                            }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal, RM.Space.l)
                }.padding(.vertical, RM.Space.s)
                List {
                    let cards = (columns.first { $0.id == active }?.cardIds ?? []).compactMap { data.cards[$0] }
                    if cards.isEmpty { EmptyState(icon: "tray", title: "Nothing in this stage", message: "Move a card here from another stage.").listRowBackground(Color.clear) }
                    ForEach(cards) { card in
                        NavigationLink(value: Route.card(card.id)) { CardRow(card: card) }
                            .contextMenu { moveMenu(card, columns) }
                            .swipeActions(edge: .trailing) {
                                if let next = nextColumn(after: card.columnId, in: columns) {
                                    Button { move(card, to: next) } label: { Label(next.title, systemImage: "arrow.right") }.tint(Color(hexString: board.color))
                                }
                            }
                    }
                }
                .listStyle(.insetGrouped).scrollContentBackground(.hidden)
                .refreshable { await model.refresh() }
            }
            .rmScreen()
            .navigationTitle(board.title)
            .navigationBarTitleDisplayMode(.inline)
        } else {
            EmptyState(icon: "questionmark.folder", title: "Board not found", message: "It may have been removed.")
        }
    }

    @ViewBuilder private func moveMenu(_ card: KanbanCard, _ columns: [KanbanColumn]) -> some View {
        Menu("Move to") {
            ForEach(columns.filter { $0.id != card.columnId }) { col in
                Button(col.title) { move(card, to: col) }
            }
        }
    }

    private func nextColumn(after id: String, in columns: [KanbanColumn]) -> KanbanColumn? {
        guard let i = columns.firstIndex(where: { $0.id == id }), i + 1 < columns.count else { return nil }
        return columns[i + 1]
    }

    private func move(_ card: KanbanCard, to column: KanbanColumn) {
        Haptics.tap()
        let back = PendingOp.moveCard(cardId: card.id, toColumnId: card.columnId, at: RecordFactory.iso())
        model.perform(.moveCard(cardId: card.id, toColumnId: column.id, at: RecordFactory.iso()))
        model.toast = Toast(message: "Moved to \(column.title)", undoOp: back)
    }
}

struct CardRow: View {
    let card: KanbanCard
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(card.title).font(.headline)
            HStack(spacing: RM.Space.s) {
                if let t = card.deliverableType { StatusPill(text: t, tint: RM.info) }
                if let due = card.dueDate { Label(shortDate(due), systemImage: "calendar").font(.footnote).foregroundStyle(RM.inkSecondary) }
                if !card.description.isEmpty { Label("\(ScriptStats.words(card.description)) words", systemImage: "text.alignleft").font(.footnote).foregroundStyle(RM.inkSecondary) }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct CardDetailView: View {
    @Environment(AppModel.self) private var model
    let cardId: String

    var body: some View {
        if let card = model.card(cardId), let data = model.workspace.kanbanData {
            let board = data.boards.first { $0.id == card.boardId }
            let column = data.columns[card.columnId]
            List {
                Section {
                    VStack(alignment: .leading, spacing: RM.Space.s) {
                        Text(card.title).font(RM.display(28))
                        HStack {
                            if let column { StatusPill(text: column.title, tint: RM.accent) }
                            if let t = card.deliverableType { StatusPill(text: t, tint: RM.info) }
                            StatusPill(text: card.priority.capitalized, tint: card.priority == "high" ? RM.alert : RM.inkSecondary)
                        }
                        if let board { Button { model.open(.production, .board(board.id)) } label: { Label(board.title, systemImage: "rectangle.3.group") }.font(.subheadline) }
                    }.listRowBackground(Color.clear)
                }
                Section("Script") {
                    NavigationLink(value: Route.script(card.id)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(card.description.isEmpty ? "No script yet. Tap to write." : String(card.description.prefix(160)))
                                .lineLimit(4).foregroundStyle(card.description.isEmpty ? RM.inkSecondary : RM.ink)
                            Text("\(ScriptStats.words(card.description)) words").font(.footnote).foregroundStyle(RM.inkSecondary)
                        }
                    }
                }
                if let link = card.videoLink, let url = URL(string: link) { Section("Video") { Link(link, destination: url).lineLimit(1) } }
                if let due = card.dueDate { Section("Due") { Text(shortDate(due)) } }
                if !card.notes.isEmpty { Section("Notes") { Text(card.notes) } }
                if let board {
                    Section("Stage") {
                        ForEach((board.columnIds.compactMap { data.columns[$0] })) { col in
                            Button {
                                guard col.id != card.columnId else { return }
                                Haptics.tap()
                                model.perform(.moveCard(cardId: card.id, toColumnId: col.id, at: RecordFactory.iso()), toast: "Moved to \(col.title)")
                            } label: {
                                HStack { Text(col.title); Spacer(); if col.id == card.columnId { Image(systemName: "checkmark").foregroundStyle(RM.accent) } }
                            }.foregroundStyle(RM.ink)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped).scrollContentBackground(.hidden).rmScreen()
            .navigationBarTitleDisplayMode(.inline)
        } else {
            EmptyState(icon: "questionmark.folder", title: "Card not found", message: "It may have been removed.")
        }
    }
}
