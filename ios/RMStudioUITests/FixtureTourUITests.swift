import XCTest

/// Walks every tab against the DEBUG fixture workspace and saves a screenshot per screen.
/// Steps are soft: a missing element is logged to notes.txt instead of aborting the tour,
/// so one wrong selector doesn't hide the other screens.
final class FixtureTourUITests: XCTestCase {
    private var app: XCUIApplication!
    private var notes: [String] = []
    private var dir: URL?

    override func setUp() {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing-fixture"]
        app.launch()
        if let path = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            dir = URL(fileURLWithPath: path)
            try? FileManager.default.createDirectory(at: dir!, withIntermediateDirectories: true)
        }
    }

    override func tearDown() {
        if let dir { try? notes.joined(separator: "\n").write(to: dir.appendingPathComponent("notes.txt"), atomically: true, encoding: .utf8) }
    }

    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir { try? screenshot.pngRepresentation.write(to: dir.appendingPathComponent(name + ".png")) }
    }

    @discardableResult private func tap(_ element: XCUIElement, _ what: String, wait: TimeInterval = 4) -> Bool {
        guard element.waitForExistence(timeout: wait) else { notes.append("MISSING: \(what)"); return false }
        // Coordinate tap avoids the flaky "scroll to visible" accessibility action on toolbar items.
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        usleep(400_000)
        return true
    }

    private func back() {
        app.navigationBars.buttons.element(boundBy: 0).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        usleep(500_000)
    }
    private func tab(_ name: String) { tap(app.tabBars.buttons[name], "tab \(name)") }
    private func segment(_ prefix: String) {
        tap(app.segmentedControls.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch, "segment \(prefix)")
    }

    func testTour() {
        XCTAssertTrue(app.tabBars.buttons["Home"].waitForExistence(timeout: 15), "fixture workspace should skip sign-in")
        sleep(1)
        shot("01-home")
        app.swipeUp(); shot("02-home-scrolled"); app.swipeDown()

        // Search
        if tap(app.buttons["Search workspace"], "search button") {
            let field = app.searchFields.firstMatch
            if field.waitForExistence(timeout: 4) { field.tap(); field.typeText("samsung"); sleep(1) }
            shot("03-search")
            tap(app.buttons["Close"], "search close"); sleep(1)
        }

        // Quick actions → new script form
        if tap(app.buttons["Quick actions"], "quick actions menu") {
            shot("04-quick-actions")
            tap(app.buttons["New script"], "menu: New script")
            sleep(1); shot("05-new-script-form")
            tap(app.buttons["Cancel"], "form cancel")
        }

        // Production
        tab("Production"); sleep(1); shot("06-production-deliverables")
        if tap(app.staticTexts["Samsung Galaxy S26"], "row Samsung") {
            sleep(1); shot("07-deliverable-detail")
            if tap(app.buttons["Complete"].firstMatch, "Complete button") {
                sleep(1); shot("08-completion-sheet")
                if tap(app.buttons["Mark complete"], "Mark complete") { sleep(1); shot("09-completion-done") }
                tap(app.buttons["Close"], "completion close")
            }
            sleep(1); shot("10-detail-after-complete")
            back()
        }
        segment("Boards"); sleep(1); shot("11-boards")
        if tap(app.staticTexts["Studio Content"], "board row") { sleep(1); shot("12-board-stage"); back() }

        // Scripts
        tab("Scripts"); sleep(1); shot("13-scripts-library")
        if tap(app.staticTexts["My full morning routine"], "script row") {
            sleep(1); shot("14-script-editor")
            let editor = app.textViews["Script text"]
            if editor.waitForExistence(timeout: 4) { editor.tap(); editor.typeText(" Edited on device.") ; sleep(2); shot("15-script-editing") }
            back()
        }
        segment("Inbox"); sleep(1); shot("16-scripts-inbox")
        if tap(app.staticTexts["Samsung S26 launch reel scripts"], "inbox row") { sleep(1); shot("17-inbox-detail"); back() }

        // Finance
        tab("Finance"); sleep(1); shot("18-finance-payments")
        segment("Cash"); sleep(1); shot("19-finance-cash")

        // More
        tab("More"); sleep(1); shot("20-more")
        if tap(app.buttons["Tasks"], "Tasks") { sleep(1); shot("21-tasks"); back() }
        if tap(app.buttons["Contacts"], "Contacts") {
            sleep(1); shot("22-contacts")
            if tap(app.staticTexts["Priya Nair"], "contact row") { sleep(1); shot("23-contact-detail"); back() }
            back()
        }
        if tap(app.buttons["Settings & sync"], "Settings") { sleep(1); shot("24-settings") }
    }
}
