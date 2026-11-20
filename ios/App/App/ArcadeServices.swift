import Capacitor
import FirebaseAnalytics
import FirebaseCore
import StoreKit
import UIKit

final class ArcadeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ArcadeServices())
    }
}

@objc(ArcadeServices)
final class ArcadeServices: CAPPlugin, CAPBridgedPlugin {
    private static var analyticsConfigured = false
    let identifier = "ArcadeServices"
    let jsName = "ArcadeServices"
    let pluginMethods = [
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "supportAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSupport", returnType: CAPPluginReturnPromise)
    ]

    static func configureAnalytics() {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let options = FirebaseOptions(contentsOfFile: path),
              options.bundleID == Bundle.main.bundleIdentifier else { return }
        FirebaseApp.configure(options: options)
        analyticsConfigured = true
    }

    @objc func logEvent(_ call: CAPPluginCall) {
        let events = ["screen_view", "game_start", "game_end", "unlock_achievement", "bmc_click"]
        guard let name = call.getString("name"), events.contains(name),
              Self.analyticsConfigured else {
            call.resolve(["recorded": false])
            return
        }
        Analytics.logEvent(name, parameters: call.getObject("parameters") ?? [:])
        call.resolve(["recorded": true])
    }

    @objc func supportAvailability(_ call: CAPPluginCall) {
        Task {
            let storefront = await Storefront.current
            call.resolve(["available": storefront?.countryCode == "USA"])
        }
    }

    @objc func openSupport(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let storefront = await Storefront.current, storefront.countryCode == "USA",
                  let link = URL(string: "https://www.buymeacoffee.com/davedushi") else {
                call.resolve(["opened": false])
                return
            }
            let opened = await UIApplication.shared.open(link)
            call.resolve(["opened": opened])
        }
    }
}
