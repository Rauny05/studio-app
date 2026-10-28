import XCTest
@testable import RMStudioKit

final class OpApplierTests: XCTestCase {
    private func seed() -> DeliverableRow {
        DeliverableRow(id: "r1", brand: "Brand", deliverables: [DeliverableItem(label: "reel")], goLiveDate: "2026-11-01")
    }

    func testCompleteCreatesOverrideWithoutGoLiveAndIsIdempotent() throws {
        var blob = JSONValue.object([:])
        let op = PendingOp.completeDeliverable(seed: seed(), itemKey: "reel", url: nil, by: "me", at: "t")
        XCTAssertEqual(OpApplier.apply(op, to: &blob), .applied)
        let row = try XCTUnwrap(blob["r1"]).decode(DeliverableRow.self)
        XCTAssertEqual(row.deliverables[0].status, .completed)
        XCTAssertNil(row.goLiveDate, "goLiveDate belongs to the sheet and must never be stored in overrides")
        XCTAssertEqual(OpApplier.apply(op, to: &blob), .noChange)
    }

    func testOverrideWriteBackPreservesOtherRowsAndUnknownFields() {
        var blob = JSONValue.object(["other": .object(["id": .string("other"), "futureField": .string("keep")])])
        _ = OpApplier.apply(.setPayment(seed: seed(), field: .advance50, value: true), to: &blob)
        XCTAssertEqual(blob["other"]?["futureField"], .string("keep"))
        XCTAssertEqual(blob["r1"]?["advance50"], .bool(true))
    }

    func testLegacyWrappedOverridesShapeIsKept() {
        var blob = JSONValue.object(["overrides": .object([:])])
        _ = OpApplier.apply(.setPayment(seed: seed(), field: .payment100, value: true), to: &blob)
        XCTAssertNotNil(blob["overrides"]?["r1"])
    }

    func testScriptEditAppliesConflictsAndNoops() {
        var blob = JSONValue.object(["cards": .object(["c1": .object([
            "id": .string("c1"), "description": .string("base"), "updatedAt": .string("old"), "title": .string("T")])])])
        let ok = PendingOp.setCardScript(cardId: "c1", baseText: "base", newText: "mine", at: "now")
        XCTAssertEqual(OpApplier.apply(ok, to: &blob), .applied)
        XCTAssertEqual(blob["cards"]?["c1"]?["description"], .string("mine"))
        XCTAssertEqual(blob["cards"]?["c1"]?["title"], .string("T"))
        XCTAssertEqual(OpApplier.apply(ok, to: &blob), .noChange)

        blob["cards"]?["c1"]?["description"] = .string("theirs")
        let stale = PendingOp.setCardScript(cardId: "c1", baseText: "base", newText: "mine", at: "now")
        XCTAssertEqual(OpApplier.apply(stale, to: &blob), .conflict(remoteText: "theirs"))
        XCTAssertEqual(blob["cards"]?["c1"]?["description"], .string("theirs"), "a conflict must never overwrite remote text")
    }

    func testTodoAndCashOps() {
        var todos = JSONValue.object(["todos": .array([.object(["id": .string("t1"), "completed": .bool(false)])])])
        XCTAssertEqual(OpApplier.apply(.setTodoCompleted(todoId: "t1", completed: true, at: "n"), to: &todos), .applied)
        XCTAssertEqual(OpApplier.apply(.setTodoCompleted(todoId: "t1", completed: true, at: "n"), to: &todos), .noChange)
        XCTAssertEqual(OpApplier.apply(.setTodoCompleted(todoId: "nope", completed: true, at: "n"), to: &todos), .missingTarget)
        let newTodo = JSONValue.object(["id": .string("t2"), "title": .string("x")])
        XCTAssertEqual(OpApplier.apply(.addTodo(todo: newTodo), to: &todos), .applied)
        XCTAssertEqual(OpApplier.apply(.addTodo(todo: newTodo), to: &todos), .noChange)

        var cash = JSONValue.null
        let tx = JSONValue.object(["id": .string("x1"), "amount": .number(10)])
        XCTAssertEqual(OpApplier.apply(.addCashTransaction(tx: tx), to: &cash), .applied)
        XCTAssertEqual(OpApplier.apply(.addCashTransaction(tx: tx), to: &cash), .noChange)
        XCTAssertEqual(OpApplier.apply(.deleteCashTransaction(id: "x1"), to: &cash), .applied)
    }
}

final class BoardOpTests: XCTestCase {
    private func board() -> JSONValue {
        .object([
            "columns": .object([
                "a": .object(["id": .string("a"), "cardIds": .array([.string("c1")])]),
                "b": .object(["id": .string("b"), "cardIds": .array([])]),
            ]),
            "cards": .object(["c1": .object(["id": .string("c1"), "columnId": .string("a")])]),
        ])
    }

    func testMoveCardUpdatesBothColumnsAndCard() {
        var blob = board()
        XCTAssertEqual(OpApplier.apply(.moveCard(cardId: "c1", toColumnId: "b", at: "t"), to: &blob), .applied)
        XCTAssertEqual(blob["columns"]?["a"]?["cardIds"], .array([]))
        XCTAssertEqual(blob["columns"]?["b"]?["cardIds"], .array([.string("c1")]))
        XCTAssertEqual(blob["cards"]?["c1"]?["columnId"], .string("b"))
        XCTAssertEqual(OpApplier.apply(.moveCard(cardId: "c1", toColumnId: "b", at: "t"), to: &blob), .noChange)
    }

    func testAddCardAppendsToColumnOnce() {
        var blob = board()
        let card = RecordFactory.card(boardId: "x", columnId: "b", title: "New", script: "body", deliverableType: "Reel")
        XCTAssertEqual(OpApplier.apply(.addCard(card: card), to: &blob), .applied)
        XCTAssertEqual(blob["columns"]?["b"]?["cardIds"]?.arrayValue?.count, 1)
        XCTAssertEqual(OpApplier.apply(.addCard(card: card), to: &blob), .noChange)
        let missing = RecordFactory.card(boardId: "x", columnId: "zzz", title: "N", script: "", deliverableType: nil)
        XCTAssertEqual(OpApplier.apply(.addCard(card: missing), to: &blob), .missingTarget)
    }

    func testAddLocalRowPrependsAndDedupes() throws {
        var blob = JSONValue.null
        let row = RecordFactory.localRow(brand: "B", pnNo: "x1", deliverableLabels: ["1 reel"], poc: "Asha - Studio", goLiveDate: nil)
        let json = try JSONValue.from(row)
        XCTAssertEqual(OpApplier.apply(.addLocalRow(row: json), to: &blob), .applied)
        XCTAssertEqual(OpApplier.apply(.addLocalRow(row: json), to: &blob), .noChange)
        XCTAssertEqual(blob.arrayValue?.count, 1)
        XCTAssertEqual(row.pocName, "Asha")
    }
}

final class OfflineQueueTests: XCTestCase {
    func testQueueSurvivesRelaunchAndCoalescesScriptEdits() async {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("rmq-" + UUID().uuidString)
        let store = DiskStore(directory: dir)
        let q1 = OfflineQueue(store: store)
        _ = await q1.enqueue(.setCardScript(cardId: "c", baseText: "A", newText: "B", at: "1"))
        _ = await q1.enqueue(.setCardScript(cardId: "c", baseText: "B", newText: "C", at: "2"))
        let count = await q1.count
        XCTAssertEqual(count, 1)

        let q2 = OfflineQueue(store: store) // simulates app relaunch
        let ops = await q2.ops
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].op, .setCardScript(cardId: "c", baseText: "A", newText: "C", at: "2"),
                       "coalescing must keep the ORIGINAL server base so conflicts are still detected")
    }
}

final class InsightsTests: XCTestCase {
    func testPaymentStagesAndDeliveredUnpaid() {
        let done = DeliverableItem(label: "x", status: .completed)
        let a = DeliverableRow(id: "a", brand: "A", deliverables: [done], emailSent: true)
        let b = DeliverableRow(id: "b", brand: "B", deliverables: [done], emailSent: true, advance50: true)
        let c = DeliverableRow(id: "c", brand: "C", deliverables: [done], emailSent: true, advance50: true, payment100: true)
        let d = DeliverableRow(id: "d", brand: "D", deliverables: [DeliverableItem(label: "y")])
        let s = Finance.payments([a, b, c, d])
        XCTAssertEqual(s.awaitingAdvance.map(\.id), ["a"])
        XCTAssertEqual(s.awaitingBalance.map(\.id), ["b"])
        XCTAssertEqual(s.paid.map(\.id), ["c"])
        XCTAssertEqual(s.notInvoiced.map(\.id), ["d"])
        XCTAssertEqual(Set(s.deliveredUnpaid.map(\.id)), ["a", "b"])
    }

    func testAttentionOrdersOverdueFirst() {
        var ws = Workspace()
        ws.sheetRows = [
            DeliverableRow(id: "soon", brand: "Soon", deliverables: [DeliverableItem(label: "r")], goLiveDate: "2026-10-29"),
            DeliverableRow(id: "late", brand: "Late", deliverables: [DeliverableItem(label: "r")], goLiveDate: "2026-10-20"),
        ]
        let items = Insights.attention(ws, today: "2026-10-28")
        XCTAssertEqual(items.map(\.rowId), ["late", "soon"])
        XCTAssertEqual(items.first?.kind, .overdueGoLive)
    }

    func testCashSummary() {
        let json = #"[{"id":"1","amount":100,"type":"income","date":"2026-10-01"},{"id":"2","amount":30,"type":"expense","date":"2026-10-02"},{"id":"3","amount":5,"type":"expense","date":"2026-09-02"}]"#
        let txs = try! JSONDecoder().decode([CashTransaction].self, from: Data(json.utf8))
        XCTAssertEqual(Finance.cash(txs, month: "2026-10").balance, 70)
        XCTAssertEqual(Finance.cash(txs).expense, 35)
    }

    func testContactsDerivedAndDeduplicated() {
        let r1 = DeliverableRow(id: "1", brand: "A", poc: "Asha - Studio X asha@x.com", pocName: "Asha", pocCompany: "Studio X")
        let r2 = DeliverableRow(id: "2", brand: "B", poc: "Asha - Studio X", pocName: "asha", pocCompany: "studio x")
        let cs = Contacts.derive(from: [r1, r2])
        XCTAssertEqual(cs.count, 1)
        XCTAssertEqual(cs[0].rowIds, ["1", "2"])
        XCTAssertEqual(cs[0].email, "asha@x.com")
    }

    func testSearchSpansModules() {
        var ws = Workspace()
        ws.sheetRows = [DeliverableRow(id: "1", brand: "Samsung", invoiceNumber: "INV-7")]
        ws.scripts = []
        let hits = SearchIndex.search("samsung", in: ws)
        XCTAssertEqual(hits.first?.kind, .deliverable)
        XCTAssertEqual(SearchIndex.search("inv-7", in: ws).first?.kind, .payment)
        XCTAssertTrue(SearchIndex.search("s", in: ws).isEmpty)
    }
}

final class APIClientTests: XCTestCase {
    func testRequestCarriesBearerAndBaseVersionHeader() throws {
        let client = APIClient(baseURL: URL(string: "https://example.com")!, tokenProvider: { "tok" })
        let req = try client.urlRequest(HTTPRequest("POST", "api/sync/kanban", headers: ["X-Base-Updated-At": "none"], body: Data("{}".utf8)))
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
        XCTAssertEqual(req.value(forHTTPHeaderField: "X-Base-Updated-At"), "none")
        XCTAssertEqual(req.url?.absoluteString, "https://example.com/api/sync/kanban")
    }
}

final class OptimisticTests: XCTestCase {
    func testLocalApplyMatchesServerApplyForCompletion() throws {
        let seed = DeliverableRow(id: "r1", brand: "B", deliverables: [DeliverableItem(label: "reel")])
        let op = PendingOp.completeDeliverable(seed: seed, itemKey: "reel", url: nil, by: "me", at: "t")
        var ws = Workspace()
        ws.sheetRows = [seed]
        ws.applyLocally(op)
        XCTAssertEqual(ws.deliverables.first?.overallStatus, .awaitingPayment)

        var blob = JSONValue.object([:])
        _ = OpApplier.apply(op, to: &blob)
        let server = try XCTUnwrap(blob["r1"]).decode(DeliverableRow.self)
        XCTAssertEqual(server, ws.overrides["r1"])
    }

    func testJWTClaimsDecode() {
        // header.payload.signature with payload {"email":"a@b.c","name":"A","role":"admin","exp":4102444800}
        let payload = Data(#"{"email":"a@b.c","name":"A","role":"admin","exp":4102444800}"#.utf8)
            .base64EncodedString().replacingOccurrences(of: "=", with: "")
        let claims = SessionClaims.decode(token: "x.\(payload).y")
        XCTAssertEqual(claims?.email, "a@b.c")
        XCTAssertEqual(claims?.isAdmin, true)
        XCTAssertEqual(claims?.isExpired, false)
        XCTAssertNil(SessionClaims.decode(token: "garbage"))
    }
}
