import Foundation

public struct SyncEnvelope: Codable, Sendable, Equatable {
    public var data: JSONValue?
    public var updatedAt: String?
}

/// The sync keys the backend whitelists (`ALLOWED_KEYS` in /api/sync/[key]).
public enum SyncKey: String, Sendable, CaseIterable {
    case kanban, todos, reels, cash
    case priorityVideos = "priority-videos"
    case deliverableOverrides = "deliverable-overrides"
    case deliverableLocalRows = "deliverable-local-rows"
    case deliverableHidden = "deliverable-hidden"
}

public struct Reminder: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var deliverableId: String
    public var deliverableLabel: String
    public var brand: String
    public var date: String
    public var time: String
    public var sent: Bool
}
struct RemindersResponse: Decodable { let reminders: [Reminder] }

/// Every backend call the app makes. Keeps paths/headers in one place.
public struct Backend: Sendable {
    public let client: APIClient
    public init(client: APIClient) { self.client = client }

    // Auth (unauthenticated)
    public func signIn(passcode: String, email: String?) async throws -> AuthResponse {
        struct Body: Encodable { let passcode: String; let email: String? }
        let body = try APIClient.jsonBody(Body(passcode: passcode, email: email))
        return try await client.send(HTTPRequest("POST", "api/mobile/auth", body: body))
    }

    public func googleAuthURL() async throws -> URL {
        struct R: Decodable { let url: String }
        let r: R = try await client.send(HTTPRequest("GET", "api/mobile/oauth/init"))
        guard let url = URL(string: r.url) else { throw APIError.decoding("oauth url") }
        return url
    }

    // Deliverables sheet
    public func sheetDeliverables() async throws -> [DeliverableRow] {
        let r: DeliverablesResponse = try await client.send(HTTPRequest("GET", "api/deliverables"))
        return r.deliverables
    }

    // Sync blobs
    public func readSync(_ key: SyncKey) async throws -> SyncEnvelope {
        try await client.send(HTTPRequest("GET", "api/sync/\(key.rawValue)"))
    }

    /// Writes with optimistic concurrency. Throws `.conflict` if the blob moved on.
    public func writeSync(_ key: SyncKey, data: JSONValue, baseUpdatedAt: String?) async throws -> String {
        struct Ack: Decodable { let updatedAt: String }
        let body = try JSONEncoder().encode(data)
        let r: Ack = try await client.send(HTTPRequest(
            "POST", "api/sync/\(key.rawValue)",
            headers: ["X-Base-Updated-At": baseUpdatedAt ?? "none"], body: body))
        return r.updatedAt
    }

    // Scripts inbox
    public func scripts() async throws -> [InboxScript] {
        let r: ScriptsResponse = try await client.send(HTTPRequest("GET", "api/scripts"))
        return r.scripts
    }

    public func setScriptStatus(id: String, docId: String?, approved: Bool) async throws {
        struct Body: Encodable { let status: String; let docId: String? }
        let body = try APIClient.jsonBody(Body(status: approved ? "approved" : "pending", docId: docId))
        _ = try await client.data(for: HTTPRequest("PATCH", "api/scripts/\(id)", body: body))
    }

    // Reminders (admin)
    public func reminders() async throws -> [Reminder] {
        let r: RemindersResponse = try await client.send(HTTPRequest("GET", "api/reminders"))
        return r.reminders
    }

    // Push
    public func registerAPNs(token: String, production: Bool) async throws {
        struct Body: Encodable { let token: String; let env: String }
        let body = try APIClient.jsonBody(Body(token: token, env: production ? "production" : "sandbox"))
        _ = try await client.data(for: HTTPRequest("POST", "api/push/apns", body: body))
    }
}
