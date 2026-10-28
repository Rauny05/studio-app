import Foundation

enum AppTab: String, CaseIterable, Hashable {
    case home, production, scripts, finance, more
}

/// Typed navigation destinations shared by every tab, search and deep links.
enum Route: Hashable {
    case deliverable(String)
    case board(String)
    case card(String)       // production card
    case script(String)     // script editor for a card
    case inboxScript(String)
    case contact(String)
    case tasks
    case contacts
    case settings
}

enum DeepLink {
    /// rmstudio://deliverable/<id> · card/<id> · script/<id> · board/<id> · contact/<id> · payments · tasks
    static func parse(_ url: URL) -> (AppTab, Route?)? {
        guard url.scheme == "rmstudio", let host = url.host(percentEncoded: false), host != "auth" else { return nil }
        let id = url.pathComponents.dropFirst().first
        switch host {
        case "deliverable": return id.map { (.production, .deliverable($0)) }
        case "board": return id.map { (.production, .board($0)) }
        case "card": return id.map { (.production, .card($0)) }
        case "script": return id.map { (.scripts, .script($0)) }
        case "inbox": return id.map { (.scripts, .inboxScript($0)) }
        case "contact": return id.map { (.more, .contact($0)) }
        case "payments": return (.finance, nil)
        case "tasks": return (.more, .tasks)
        case "home": return (.home, nil)
        default: return nil
        }
    }
}
