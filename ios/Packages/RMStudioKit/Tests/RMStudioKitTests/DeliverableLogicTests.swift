import XCTest
@testable import RMStudioKit

final class DeliverableLogicTests: XCTestCase {
    private func sheetRow() -> DeliverableRow {
        DeliverableRow(id: "se26-27", pnNo: "se26-27", brand: "vivo X Fold6",
                       deliverables: [DeliverableItem(label: "1 IG reel")],
                       poc: "Momentum - NAIM", pocName: "Momentum", pocCompany: "NAIM", month: "Sep 2026")
    }

    /// Mirrors tests/deliverable-merge.test.ts on the web side.
    func testSheetWinsOnListBrandAndPocButCompletionCarriesOverByLabel() {
        var stale = sheetRow()
        stale.brand = "OLD BRAND"; stale.pocName = "Old"; stale.payment100 = true; stale.note = "kept"
        stale.deliverables = [
            DeliverableItem(label: "2 IG reels", status: .completed),
            DeliverableItem(label: "1 ig REEL ", status: .completed, completedBy: "a@b.c"),
        ]
        let m = DeliverableLogic.mergeSheetRow(sheetRow(), override: stale)
        XCTAssertEqual(m.brand, "vivo X Fold6")
        XCTAssertEqual(m.pocName, "Momentum")
        XCTAssertEqual(m.deliverables.map(\.label), ["1 IG reel"])
        XCTAssertEqual(m.deliverables[0].status, .completed)
        XCTAssertEqual(m.deliverables[0].completedBy, "a@b.c")
        XCTAssertEqual(m.note, "kept")
        XCTAssertEqual(m.overallStatus, .done)
    }

    func testOverallStatusMatchesWeb() {
        let pending = DeliverableItem(label: "a"), done = DeliverableItem(label: "b", status: .completed)
        XCTAssertEqual(DeliverableLogic.overallStatus([], payment100: false), .pending)
        XCTAssertEqual(DeliverableLogic.overallStatus([pending, done], payment100: false), .inProgress)
        XCTAssertEqual(DeliverableLogic.overallStatus([done], payment100: false), .awaitingPayment)
        XCTAssertEqual(DeliverableLogic.overallStatus([done], payment100: true), .done)
    }

    func testCompletionIsIdempotentAndLogsActivity() {
        let row = sheetRow()
        let once = DeliverableLogic.completing(row, itemKey: "se26-27-del-0", url: " https://ig/x ",
                                               by: "me@x.com", at: "2026-10-28T10:00:00Z")
        XCTAssertEqual(once.deliverables[0].status, .completed)
        XCTAssertEqual(once.deliverables[0].publishedUrl, "https://ig/x")
        XCTAssertEqual(once.deliverables[0].completedAt, "2026-10-28T10:00:00Z")
        XCTAssertEqual(once.activityLog?.map(\.type), ["deliverable_completed", "url_added", "email_generated"])
        XCTAssertEqual(once.overallStatus, .awaitingPayment)
        let twice = DeliverableLogic.completing(once, itemKey: "se26-27-del-0", url: nil, by: "other", at: "later")
        XCTAssertEqual(twice, once)
    }

    func testCompletionEmailMatchesWebTemplate() {
        var row = sheetRow()
        row.deliverables.append(DeliverableItem(label: "1 story"))
        let mail = DeliverableLogic.completionEmail(row: row, itemLabel: "1 IG reel", itemId: nil,
                                                    liveURL: "https://ig/x", dateText: "1 June 2026")
        XCTAssertEqual(mail.subject, "vivo X Fold6 1 IG reel posted")
        XCTAssertTrue(mail.body.hasPrefix("Hi Salil,"))
        XCTAssertTrue(mail.body.contains("vivo X Fold6 1 IG reel posted (1 June 2026)"))
        XCTAssertTrue(mail.body.contains("Reel link: https://ig/x"))
        XCTAssertTrue(mail.body.contains("List of all deliverables from Momentum - NAIM"))
        XCTAssertTrue(mail.body.contains("1 IG reel - Completed\n1 story - Pending"))
        XCTAssertTrue(mail.body.hasSuffix("Thanks"))
    }

    func testDisplayRowsHidesAndPrefersLocalFirst() {
        let local = DeliverableRow(id: "local-1", brand: "Local")
        let rows = DeliverableLogic.displayRows(sheet: [sheetRow()], overrides: [:], localRows: [local], hidden: ["se26-27"])
        XCTAssertEqual(rows.map(\.id), ["local-1"])
        let all = DeliverableLogic.displayRows(sheet: [sheetRow()], overrides: [:], localRows: [local], hidden: ["se26-27"], showHidden: true)
        XCTAssertEqual(all.map(\.id), ["local-1", "se26-27"])
    }

    func testISTDayMath() {
        XCTAssertEqual(ISTCalendar.days(from: "2026-10-28", to: "2026-10-30"), 2)
        XCTAssertEqual(ISTCalendar.days(from: "2026-10-28", to: "2026-10-27"), -1)
        // 20:00 UTC on the 27th is already the 28th in IST.
        let utc = ISO8601DateFormatter().date(from: "2026-10-27T20:00:00Z")!
        XCTAssertEqual(ISTCalendar.today(now: utc), "2026-10-28")
    }

    func testLenientDecodingOfSparseWebRows() throws {
        let json = #"{"id":"x","brand":"B","deliverables":[{"label":"L","status":"Completed"}],"unknownFutureField":1}"#
        let row = try JSONDecoder().decode(DeliverableRow.self, from: Data(json.utf8))
        XCTAssertEqual(row.deliverables.first?.status, .completed)
        XCTAssertEqual(row.paymentStep, 0)
    }
}
