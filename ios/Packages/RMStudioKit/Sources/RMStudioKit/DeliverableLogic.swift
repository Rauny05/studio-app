import Foundation

/// Dates in the sheet and reminders are calendar dates in IST (the web cron uses UTC+5:30).
public enum ISTCalendar {
    public static let zone = TimeZone(identifier: "Asia/Kolkata") ?? TimeZone(secondsFromGMT: 19800)!

    static var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = zone
        return c
    }

    static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = zone
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    public static func dateString(_ date: Date) -> String { formatter.string(from: date) }
    public static func today(now: Date = Date()) -> String { dateString(now) }

    public static func date(from string: String) -> Date? { formatter.date(from: string) }

    /// Whole days from `from` to `to` (negative when `to` is in the past).
    public static func days(from: String, to: String) -> Int? {
        guard let a = date(from: from), let b = date(from: to) else { return nil }
        return calendar.dateComponents([.day], from: a, to: b).day
    }
}

public enum PaymentField: String, Codable, Sendable { case emailSent, advance50, payment100 }

public enum DeliverableLogic {
    // MARK: status

    public static func overallStatus(_ items: [DeliverableItem], payment100: Bool) -> OverallStatus {
        if items.isEmpty { return .pending }
        let allDone = items.allSatisfy { $0.status == .completed }
        if allDone && payment100 { return .done }
        if allDone { return .awaitingPayment }
        if items.contains(where: { $0.status == .completed }) { return .inProgress }
        return .pending
    }

    public static func paymentStep(_ row: DeliverableRow) -> Int {
        row.payment100 ? 3 : row.advance50 ? 2 : row.emailSent ? 1 : 0
    }

    /// Normalises derived fields after an edit.
    public static func recomputed(_ row: DeliverableRow) -> DeliverableRow {
        var r = row
        r.paymentStep = paymentStep(r)
        r.overallStatus = overallStatus(r.deliverables, payment100: r.payment100)
        return r
    }

    /// Items get the web app's stable id (`<rowId>-del-<index>`) when they have none.
    public static func withStableIds(_ row: DeliverableRow) -> DeliverableRow {
        var r = row
        for i in r.deliverables.indices where r.deliverables[i].id == nil {
            r.deliverables[i].id = "\(r.id)-del-\(i)"
        }
        return r
    }

    // MARK: merge (port of src/lib/deliverable-merge.ts)

    /// Sheet owns the list, brand and POC; an override contributes per-item
    /// completion state (matched by label) plus payment/note fields.
    public static func mergeSheetRow(_ row: DeliverableRow, override ov: DeliverableRow?) -> DeliverableRow {
        guard let ov else { return row }
        func key(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        var savedByLabel: [String: DeliverableItem] = [:]
        for d in ov.deliverables { savedByLabel[key(d.label)] = d }
        let items = row.deliverables.map { d -> DeliverableItem in
            guard var saved = savedByLabel[key(d.label)] else { return d }
            saved.label = d.label
            return saved
        }
        var merged = ov
        merged.id = row.id
        merged.pnNo = row.pnNo
        merged.brand = row.brand
        merged.poc = row.poc
        merged.pocName = row.pocName
        merged.pocCompany = row.pocCompany
        merged.month = row.month
        merged.deliverables = items
        merged.overallStatus = overallStatus(items, payment100: ov.payment100)
        merged.goLiveDate = row.goLiveDate ?? ov.goLiveDate
        return merged
    }

    /// What the web Deliverables page displays: local rows first, then sheet rows,
    /// minus hidden ids (unless `showHidden`).
    public static func displayRows(sheet: [DeliverableRow], overrides: [String: DeliverableRow],
                                   localRows: [DeliverableRow], hidden: Set<String>,
                                   showHidden: Bool = false) -> [DeliverableRow] {
        let local = localRows.map { row -> DeliverableRow in
            guard var ov = overrides[row.id] else { return row }
            ov.goLiveDate = row.goLiveDate ?? ov.goLiveDate
            return ov
        }
        let fromSheet = sheet.map { mergeSheetRow($0, override: overrides[$0.id]) }
        let all = local + fromSheet
        return showHidden ? all : all.filter { !hidden.contains($0.id) }
    }

    // MARK: completion

    /// Applies a completion to a row. Idempotent: completing a completed item changes nothing.
    public static func completing(_ row: DeliverableRow, itemKey: String, url: String?,
                                  by email: String, at iso: String) -> DeliverableRow {
        var r = withStableIds(row)
        guard let idx = r.deliverables.firstIndex(where: { $0.stableKey == itemKey || $0.label == itemKey }),
              r.deliverables[idx].status != .completed else { return r }
        let trimmedURL = url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        var item = r.deliverables[idx]
        item.status = .completed
        item.completedAt = iso
        item.completedBy = email
        if !trimmedURL.isEmpty { item.publishedUrl = trimmedURL }
        item.emailDrafted = true
        r.deliverables[idx] = item

        var log = r.activityLog ?? []
        log.append(ActivityEntry(type: "deliverable_completed", message: "\(item.label) marked complete",
                                 deliverableId: item.id, deliverableLabel: item.label, createdAt: iso))
        if !trimmedURL.isEmpty {
            log.append(ActivityEntry(type: "url_added", message: "Live URL added for \(item.label)",
                                     deliverableId: item.id, deliverableLabel: item.label, createdAt: iso))
        }
        log.append(ActivityEntry(type: "email_generated", message: "Completion email generated for \(item.label)",
                                 deliverableId: item.id, deliverableLabel: item.label, createdAt: iso))
        r.activityLog = log
        return recomputed(r)
    }

    public static func settingPayment(_ row: DeliverableRow, field: PaymentField, value: Bool) -> DeliverableRow {
        var r = row
        switch field {
        case .emailSent: r.emailSent = value
        case .advance50: r.advance50 = value
        case .payment100: r.payment100 = value
        }
        return recomputed(r)
    }

    /// Overrides never store goLiveDate (the sheet owns it).
    public static func forOverrideStorage(_ row: DeliverableRow) -> DeliverableRow {
        var r = row
        r.goLiveDate = nil
        return r
    }

    // MARK: completion email (port of generateEmailText)

    public static func inferType(_ label: String) -> String {
        let l = label.lowercased()
        if l.contains("reel") { return "reel" }
        if l.contains("stor") { return "story" }
        if l.contains("youtube") || (l.contains("video") && !l.contains("stor")) { return "youtube" }
        if l.contains("podcast") || l.contains("episode") { return "podcast" }
        if l.contains("post") || l.contains("ig ") || l.contains("instagram") { return "post" }
        return "general"
    }

    static let linkLabels: [String: String] = [
        "reel": "Reel link", "story": "Story link", "youtube": "Video link", "post": "Post link",
    ]

    /// The CFO completion email. This only builds a draft for the user to review; nothing is sent.
    public static func completionEmail(row: DeliverableRow, itemLabel: String, itemId: String?,
                                       liveURL: String, dateText: String) -> (subject: String, body: String) {
        let linkLabel = linkLabels[inferType(itemLabel)] ?? "Link"
        let byline = [row.pocName, row.pocCompany].filter { !$0.isEmpty }.joined(separator: " - ")
        let list = row.deliverables.map { d -> String in
            let isTarget = (itemId != nil && d.id == itemId) || (itemId == nil && d.label == itemLabel)
            let done = isTarget || d.status == .completed
            return "\(d.label) - \(done ? "Completed" : "Pending")"
        }.joined(separator: "\n")
        let body = """
        Hi Salil,

        \(row.brand) \(itemLabel) posted (\(dateText))

        \(linkLabel): \(liveURL)

        List of all deliverables\(byline.isEmpty ? "" : " from \(byline)")
        \(list)

        Thanks
        """
        return ("\(row.brand) \(itemLabel) posted", body)
    }

    public static func completionDateText(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.timeZone = ISTCalendar.zone
        f.dateFormat = "d MMMM yyyy"
        return f.string(from: date)
    }

    public static func isVideoType(_ label: String) -> Bool {
        label.range(of: "reel|video|short|yt\\b", options: [.regularExpression, .caseInsensitive]) != nil
    }

    // MARK: filtering

    public enum Filter: String, CaseIterable, Sendable {
        case all, pending, inProgress, awaitingPayment, done
        public var title: String {
            switch self {
            case .all: "All"
            case .pending: "Pending"
            case .inProgress: "In progress"
            case .awaitingPayment: "Awaiting payment"
            case .done: "Done"
            }
        }
    }

    public static func filter(_ rows: [DeliverableRow], status: Filter, query: String) -> [DeliverableRow] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return rows.filter { r in
            let statusOK: Bool
            switch status {
            case .all: statusOK = true
            case .pending: statusOK = r.overallStatus == .pending
            case .inProgress: statusOK = r.overallStatus == .inProgress
            case .awaitingPayment: statusOK = r.overallStatus == .awaitingPayment
            case .done: statusOK = r.overallStatus == .done
            }
            guard statusOK else { return false }
            if q.isEmpty { return true }
            let haystack = ([r.brand, r.pnNo, r.poc, r.invoiceNumber, r.note] + r.deliverables.map(\.label))
                .joined(separator: " ").lowercased()
            return haystack.contains(q)
        }
    }
}
