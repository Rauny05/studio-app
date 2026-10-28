import Foundation
import RMStudioKit

enum ISTCalendarBridge {
    static func date(_ ymd: String) -> Date? { ISTCalendar.date(from: ymd) }
}

extension Date {
    static func fromISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}
