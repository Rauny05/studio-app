import SwiftUI
import RMStudioKit

struct ProductionView: View {
    @Environment(AppModel.self) private var model
    enum Mode: String, CaseIterable { case deliverables = "Deliverables", boards = "Boards" }
    @State private var mode: Mode = .deliverables

    var body: some View {
        NavigationStack(path: model.pathBinding(.production)) {
            VStack(spacing: 0) {
                Picker("View", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, RM.Space.l).padding(.bottom, RM.Space.s)
                switch mode {
                case .deliverables: DeliverablesList()
                case .boards: BoardsList()
                }
            }
            .rmScreen()
            .navigationTitle("Production")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { QuickActionsMenu() } }
            .navigationDestination(for: Route.self) { RouteView(route: $0) }
        }
    }
}

// MARK: - Deliverables list

struct DeliverablesList: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var filter: DeliverableLogic.Filter = .all
    @State private var completion: CompletionTarget?

    private var rows: [DeliverableRow] {
        let filtered = DeliverableLogic.filter(model.workspace.deliverables, status: filter, query: query)
        return filtered.sorted { a, b in
            switch (a.goLiveDate, b.goLiveDate) {
            case let (x?, y?): return x < y
            case (_?, nil): return true
            case (nil, _?): return false
            default: return a.brand.localizedCaseInsensitiveCompare(b.brand) == .orderedAscending
            }
        }
    }

    var body: some View {
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(DeliverableLogic.Filter.allCases, id: \.self) { f in
                            Button { withAnimation(.snappy) { filter = f } } label: {
                                Text(f.title).font(.subheadline.weight(.medium))
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(filter == f ? RM.accent : RM.surface, in: Capsule())
                                    .foregroundStyle(filter == f ? Color.white : RM.ink)
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(filter == f ? .isSelected : [])
                        }
                    }
                }
                .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
            }
            if rows.isEmpty {
                EmptyState(icon: "tray", title: model.workspace.sheetRows.isEmpty && model.workspace.localRows.isEmpty ? "No deliverables yet" : "No matches",
                           message: model.errors["Deliverables sheet"] ?? "Deliverables come from your studio sheet. Pull to refresh.")
                    .listRowBackground(Color.clear)
            }
            ForEach(rows) { row in
                NavigationLink(value: Route.deliverable(row.id)) { DeliverableRowView(row: row) }
                    .swipeActions(edge: .leading) {
                        if let next = row.deliverables.first(where: { $0.status == .pending }) {
                            Button { completion = CompletionTarget(row: row, item: next) } label: { Label("Complete", systemImage: "checkmark") }
                                .tint(RM.positive)
                        }
                    }
                    .contextMenu {
                        if let next = row.deliverables.first(where: { $0.status == .pending }) {
                            Button { completion = CompletionTarget(row: row, item: next) } label: { Label("Complete “\(next.label)”", systemImage: "checkmark.circle") }
                        }
                        if !row.poc.isEmpty { Button { UIPasteboard.general.string = row.poc } label: { Label("Copy contact", systemImage: "doc.on.doc") } }
                    }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .searchable(text: $query, prompt: "Brand, project no., invoice, deliverable")
        .refreshable { await model.refresh() }
        .sheet(item: $completion) { CompletionSheet(row: $0.row, item: $0.item) }
    }
}

struct DeliverableRowView: View {
    let row: DeliverableRow
    var body: some View {
        let done = row.deliverables.filter { $0.status == .completed }.count
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(row.brand).font(.headline)
                Spacer()
                StatusPill(text: row.overallStatus.title, tint: row.overallStatus.tint)
            }
            HStack(spacing: RM.Space.s) {
                Text(row.pnNo).font(.footnote.monospaced()).foregroundStyle(RM.inkSecondary)
                if let d = row.goLiveDate { Label(shortDate(d), systemImage: "calendar").font(.footnote).foregroundStyle(lateTint) }
                Spacer()
                Text("\(done)/\(row.deliverables.count) done").font(.footnote).foregroundStyle(RM.inkSecondary).monospacedDigit()
            }
            ProgressView(value: Double(done), total: Double(max(row.deliverables.count, 1))).tint(row.overallStatus.tint)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
    private var lateTint: Color {
        guard let d = row.goLiveDate, row.overallStatus == .pending || row.overallStatus == .inProgress,
              let n = ISTCalendar.days(from: ISTCalendar.today(), to: d) else { return RM.inkSecondary }
        return n < 0 ? RM.alert : n <= 2 ? RM.caution : RM.inkSecondary
    }
}

// MARK: - Deliverable detail

struct DeliverableDetailView: View {
    @Environment(AppModel.self) private var model
    let rowId: String
    @State private var completion: CompletionTarget?
    @State private var confirmPayment: (PaymentField, Bool)?

    private var row: DeliverableRow? { model.workspace.deliverables.first { $0.id == rowId } }

    var body: some View {
        Group {
            if let row { content(row) }
            else { EmptyState(icon: "questionmark.folder", title: "Deliverable not found", message: "It may have been hidden or removed. Pull to refresh on the list.") }
        }
        .rmScreen()
        .navigationBarTitleDisplayMode(.inline)
    }

    private func content(_ row: DeliverableRow) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: RM.Space.s) {
                    Text(row.brand).font(RM.display(30))
                    HStack {
                        StatusPill(text: row.overallStatus.title, tint: row.overallStatus.tint)
                        Text(row.pnNo).font(.footnote.monospaced()).foregroundStyle(RM.inkSecondary)
                    }
                    if let d = row.goLiveDate { Label("Goes live \(shortDate(d))", systemImage: "calendar").font(.subheadline).foregroundStyle(RM.inkSecondary) }
                    if !row.poc.isEmpty { Label(row.poc, systemImage: "person").font(.subheadline).foregroundStyle(RM.inkSecondary) }
                }
                .listRowBackground(Color.clear)
            }
            Section("Deliverables") {
                ForEach(row.deliverables, id: \.stableKey) { item in
                    HStack(alignment: .top) {
                        Image(systemName: item.status == .completed ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(item.status == .completed ? RM.positive : RM.inkSecondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.label)
                            if let at = item.completedAt, let d = Date.fromISO(at) {
                                Text("Completed \(d.formatted(.dateTime.day().month().hour().minute()))" + (item.completedBy.map { " · \($0)" } ?? ""))
                                    .font(.footnote).foregroundStyle(RM.inkSecondary)
                            }
                            if let u = item.publishedUrl, let url = URL(string: u) { Link(u, destination: url).font(.footnote).lineLimit(1) }
                        }
                        Spacer()
                        if item.status == .pending {
                            Button("Complete") { completion = CompletionTarget(row: row, item: item) }
                                .buttonStyle(.bordered).controlSize(.small)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            Section("Payment") {
                paymentToggle(row, "Invoice email sent", .emailSent, row.emailSent)
                paymentToggle(row, "50% advance received", .advance50, row.advance50)
                paymentToggle(row, "100% payment received", .payment100, row.payment100)
                if !row.invoiceNumber.isEmpty { LabeledContent("Invoice", value: row.invoiceNumber) }
            }
            if !row.note.isEmpty { Section("Note") { Text(row.note) } }
            let log = (row.activityLog ?? []).suffix(10).reversed()
            if !log.isEmpty {
                Section("Activity") {
                    ForEach(Array(log.enumerated()), id: \.offset) { _, e in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.message).font(.subheadline)
                            if let d = Date.fromISO(e.createdAt) { Text(d.formatted(.relative(presentation: .named))).font(.footnote).foregroundStyle(RM.inkSecondary) }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .sheet(item: $completion) { CompletionSheet(row: $0.row, item: $0.item) }
        .confirmationDialog("Update payment status?", isPresented: Binding(get: { confirmPayment != nil }, set: { if !$0 { confirmPayment = nil } }), titleVisibility: .visible) {
            if let (field, value) = confirmPayment {
                Button(value ? "Mark received" : "Mark not received", role: value ? nil : .destructive) {
                    model.perform(.setPayment(seed: DeliverableLogic.withStableIds(row), field: field, value: value),
                                  toast: "Payment updated")
                    Haptics.success()
                }
            }
        }
    }

    private func paymentToggle(_ row: DeliverableRow, _ title: String, _ field: PaymentField, _ value: Bool) -> some View {
        Toggle(title, isOn: Binding(get: { value }, set: { confirmPayment = (field, $0) }))
    }
}

// MARK: - Completion workflow

struct CompletionSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let row: DeliverableRow
    let item: DeliverableItem

    @State private var url = ""
    @State private var email = ""
    @State private var step: Step = .url
    @State private var completed = false
    private enum Step { case url, email }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.label).font(.headline)
                        Text(row.brand).font(.subheadline).foregroundStyle(RM.inkSecondary)
                    }
                }
                if step == .url {
                    Section("Live link (optional)") {
                        TextField("https://instagram.com/reel/…", text: $url)
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                    Section { Button("Draft completion email") { buildEmail(); step = .email } }
                } else {
                    Section("Draft email to CFO (not sent)") {
                        TextEditor(text: $email).frame(minHeight: 240).font(.callout)
                    }
                    if completed {
                        Section {
                            Label("Marked complete", systemImage: "checkmark.seal.fill").foregroundStyle(RM.positive)
                        }
                        Section {
                            Button { openURL(MailLink.url(subject: subject, body: email)) } label: { Label("Open in Mail", systemImage: "envelope") }
                            ShareLink(item: email, subject: Text(subject)) { Label("Share…", systemImage: "square.and.arrow.up") }
                            Button { UIPasteboard.general.string = email } label: { Label("Copy", systemImage: "doc.on.doc") }
                        }
                    } else {
                        Section {
                            Button { complete() } label: { Label("Mark complete", systemImage: "checkmark.circle.fill").frame(maxWidth: .infinity) }
                                .buttonStyle(.borderedProminent)
                        } footer: { Text("Saves the status now. The email is only a draft for you to review and send.") }
                    }
                }
            }
            .navigationTitle(completed ? "Done" : "Complete deliverable")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(completed ? "Close" : "Cancel") { dismiss() } } }
            .onAppear {
                url = item.publishedUrl ?? ""
                if !DeliverableLogic.isVideoType(item.label) { buildEmail(); step = .email }
            }
        }
        .presentationDetents([.large])
    }

    private var subject: String { "\(row.brand) \(item.label) posted" }

    private func buildEmail() {
        email = DeliverableLogic.completionEmail(row: row, itemLabel: item.label, itemId: item.id,
                                                 liveURL: url.trimmingCharacters(in: .whitespaces),
                                                 dateText: DeliverableLogic.completionDateText()).body
    }

    private func complete() {
        model.perform(.completeDeliverable(seed: DeliverableLogic.withStableIds(row), itemKey: item.stableKey,
                                           url: url, by: model.user?.email ?? "", at: RecordFactory.iso()))
        withAnimation(.snappy) { completed = true }
        Haptics.success()
    }
}

enum MailLink {
    static func url(subject: String, body: String) -> URL {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&+=?#")
        let s = subject.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        let b = body.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        return URL(string: "mailto:?subject=\(s)&body=\(b)") ?? URL(string: "mailto:")!
    }
}
