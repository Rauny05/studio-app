import SwiftUI
import AuthenticationServices
import UserNotifications
import RMStudioKit

/// Runs the Google OAuth round-trip through the backend and returns the app token from `rmstudio://auth?token=…`.
@MainActor
enum WebAuthRunner {
    private final class Anchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
        }
    }
    private static let anchor = Anchor()
    private static var current: ASWebAuthenticationSession?

    static func run(url: URL, callbackScheme: String) async throws -> String {
        try await withCheckedThrowingContinuation { cont in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callback, error in
                if let error { cont.resume(throwing: error); return }
                let items = callback.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems } ?? []
                if let token = items.first(where: { $0.name == "token" })?.value { cont.resume(returning: token) }
                else {
                    let reason = items.first(where: { $0.name == "error" })?.value ?? "cancelled"
                    cont.resume(throwing: GoogleSignInError(reason: reason))
                }
            }
            session.presentationContextProvider = anchor
            session.prefersEphemeralWebBrowserSession = false
            current = session
            if !session.start() { cont.resume(throwing: GoogleSignInError(reason: "could not start")) }
        }
    }
}

struct GoogleSignInError: LocalizedError {
    let reason: String
    var errorDescription: String? {
        switch reason {
        case "unauthorized": "This Google account isn't on the RM Studio allow-list."
        case "cancelled": "Sign-in cancelled."
        default: "Google sign-in failed (\(reason))."
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var onPushToken: ((Data) -> Void)?
    var onOpenURL: ((URL) -> Void)?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if let s = response.notification.request.content.userInfo["url"] as? String, let url = URL(string: s) {
            await MainActor.run { onOpenURL?(url) }
        }
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        onPushToken?(deviceToken)
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Expected without the Push Notifications capability (free developer account). Local reminders still work.
    }
}

/// Local reminders derived from synced data. They are rescheduled on every refresh, so they are only as
/// fresh as the last sync; server-driven APNs delivery is a separate backend capability (see README).
enum NotificationScheduler {
    private static let prefix = "rm."

    static func reschedule(workspace: Workspace, goLive: Bool, payments: Bool) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let ours = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: ours)
            var requests: [UNNotificationRequest] = []
            let today = ISTCalendar.today()

            if goLive {
                for r in workspace.deliverables {
                    guard let day = r.goLiveDate, r.deliverables.contains(where: { $0.status == .pending }),
                          let n = ISTCalendar.days(from: today, to: day), n >= 0, n <= 14 else { continue }
                    let pendingCount = r.deliverables.filter { $0.status == .pending }.count
                    let body = "\(pendingCount) deliverable\(pendingCount == 1 ? "" : "s") pending"
                    if let at = fire(day: day, hour: 9, minute: 0) {
                        requests.append(make("\(prefix)live.\(r.id)", "\(r.brand) goes live today", body, at, r.id))
                    }
                    if let prior = ISTCalendar.date(from: day).flatMap({ Calendar.current.date(byAdding: .day, value: -1, to: $0) }),
                       let at = fire(day: ISTCalendar.dateString(prior), hour: 18, minute: 0) {
                        requests.append(make("\(prefix)eve.\(r.id)", "\(r.brand) goes live tomorrow", body, at, r.id))
                    }
                }
            }
            if payments {
                let unpaid = workspace.deliverables.filter { $0.overallStatus == .awaitingPayment }
                if !unpaid.isEmpty {
                    let tomorrow = ISTCalendar.date(from: today).flatMap { Calendar.current.date(byAdding: .day, value: 1, to: $0) }
                    if let t = tomorrow, let at = fire(day: ISTCalendar.dateString(t), hour: 10, minute: 0) {
                        requests.append(make("\(prefix)payments", "Payments to follow up",
                                             "\(unpaid.count) project\(unpaid.count == 1 ? "" : "s") delivered, not fully paid", at, nil))
                    }
                }
            }
            for r in requests.filter({ $0.trigger != nil }) { center.add(r) }
        }
    }

    private static func fire(day: String, hour: Int, minute: Int) -> DateComponents? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = DateComponents()
        c.timeZone = ISTCalendar.zone
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]; c.hour = hour; c.minute = minute
        guard let date = Calendar(identifier: .gregorian).date(from: c), date > Date() else { return nil }
        return c
    }

    private static func make(_ id: String, _ title: String, _ body: String, _ at: DateComponents, _ rowId: String?) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if let rowId { content.userInfo = ["url": "rmstudio://deliverable/\(rowId)"] }
        return UNNotificationRequest(identifier: id, content: content,
                                     trigger: UNCalendarNotificationTrigger(dateMatching: at, repeats: false))
    }
}
