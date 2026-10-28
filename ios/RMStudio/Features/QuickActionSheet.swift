import SwiftUI
import RMStudioKit

struct QuickActionSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let action: QuickAction

    var body: some View {
        NavigationStack {
            switch action {
            case .newScript: NewCardForm(asScript: true)
            case .newCard: NewCardForm(asScript: false)
            case .newDeliverable: NewDeliverableForm()
            case .newTask: NewTaskForm()
            case .recordPayment: RecordPaymentForm()
            case .newCash: NewCashForm()
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct FormShell<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let canSave: Bool
    let save: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        Form { content }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save(); Haptics.success(); dismiss() }.disabled(!canSave) }
            }
    }
}

struct NewCardForm: View {
    @Environment(AppModel.self) private var model
    let asScript: Bool
    @State private var title = ""
    @State private var boardId: String?
    @State private var columnId: String?
    @State private var template = "none"
    @State private var type = "Reel"
    static let types = ["Reel", "YouTube", "Ad", "Post", "Story", "Podcast", "Blog", "Short"]

    var body: some View {
        let data = model.workspace.kanbanData
        let board = data?.boards.first { $0.id == (boardId ?? data?.boards.first?.id) }
        let columns = board?.columnIds.compactMap { data?.columns[$0] } ?? []
        FormShell(title: asScript ? "New script" : "Start production", canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty && board != nil && !columns.isEmpty, save: {
            guard let board else { return }
            let col = columns.first { $0.id == columnId } ?? columns[0]
            let body = ScriptTemplate.all.first { $0.id == template }?.content ?? ""
            let card = RecordFactory.card(boardId: board.id, columnId: col.id, title: title.trimmingCharacters(in: .whitespaces),
                                          script: body, deliverableType: type)
            model.perform(.addCard(card: card), toast: asScript ? "Script created" : "Production started")
            if asScript, let id = card["id"]?.stringValue { model.open(.scripts, .script(id)) }
        }) {
            if board == nil { Section { Text("Create a production board in the web app first. Boards hold your scripts and cards.").foregroundStyle(RM.inkSecondary) } }
            Section {
                TextField("Title", text: $title)
                Picker("Type", selection: $type) { ForEach(Self.types, id: \.self) { Text($0) } }
            }
            if let data {
                Section("Where") {
                    Picker("Board", selection: Binding(get: { board?.id ?? "" }, set: { boardId = $0; columnId = nil })) {
                        ForEach(data.boards) { Text($0.title).tag($0.id) }
                    }
                    Picker("Stage", selection: Binding(get: { columnId ?? columns.first?.id ?? "" }, set: { columnId = $0 })) {
                        ForEach(columns) { Text($0.title).tag($0.id) }
                    }
                }
            }
            if asScript {
                Section("Start from") {
                    Picker("Template", selection: $template) {
                        Text("Blank").tag("none")
                        ForEach(ScriptTemplate.all) { Text($0.name).tag($0.id) }
                    }
                }
            }
        }
    }
}

struct NewDeliverableForm: View {
    @Environment(AppModel.self) private var model
    @State private var brand = ""
    @State private var pn = ""
    @State private var lines = ""
    @State private var poc = ""
    @State private var hasDate = false
    @State private var date = Date()

    private var labels: [String] { lines.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }

    var body: some View {
        FormShell(title: "New deliverable", canSave: !brand.trimmingCharacters(in: .whitespaces).isEmpty && !labels.isEmpty, save: {
            let row = RecordFactory.localRow(brand: brand.trimmingCharacters(in: .whitespaces), pnNo: pn.trimmingCharacters(in: .whitespaces),
                                             deliverableLabels: labels, poc: poc, goLiveDate: hasDate ? ISTCalendar.dateString(date) : nil)
            if let json = try? JSONValue.from(row) { model.perform(.addLocalRow(row: json), toast: "Deliverable added") }
        }) {
            Section {
                TextField("Brand", text: $brand)
                TextField("Project no. (e.g. oc26-3)", text: $pn).textInputAutocapitalization(.never)
                TextField("Point of contact (Name - Company)", text: $poc)
            }
            Section("Deliverables, one per line") { TextEditor(text: $lines).frame(minHeight: 100) }
            Section {
                Toggle("Go-live date", isOn: $hasDate)
                if hasDate { DatePicker("Date", selection: $date, displayedComponents: .date) }
            }
        }
    }
}

struct NewTaskForm: View {
    @Environment(AppModel.self) private var model
    @State private var title = ""
    var body: some View {
        FormShell(title: "Add task", canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty, save: {
            model.perform(.addTodo(todo: RecordFactory.todo(title: title.trimmingCharacters(in: .whitespaces), createdBy: model.user?.email ?? "")), toast: "Task added")
        }) {
            TextField("What needs doing?", text: $title)
        }
    }
}

struct RecordPaymentForm: View {
    @Environment(AppModel.self) private var model
    @State private var rowId = ""
    @State private var field: PaymentField = .advance50

    var body: some View {
        let open = model.workspace.deliverables.filter { !$0.payment100 && !$0.deliverables.isEmpty }
        let selected = open.first { $0.id == rowId } ?? open.first
        FormShell(title: "Record payment", canSave: selected != nil, save: {
            guard let selected else { return }
            model.perform(.setPayment(seed: DeliverableLogic.withStableIds(selected), field: field, value: true), toast: "Payment recorded")
        }) {
            if open.isEmpty { Text("Every project is fully paid.").foregroundStyle(RM.inkSecondary) }
            else {
                Picker("Project", selection: Binding(get: { selected?.id ?? "" }, set: { rowId = $0 })) {
                    ForEach(open) { Text("\($0.brand) · \($0.pnNo)").tag($0.id) }
                }
                Picker("Stage", selection: $field) {
                    Text("Invoice email sent").tag(PaymentField.emailSent)
                    Text("50% advance received").tag(PaymentField.advance50)
                    Text("100% received").tag(PaymentField.payment100)
                }
                if let s = selected { Text("Currently: \(Insights.paymentStageText(s))").font(.footnote).foregroundStyle(RM.inkSecondary) }
            }
        }
    }
}

struct NewCashForm: View {
    @Environment(AppModel.self) private var model
    @State private var amount = ""
    @State private var income = false
    @State private var category = "Misc"
    @State private var note = ""

    private var value: Double? { Double(amount.replacingOccurrences(of: ",", with: "")) }

    var body: some View {
        let cats = model.workspace.cashData?.categories.isEmpty == false ? model.workspace.cashData!.categories : ["Salary", "Food", "Travel", "Shopping", "Bills", "Misc"]
        FormShell(title: "Cash entry", canSave: (value ?? 0) > 0, save: {
            guard let v = value else { return }
            model.perform(.addCashTransaction(tx: RecordFactory.cashTransaction(amount: v, income: income, category: category, note: note)), toast: "Entry added")
        }) {
            Picker("Type", selection: $income) { Text("Expense").tag(false); Text("Income").tag(true) }.pickerStyle(.segmented)
            TextField("Amount (₹)", text: $amount).keyboardType(.decimalPad)
            Picker("Category", selection: $category) { ForEach(cats, id: \.self) { Text($0) } }
            TextField("Note", text: $note)
        }
    }
}
