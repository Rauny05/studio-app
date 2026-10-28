// swift-tools-version: 5.10
import PackageDescription

// Foundation-only domain layer: models, API client, sync, offline queue and
// business logic. No UIKit/SwiftUI so it can be unit-tested with `swift test`.
let package = Package(
    name: "RMStudioKit",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [.library(name: "RMStudioKit", targets: ["RMStudioKit"])],
    targets: [
        .target(name: "RMStudioKit"),
        .testTarget(name: "RMStudioKitTests", dependencies: ["RMStudioKit"]),
    ]
)
