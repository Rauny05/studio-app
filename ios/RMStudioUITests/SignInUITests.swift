import XCTest

final class SignInUITests: XCTestCase {
    func testSignedOutLaunchShowsSignIn() {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing-signed-out"]
        app.launch()
        XCTAssertTrue(app.buttons["signIn.continue"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["signIn.google"].exists)
    }
}
