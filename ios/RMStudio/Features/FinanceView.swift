import SwiftUI
import RMStudioKit

struct FinanceView: View {
    @Environment(AppModel.self) private var model
    enum Mode: String, CaseIterable { case payments = "Client payments", cash = "Cash book" }
    @State private var mode: Mode = .payments

    var body: some View {
        NavigationStack(path: model.pathBinding(.finance)) {
            VStack(spacing: 0) {
                Picker("Finance", selection: $mode) { ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                    .pickerStyle(.segmented).padding(.horizontal, RM.Space.l).padding(.bottom, RM.Space.s)
                switch mode {
                case .payments: PaymentsList()
                case .cash: CashBook()
                }
            }
            .rmScreen()
            .navigationTitle("Finance")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { QuickActionsMenu() } }
            .navigationDestination(for: Route.self) { RouteView(route: $0) }
        }
    }
}

struct PaymentsList: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""

    var body: some View {
        let rows = DeliverableLogic.filter(model.workspace.deliverables, status: .all, query: query)
        let s = Finance.payments(rows)
        List {
            Section {
                RMCard {
                    Grid(horizontalSpacing: RM.Space.l, verticalSpacing: RM.Space.l) {
                        GridRow { MetricTile(value: s.notInvoiced.count, label: "Not invoiced"); MetricTile(value: s.awaitingAdvance.count, label: "Awaiting advance", tint: RM.caution) }
                        GridRow { MetricTile(value: s.awaitingBalance.count, label: "Balance due", tint: RM.info); MetricTile(value: s.paid.count, label: "Paid in full", tint: RM.positive) }
                    }
                }
                .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                Text("The studio sheet tracks payment stages, not amounts or due dates, so totals are counts.")
                    .font(.footnote).foregroundStyle(RM.inkSecondary).listRowBackground(Color.clear)
            }
            group("Delivered, not fully paid", s.deliveredUnpaid, tint: RM.info)
            group("Awaiting advance", s.awaitingAdvance.filter { r in !s.deliveredUnpaid.contains { $0.id == r.id } }, tint: RM.caution)
            group("Balance due", s.awaitingBalance.filter { r in !s.deliveredUnpaid.contains { $0.id == r.id } }, tint: RM.info)
            group("Not invoiced", s.notInvoiced, tint: RM.inkSecondary)
            group("Paid in full", s.paid, tint: RM.positive)
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .searchable(text: $query, prompt: "Brand or invoice number")
        .refreshable { await model.refresh() }
    }

    @ViewBuilder private func group(_ title: String, _ rows: [DeliverableRow], tint: Color) -> some View {
        if !rows.isEmpty {
            Section(title) {
                ForEach(rows) { r in
                    NavigationLink(value: Route.deliverable(r.id)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.brand).font(.headline)
                                Text([r.pnNo, r.invoiceNumber.isEmpty ? nil : "Inv \(r.invoiceNumber)"].compactMap { $0 }.joined(separator: " · "))
                                    .font(.footnote).foregroundStyle(RM.inkSecondary)
                            }
                            Spacer()
                            StatusPill(text: Insights.paymentStageText(r), tint: tint)
                        }
                    }
                }
            }
        }
    }
}

struct CashBook: View {
    @Environment(AppModel.self) private var model
    @State private var month = String(ISTCalendar.today().prefix(7))
    @State private var pendingDelete: CashTransaction?

    var body: some View {
        let all = model.workspace.cashData?.transactions ?? []
        let monthTx = all.filter { $0.date.hasPrefix(month) }.sorted { ($0.date, $0.time) > ($1.date, $1.time) }
        let sum = Finance.cash(all, month: month)
        List {
            Section {
                RMCard {
                    VStack(alignment: .leading, spacing: RM.Space.m) {
                        Text(monthTitle).font(.subheadline).foregroundStyle(RM.inkSecondary)
                        Text(formatINR(sum.balance)).font(.system(size: 34, weight: .semibold, design: .rounded)).monospacedDigit()
                        HStack {
                            Label(formatINR(sum.income), systemImage: "arrow.down.left").foregroundStyle(RM.positive)
                            Spacer()
                            Label(formatINR(sum.expense), systemImage: "arrow.up.right").foregroundStyle(RM.alert)
                        }.font(.subheadline.weight(.medium))
                    }
                }.listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
            }
            Section {
                if monthTx.isEmpty { EmptyState(icon: "banknote", title: "No entries this month", message: model.errors["Cash book"] ?? "Add income or expenses from the + menu.").listRowBackground(Color.clear) }
                ForEach(monthTx) { tx in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tx.note?.isEmpty == false ? tx.note! : tx.category)
                            Text("\(tx.category) · \(shortDate(tx.date))").font(.footnote).foregroundStyle(RM.inkSecondary)
                        }
                        Spacer()
                        Text((tx.isIncome ? "+" : "−") + formatINR(tx.amount)).monospacedDigit().foregroundStyle(tx.isIncome ? RM.positive : RM.ink)
                    }
                    .swipeActions { Button(role: .destructive) { pendingDelete = tx } label: { Label("Delete", systemImage: "trash") } }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                HStack {
                    Button { shift(-1) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Previous month")
                    Button { shift(1) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Next month")
                }
            }
        }
        .refreshable { await model.refresh() }
        .confirmationDialog("Delete this entry?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("Delete entry", role: .destructive) {
                if let tx = pendingDelete { model.perform(.deleteCashTransaction(id: tx.id), toast: "Entry deleted"); Haptics.warning() }
            }
        }
    }

    private var monthTitle: String {
        let parts = month.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2, let d = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1])) else { return month }
        return d.formatted(.dateTime.month(.wide).year())
    }

    private func shift(_ delta: Int) {
        let parts = month.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2, let d = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1])),
              let n = Calendar.current.date(byAdding: .month, value: delta, to: d) else { return }
        let c = Calendar.current.dateComponents([.year, .month], from: n)
        month = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }
}
