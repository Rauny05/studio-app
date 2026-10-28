import SwiftUI
import AuthenticationServices
import RMStudioKit

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var passcode = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?
    private enum Field { case email, passcode }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RM.Space.xl) {
                VStack(alignment: .leading, spacing: RM.Space.s) {
                    Text("RM Studio").font(RM.display(44))
                    Text("Production, scripts and payments in one place.")
                        .font(.title3).foregroundStyle(RM.inkSecondary)
                }
                .padding(.top, 72)

                VStack(spacing: RM.Space.m) {
                    Button { Task { await run { try await model.signInWithGoogle() } } } label: {
                        Label("Continue with Google", systemImage: "person.crop.circle")
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .accessibilityIdentifier("signIn.google")

                    HStack { Rectangle().fill(RM.hairline).frame(height: 1); Text("or access code").font(.footnote).foregroundStyle(RM.inkSecondary); Rectangle().fill(RM.hairline).frame(height: 1) }

                    TextField("Email (optional)", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                        .autocorrectionDisabled().focused($focus, equals: .email).submitLabel(.next)
                        .onSubmit { focus = .passcode }
                        .padding(RM.Space.m).background(RM.surface, in: RoundedRectangle(cornerRadius: RM.Radius.s))
                    SecureField("Access code", text: $passcode)
                        .textContentType(.password).focused($focus, equals: .passcode).submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                        .padding(RM.Space.m).background(RM.surface, in: RoundedRectangle(cornerRadius: RM.Radius.s))

                    Button { Task { await submit() } } label: {
                        Group { if busy { ProgressView() } else { Text("Continue") } }
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.bordered).controlSize(.large)
                    .disabled(passcode.isEmpty || busy)
                    .accessibilityIdentifier("signIn.continue")
                }

                if let error {
                    Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(RM.alert)
                        .accessibilityLabel("Error: \(error)")
                }
            }
            .padding(.horizontal, RM.Space.xl)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .rmScreen()
    }

    private func submit() async { await run { try await model.signIn(passcode: passcode, email: email) } }

    private func run(_ work: () async throws -> Void) async {
        busy = true; error = nil
        defer { busy = false }
        do { try await work(); Haptics.success() }
        catch is CancellationError { }
        catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin { }
        catch { self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription; Haptics.warning() }
    }
}
