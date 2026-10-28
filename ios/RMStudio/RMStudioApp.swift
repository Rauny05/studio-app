import SwiftUI
import RMStudioKit

@main
struct RMStudioApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(RM.accent)
                .onOpenURL { model.handle(url: $0) }
                .onAppear {
                    delegate.onPushToken = { model.registerPushToken($0) }
                    delegate.onOpenURL = { model.handle(url: $0) }
                    if model.isSignedIn { model.syncNow() }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active, model.isSignedIn { model.syncNow() }
                }
        }
    }
}
