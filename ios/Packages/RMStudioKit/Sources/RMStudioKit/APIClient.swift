import Foundation

public enum APIError: Error, Equatable, LocalizedError, Sendable {
    case unauthorized
    case forbidden
    case conflict(Data?)
    case sheetPrivate
    case server(status: Int, message: String)
    case offline
    case decoding(String)
    case cancelled

    public var errorDescription: String? {
        switch self {
        case .unauthorized: "Your session expired. Sign in again."
        case .forbidden: "You don't have permission to do that."
        case .conflict: "This changed on another device."
        case .sheetPrivate: "The deliverables Google Sheet isn't shared with the server."
        case .server(let status, let message): "Server error \(status): \(message)"
        case .offline: "You're offline."
        case .decoding(let m): "Unexpected response: \(m)"
        case .cancelled: "Cancelled."
        }
    }

    public var isTransient: Bool {
        switch self {
        case .offline: true
        case .server(let status, _): status >= 500 || status == 429
        default: false
        }
    }
}

public struct HTTPRequest: Sendable {
    public var method: String
    public var path: String
    public var query: [URLQueryItem] = []
    public var headers: [String: String] = [:]
    public var body: Data?

    public init(_ method: String, _ path: String, query: [URLQueryItem] = [],
                headers: [String: String] = [:], body: Data? = nil) {
        self.method = method; self.path = path; self.query = query; self.headers = headers; self.body = body
    }
}

/// Typed JSON client for the RM Studio backend. Never logs tokens or bodies.
public final class APIClient: @unchecked Sendable {
    public let baseURL: URL
    private let session: URLSession
    private let tokenProvider: @Sendable () -> String?
    private let onUnauthorized: @Sendable () -> Void
    private let maxAttempts: Int

    public init(baseURL: URL,
                session: URLSession = .shared,
                maxAttempts: Int = 3,
                tokenProvider: @escaping @Sendable () -> String?,
                onUnauthorized: @escaping @Sendable () -> Void = {}) {
        self.baseURL = baseURL
        self.session = session
        self.maxAttempts = maxAttempts
        self.tokenProvider = tokenProvider
        self.onUnauthorized = onUnauthorized
    }

    func urlRequest(_ r: HTTPRequest) throws -> URLRequest {
        guard var comps = URLComponents(url: baseURL.appendingPathComponent(r.path), resolvingAgainstBaseURL: false) else {
            throw APIError.decoding("bad url")
        }
        if !r.query.isEmpty { comps.queryItems = r.query }
        guard let url = comps.url else { throw APIError.decoding("bad url") }
        var req = URLRequest(url: url)
        req.httpMethod = r.method
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = tokenProvider() { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body = r.body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        for (k, v) in r.headers { req.setValue(v, forHTTPHeaderField: k) }
        return req
    }

    /// Raw send with retry. Only idempotent methods (GET) are retried automatically;
    /// writes are retried by the offline queue, which owns idempotency.
    public func data(for r: HTTPRequest) async throws -> Data {
        let req = try urlRequest(r)
        let attempts = r.method == "GET" ? maxAttempts : 1
        var lastError: APIError = .offline
        for attempt in 0..<attempts {
            if attempt > 0 {
                let delay = UInt64(pow(2.0, Double(attempt - 1)) * 400_000_000)
                try? await Task.sleep(nanoseconds: delay)
            }
            do {
                let (data, response) = try await session.data(for: req)
                guard let http = response as? HTTPURLResponse else { throw APIError.offline }
                switch http.statusCode {
                case 200..<300: return data
                case 401:
                    onUnauthorized()
                    throw APIError.unauthorized
                case 403:
                    if let o = try? JSONDecoder().decode([String: JSONValue].self, from: data),
                       o["error"]?.stringValue == "sheet_private" { throw APIError.sheetPrivate }
                    throw APIError.forbidden
                case 409: throw APIError.conflict(data)
                default:
                    let message = (try? JSONDecoder().decode([String: JSONValue].self, from: data))?["error"]?.stringValue ?? "request failed"
                    throw APIError.server(status: http.statusCode, message: message)
                }
            } catch let e as APIError {
                lastError = e
                if !e.isTransient { throw e }
            } catch is CancellationError {
                throw APIError.cancelled
            } catch let e as URLError {
                if e.code == .cancelled { throw APIError.cancelled }
                lastError = .offline
            } catch {
                lastError = .offline
            }
        }
        throw lastError
    }

    public func send<T: Decodable>(_ r: HTTPRequest, as type: T.Type = T.self) async throws -> T {
        let data = try await data(for: r)
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIError.decoding(String(describing: type)) }
    }

    public static func jsonBody<T: Encodable>(_ value: T) throws -> Data { try JSONEncoder().encode(value) }
}
