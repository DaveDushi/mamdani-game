import Capacitor
import StoreKit
import UIKit

final class ArcadeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ArcadeServices())
    }
}

@objc(ArcadeServices)
final class ArcadeServices: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ArcadeServices"
    let jsName = "ArcadeServices"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "supportAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSupport", returnType: CAPPluginReturnPromise)
    ]

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
