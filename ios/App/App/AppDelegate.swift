import UIKit
import Capacitor
import WebKit

// Keep normal scrolling and keyboard accommodation, without elastic page movement.
private final class GNSGuardMessageHandler: NSObject, WKScriptMessageHandler {
    weak var controller: GNSBridgeViewController?
    init(_ controller: GNSBridgeViewController) { self.controller = controller }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == "localhost",
              let body = message.body as? [String: Any],
              let enabled = body["enabled"] as? Bool else { return }
        controller?.setNutritionProtected(enabled)
    }
}

class GNSBridgeViewController: CAPBridgeViewController {
    private var nutritionProtected = false
    private var inactive = false
    private var privacyCover: UIView?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.configuration.userContentController.add(GNSGuardMessageHandler(self), name: "gnsContentGuard")
        NotificationCenter.default.addObserver(self, selector: #selector(captureChanged), name: UIScreen.capturedDidChangeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resignActive), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(becomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(screenshotTaken), name: UIApplication.userDidTakeScreenshotNotification, object: nil)
        guard let scrollView = webView?.scrollView else { return }
        scrollView.bounces = false
        scrollView.alwaysBounceHorizontal = false
        scrollView.alwaysBounceVertical = false
        scrollView.isDirectionalLockEnabled = true
    }

    func setNutritionProtected(_ enabled: Bool) {
        nutritionProtected = enabled
        updatePrivacyCover()
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('gns-guard-ready'))", completionHandler: nil)
    }
    @objc private func captureChanged() { updatePrivacyCover() }
    @objc private func resignActive() { inactive = true; updatePrivacyCover() }
    @objc private func becomeActive() { inactive = false; updatePrivacyCover() }
    @objc private func screenshotTaken() {
        // UIKit reports a still screenshot AFTER capture. This is a reminder, not a blocking claim.
        if nutritionProtected { webView?.evaluateJavaScript("window.dispatchEvent(new Event('gns-screenshot'))", completionHandler: nil) }
    }
    private func updatePrivacyCover() {
        let captured = view.window?.screen.isCaptured ?? UIScreen.main.isCaptured
        guard inactive || (nutritionProtected && captured) else {
            privacyCover?.removeFromSuperview(); privacyCover = nil; return
        }
        if privacyCover != nil { return }
        let cover = UIView(frame: view.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = UIColor(red: 0.05, green: 0.09, blue: 0.06, alpha: 1)
        let label = UILabel()
        label.text = inactive ? "GNS FITNESS" : "GNS FITNESS\n\nPara leer este contenido, detené la grabación o duplicación de pantalla."
        label.textColor = UIColor(red: 0.84, green: 0.70, blue: 0.42, alpha: 1)
        label.font = .systemFont(ofSize: 18, weight: .medium)
        label.textAlignment = .center; label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        cover.addSubview(label)
        NSLayoutConstraint.activate([label.centerYAnchor.constraint(equalTo: cover.centerYAnchor), label.leadingAnchor.constraint(equalTo: cover.leadingAnchor, constant: 28), label.trailingAnchor.constraint(equalTo: cover.trailingAnchor, constant: -28)])
        view.addSubview(cover); privacyCover = cover
    }
    deinit { NotificationCenter.default.removeObserver(self) }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
