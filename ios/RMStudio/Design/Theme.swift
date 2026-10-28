import SwiftUI
import UIKit

/// RM Studio design language: warm paper / ink neutrals, one vermilion accent,
/// serif display titles, tight 4-pt spacing scale, 16–20 pt radii.
enum RM {
    enum Space { static let xs: CGFloat = 4, s: CGFloat = 8, m: CGFloat = 12, l: CGFloat = 16, xl: CGFloat = 24, xxl: CGFloat = 32 }
    enum Radius { static let s: CGFloat = 10, m: CGFloat = 16, l: CGFloat = 22 }

    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    static let canvas = dynamic(light: 0xF5F3EE, dark: 0x0C0C0F)
    static let surface = dynamic(light: 0xFFFFFF, dark: 0x17171C)
    static let surfaceRaised = dynamic(light: 0xFBFAF7, dark: 0x1F1F26)
    static let hairline = dynamic(light: 0xE4E0D7, dark: 0x2A2A33)
    static let ink = dynamic(light: 0x16161A, dark: 0xF3F1EC)
    static let inkSecondary = dynamic(light: 0x6B6860, dark: 0x9A97A0)
    static let accent = dynamic(light: 0xE8472A, dark: 0xFF6A4A)
    static let positive = dynamic(light: 0x1F8F5F, dark: 0x3CC98A)
    static let caution = dynamic(light: 0xB7791F, dark: 0xF0B84A)
    static let info = dynamic(light: 0x2F6FDE, dark: 0x6FA2FF)
    static let alert = dynamic(light: 0xC53030, dark: 0xFF7A7A)

    static func display(_ size: CGFloat = 34) -> Font { .system(size: size, weight: .semibold, design: .serif) }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

extension Color {
    init(hexString: String) {
        let s = hexString.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        self = Color(UIColor(hex: UInt32(s, radix: 16) ?? 0x7C3AED))
    }
}

enum Haptics {
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
}

// MARK: - Components

struct RMCard<Content: View>: View {
    var padding: CGFloat = RM.Space.l
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RM.surface, in: RoundedRectangle(cornerRadius: RM.Radius.m, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: RM.Radius.m, style: .continuous).stroke(RM.hairline, lineWidth: 1))
    }
}

struct StatusPill: View {
    let text: String
    let tint: Color
    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .foregroundStyle(tint)
            .background(tint.opacity(0.14), in: Capsule())
            .accessibilityLabel(text)
    }
}

struct SectionHeader: View {
    let title: String
    var trailing: String?
    var body: some View {
        HStack {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(RM.inkSecondary).textCase(.uppercase).tracking(0.6)
            Spacer()
            if let trailing { Text(trailing).font(.footnote).foregroundStyle(RM.inkSecondary) }
        }
        .accessibilityAddTraits(.isHeader)
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?
    var body: some View {
        VStack(spacing: RM.Space.m) {
            Image(systemName: icon).font(.system(size: 34, weight: .light)).foregroundStyle(RM.inkSecondary)
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(RM.inkSecondary).multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action).buttonStyle(.borderedProminent).tint(RM.accent)
            }
        }
        .padding(RM.Space.xxl)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

struct MetricTile: View {
    let value: Int
    let label: String
    var tint: Color = RM.ink
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)").font(.system(size: 28, weight: .semibold, design: .rounded)).monospacedDigit().foregroundStyle(tint)
                .contentTransition(.numericText())
            Text(label).font(.footnote).foregroundStyle(RM.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

extension OverallStatus {
    var tint: Color {
        switch self {
        case .pending: RM.inkSecondary
        case .inProgress: RM.caution
        case .awaitingPayment: RM.info
        case .done: RM.positive
        }
    }
}

extension View {
    func rmScreen() -> some View {
        self.background(RM.canvas.ignoresSafeArea()).scrollContentBackground(.hidden)
    }
}

func formatINR(_ n: Double) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_IN")
    f.numberStyle = .currency
    f.currencyCode = "INR"
    f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: n)) ?? "₹\(Int(n))"
}

func shortDate(_ iso: String?) -> String {
    guard let iso, let d = ISTCalendarBridge.date(iso) else { return "" }
    return d.formatted(.dateTime.day().month(.abbreviated))
}
