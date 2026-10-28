import SwiftUI
import RMStudioKit

struct SearchView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var debounced = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            let hits = SearchIndex.search(debounced, in: model.workspace)
            List {
                if debounced.count < 2 {
                    Section("Jump to") {
                        quick("New script", "text.badge.plus", .newScript)
                        quick("Start production", "film", .newCard)
                        quick("New deliverable", "checklist", .newDeliverable)
                        quick("Add task", "checkmark.circle", .newTask)
                        quick("Record payment", "indianrupeesign.circle", .recordPayment)
                    }
                } else if hits.isEmpty {
                    EmptyState(icon: "magnifyingglass", title: "No results", message: "Nothing in deliverables, scripts, production, contacts, payments or tasks matches “\(debounced)”.")
                        .listRowBackground(Color.clear)
                }
                ForEach(SearchHit.Kind.allCases, id: \.self) { kind in
                    let group = hits.filter { $0.kind == kind }
                    if !group.isEmpty {
                        Section(kind.rawValue) {
                            ForEach(group) { hit in
                                Button { go(hit) } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(hit.title).foregroundStyle(RM.ink)
                                        if !hit.subtitle.isEmpty { Text(hit.subtitle).font(.footnote).foregroundStyle(RM.inkSecondary) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search everything")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .task(id: query) {
                try? await Task.sleep(for: .milliseconds(180)) // debounce; cancelled when query changes
                if !Task.isCancelled { debounced = query }
            }
        }
        .presentationDetents([.large])
    }

    private func quick(_ title: String, _ icon: String, _ action: QuickAction) -> some View {
        Button { dismiss(); model.activeSheet = action } label: { Label(title, systemImage: icon) }
    }

    private func go(_ hit: SearchHit) {
        dismiss()
        switch hit.kind {
        case .deliverable, .payment: model.open(hit.kind == .payment ? .finance : .production, .deliverable(hit.targetId))
        case .script: model.open(.scripts, .inboxScript(hit.targetId))
        case .card:
            let hasScript = model.card(hit.targetId)?.description.isEmpty == false
            let route: Route = hasScript ? .script(hit.targetId) : .card(hit.targetId)
            model.open(hasScript ? .scripts : .production, route)
        case .contact: model.open(.more, .contact(hit.targetId))
        case .todo: model.open(.more, .tasks)
        }
    }
}
