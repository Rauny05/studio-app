#if DEBUG
import Foundation
import RMStudioKit

/// Debug-only sample workspace for simulator tours and screenshots (`-ui-testing-fixture`).
/// Compiled out of Release builds, so it can never ship in the IPA.
enum Fixtures {
    static var isActive: Bool { CommandLine.arguments.contains("-ui-testing-fixture") }

    private static func day(_ offset: Int) -> String {
        let base = ISTCalendar.date(from: ISTCalendar.today()) ?? Date()
        return ISTCalendar.dateString(Calendar.current.date(byAdding: .day, value: offset, to: base) ?? base)
    }

    private static func json(_ text: String) -> JSONValue {
        (try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))) ?? .null
    }

    static func workspace() -> Workspace {
        var ws = Workspace()
        let done = { (label: String) in
            DeliverableItem(label: label, status: .completed, completedAt: "2026-10-20T10:00:00.000Z",
                            completedBy: "raunaq@rmmedia.in", publishedUrl: "https://instagram.com/reel/demo")
        }
        ws.sheetRows = [
            DeliverableRow(id: "oc26-1", pnNo: "oc26-1", brand: "Samsung Galaxy S26",
                           deliverables: [DeliverableItem(label: "2 IG reels"), DeliverableItem(label: "1 story")],
                           poc: "Priya Nair - Momentum priya@momentum.example", pocName: "Priya Nair", pocCompany: "Momentum",
                           emailSent: true, month: "Oct 2026", goLiveDate: day(-2)),
            DeliverableRow(id: "oc26-2", pnNo: "oc26-2", brand: "vivo X Fold6",
                           deliverables: [DeliverableItem(label: "1 IG reel"), DeliverableItem(label: "1 YouTube video")],
                           poc: "Arjun Mehta - Studio X +91 98765 43210", pocName: "Arjun Mehta", pocCompany: "Studio X",
                           month: "Oct 2026", goLiveDate: day(0)),
            DeliverableRow(id: "oc26-3", pnNo: "oc26-3", brand: "Nothing Phone (3a)",
                           deliverables: [done("1 IG reel")], poc: "Priya Nair - Momentum", pocName: "Priya Nair", pocCompany: "Momentum",
                           emailSent: true, advance50: true, invoiceNumber: "INV-1042", month: "Oct 2026", goLiveDate: day(-9)),
            DeliverableRow(id: "oc26-4", pnNo: "oc26-4", brand: "boAt Airdopes",
                           deliverables: [done("1 IG reel"), done("1 post")], poc: "Kabir Shah - Reach", pocName: "Kabir Shah", pocCompany: "Reach",
                           emailSent: true, advance50: true, payment100: true, invoiceNumber: "INV-0988", month: "Sep 2026"),
            DeliverableRow(id: "oc26-5", pnNo: "oc26-5", brand: "OnePlus Nord 6",
                           deliverables: [DeliverableItem(label: "1 IG reel")], poc: "Arjun Mehta - Studio X", pocName: "Arjun Mehta",
                           pocCompany: "Studio X", month: "Oct 2026", goLiveDate: day(1)),
        ]
        ws.kanban = json("""
        {"boards":[{"id":"b1","title":"Studio Content","description":"","color":"#e8472a","emoji":"🎬","columnIds":["c1","c2","c3","c4"]}],
         "columns":{
           "c1":{"id":"c1","title":"Ideas","cardIds":["k1"]},
           "c2":{"id":"c2","title":"Writing","cardIds":["k2","k3"]},
           "c3":{"id":"c3","title":"Production","cardIds":["k4"]},
           "c4":{"id":"c4","title":"Published","cardIds":[]}},
         "cards":{
           "k1":{"id":"k1","boardId":"b1","columnId":"c1","title":"Why 90% of creators quit","description":"# Hook\\nMost creators quit within 6 months. Here's why that's actually great news for you...","deliverableType":"Reel","tags":[],"priority":"high","dueDate":"\(day(3))","notes":"","createdAt":"2026-10-01T00:00:00.000Z","updatedAt":"2026-10-26T09:00:00.000Z"},
           "k2":{"id":"k2","boardId":"b1","columnId":"c2","title":"My full morning routine","description":"# Intro\\nWake up at 5am, cold shower, journaling, deep work block.\\n\\n# Main Content\\n## Point 1\\nSleep is the foundation.\\n\\n# CTA\\nSubscribe for the full breakdown.","deliverableType":"YouTube","tags":[],"priority":"medium","dueDate":"\(day(6))","notes":"B-roll of desk setup","createdAt":"2026-10-02T00:00:00.000Z","updatedAt":"2026-10-27T15:30:00.000Z"},
           "k3":{"id":"k3","boardId":"b1","columnId":"c2","title":"10 Figma tips you're missing","description":"","deliverableType":"Short","tags":[],"priority":"medium","dueDate":null,"notes":"","createdAt":"2026-10-03T00:00:00.000Z","updatedAt":"2026-10-03T00:00:00.000Z"},
           "k4":{"id":"k4","boardId":"b1","columnId":"c3","title":"Rebrand in 48 hours","description":"Time-lapse with narration of the full rebrand process. Add sponsor segment at 4:30.","deliverableType":"YouTube","tags":[],"priority":"high","dueDate":"\(day(1))","notes":"","createdAt":"2026-10-04T00:00:00.000Z","updatedAt":"2026-10-25T12:00:00.000Z"}}}
        """)
        ws.todos = json("""
        {"todos":[
          {"id":"t1","title":"Send Samsung invoice follow-up","completed":false,"createdBy":"raunaq@rmmedia.in","updatedAt":"2026-10-27T09:00:00.000Z"},
          {"id":"t2","title":"Export vivo reel in 4K","completed":false,"createdBy":"raunaq@rmmedia.in","updatedAt":"2026-10-27T09:00:00.000Z"},
          {"id":"t3","title":"Book Friday shoot location","completed":true,"createdBy":"raunaq@rmmedia.in","updatedAt":"2026-10-26T09:00:00.000Z"}]}
        """)
        ws.cash = json("""
        {"categories":["Salary","Food","Travel","Bills","Misc"],
         "transactions":[
          {"id":"x1","amount":85000,"type":"income","category":"Salary","note":"Retainer: Momentum","date":"\(day(0))","time":"09:00","createdAt":"2026-10-28T09:00:00.000Z"},
          {"id":"x2","amount":2200,"type":"expense","category":"Travel","note":"Cab to shoot","date":"\(day(0))","time":"11:00","createdAt":"2026-10-28T11:00:00.000Z"},
          {"id":"x3","amount":4500,"type":"expense","category":"Bills","note":"Studio internet","date":"\(day(0))","time":"10:15","createdAt":"2026-10-28T10:15:00.000Z"}]}
        """)
        if let data = """
        [{"id":"s1","title":"Samsung S26 launch reel scripts","sender_name":"Priya Nair","sender_email":"priya@momentum.example",
          "received_at":"2026-10-27T08:00:00.000Z","status":"pending",
          "docs":[{"id":"s1-d1","name":"Reel 1: camera hook","doc_url":"https://docs.google.com/document/d/demo1","status":"pending"},
                  {"id":"s1-d2","name":"Reel 2: battery","doc_url":"https://docs.google.com/document/d/demo2","status":"approved"}]}]
        """.data(using: .utf8), let scripts = try? JSONDecoder().decode([InboxScript].self, from: data) {
            ws.scripts = scripts
        }
        ws.refreshedAt = Date()
        return ws
    }
}
#endif
