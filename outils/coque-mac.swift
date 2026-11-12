// Dérush — la fenêtre native de l'app Mac (Contents/MacOS/Derush).
//
// Dérush est un programme Node (un petit serveur local, 127.0.0.1) et une interface web. Jusqu'à la version 7, cette
// interface s'ouvrait dans une fenêtre de Chrome. Ici, Dérush est une vraie app Mac : son icône dans le Dock, ses
// menus, sa fenêtre, les boîtes de dialogue du système, et les fichiers glissés depuis le Finder arrivent avec leur
// vrai chemin (plus besoin de les chercher sur le disque, ni de les copier).
//
// Ce programme :
//   1. ouvre sa fenêtre tout de suite (écran d'attente) ;
//   2. lance le serveur (Resources/lanceur.sh, qui trouve Node) et lit son adresse sur sa sortie (DERUSH_URL=…) ;
//   3. affiche l'interface dans une vue WebKit, qui ne peut aller nulle part ailleurs que sur cette adresse locale ;
//   4. demande à l'interface d'enregistrer, puis arrête le serveur quand on quitte.
//
// Ce que la page peut demander (window.webkit.messageHandlers) :
//   derush         {a: 'teinte', couleur}, {a: 'attention'}, {a: 'progression', p}, {a: 'copier', texte}, {a: 'ouvrir', url},
//                  {a: 'quitter'}
//   derushDemande  {a: 'choisir', invite, depart, dossiers, plusieurs} → la liste des chemins choisis
//                  {a: 'coller'} → le texte du presse-papiers (sur un clic de la personne)
//
// Essais automatiques : avec DERUSH_COQUE_PILOTE=<dossier>, un fichier « commande.json » {id, js?, capture?, fermer?}
// posé dans ce dossier est exécuté dans la page ; la réponse est écrite dans « reponse-<id>.json » (voir demarrerPilote).
//
// Compilation (faite par « node derush.mjs construire-app » si outils/coque-mac manque) :
//   swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -o coque-arm64 outils/coque-mac.swift
//   swiftc -O -swift-version 5 -target x86_64-apple-macos13.0 -o coque-x86_64 outils/coque-mac.swift
//   lipo -create coque-arm64 coque-x86_64 -output outils/coque-mac
import Cocoa
import WebKit

let COULEUR_FOND = NSColor(srgbRed: 0x12 / 255.0, green: 0x12 / 255.0, blue: 0x14 / 255.0, alpha: 1)
let CHEMIN_JOURNAL = NSString(string: "~/Library/Logs/Dérush.log").expandingTildeInPath

/// « #18181b » → couleur.
func couleurHex(_ hex: String) -> NSColor? {
  var s = hex.trimmingCharacters(in: .whitespaces)
  if s.hasPrefix("#") { s.removeFirst() }
  guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
  return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
}

/// Un texte ou une liste, écrits comme une valeur JavaScript sûre.
func js(_ valeur: Any) -> String {
  guard let d = try? JSONSerialization.data(withJSONObject: valeur, options: [.fragmentsAllowed]), let s = String(data: d, encoding: .utf8) else { return "null" }
  return s.replacingOccurrences(of: "\u{2028}", with: "\\u2028").replacingOccurrences(of: "\u{2029}", with: "\\u2029")
}

/// L'écran d'attente : visible le temps que le serveur démarre (moins d'une seconde).
let PAGE_ATTENTE = """
<!doctype html><html lang="fr"><meta charset="utf-8"><style>
html,body{height:100%;margin:0;background:#121214;color:#f5f5f7;font:15px -apple-system,system-ui;-webkit-user-select:none;cursor:default;overflow:hidden}
body{display:grid;place-items:center}
.c{display:grid;justify-items:center;gap:20px;animation:a .5s cubic-bezier(.22,.8,.24,1) both}
h1{margin:0;font:800 46px/1 -apple-system,system-ui;letter-spacing:-.03em}
h1 i{font-style:normal;background:linear-gradient(118deg,#ffb340,#ff7a3c 52%,#ff453a);-webkit-background-clip:text;color:transparent}
.b{width:190px;height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.b i{display:block;width:40%;height:100%;border-radius:4px;background:linear-gradient(90deg,#ffb340,#ff453a);animation:g 1.1s ease-in-out infinite}
p{margin:0;color:#a1a1a8}
@keyframes g{0%{transform:translateX(-110%)}100%{transform:translateX(270%)}}
@keyframes a{from{opacity:0;transform:translateY(8px)}}
</style><div class="c"><h1>Dé<i>rush</i></h1><div class="b"><i></i></div><p>Ouverture…</p></div>
"""

/// La vue web de Dérush : elle transmet à la page le chemin des fichiers glissés, et n'a pas de menu de navigateur.
final class VueDerush: WKWebView {
  /// WebKit donne à la page les fichiers glissés, mais pas leur chemin : on le lui dit juste avant le dépôt.
  private func noterDepot(_ info: NSDraggingInfo) {
    let urls = info.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL] ?? []
    guard !urls.isEmpty else { return }
    evaluateJavaScript("window.__derushDepot = {chemins: \(js(urls.map { $0.path })), t: Date.now()};", completionHandler: nil)
  }
  override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
    noterDepot(sender)
    return super.draggingEntered(sender)
  }
  override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
    noterDepot(sender)
    return super.performDragOperation(sender)
  }
  /// Le menu du clic droit ne garde que ce qui sert dans un champ de texte (couper, copier, coller, orthographe).
  override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
    let aRetirer = ["WKMenuItemIdentifierReload", "WKMenuItemIdentifierGoBack", "WKMenuItemIdentifierGoForward", "WKMenuItemIdentifierStop",
      "WKMenuItemIdentifierOpenLinkInNewWindow", "WKMenuItemIdentifierDownloadLinkedFile", "WKMenuItemIdentifierOpenImageInNewWindow", "WKMenuItemIdentifierDownloadImage",
      "WKMenuItemIdentifierOpenMediaInNewWindow", "WKMenuItemIdentifierDownloadMedia", "WKMenuItemIdentifierOpenFrameInNewWindow", "WKMenuItemIdentifierOpenLink",
      "WKMenuItemIdentifierShowHideMediaControls", "WKMenuItemIdentifierToggleEnhancedFullScreen", "WKMenuItemIdentifierToggleFullScreen", "WKMenuItemIdentifierTogglePictureInPicture",
      "WKMenuItemIdentifierCopyLink", "WKMenuItemIdentifierShareMenu", "WKMenuItemIdentifierSearchWeb", "WKMenuItemIdentifierLookUp", "WKMenuItemIdentifierTranslate"]
    for element in menu.items where aRetirer.contains(element.identifier?.rawValue ?? "") { menu.removeItem(element) }
    while let dernier = menu.items.last, dernier.isSeparatorItem { menu.removeItem(dernier) }
    while let premier = menu.items.first, premier.isSeparatorItem { menu.removeItem(premier) }
    super.willOpenMenu(menu, with: event)
  }
}

final class Coque: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
  var fenetre: NSWindow!
  var vue: VueDerush!
  var serveur: Process?
  var entree: Pipe?              // l'entrée du serveur : quand la coque s'arrête, elle se ferme et le serveur s'arrête aussi
  var adresse: URL?              // http://127.0.0.1:4321/
  var emprunte = false           // un Dérush tournait déjà : on affiche le sien
  var codeErreur: String?        // « node », « ffmpeg »… dit par le lanceur
  var pagePrete = false
  var quitte = false
  var questionPosee = false
  var reponseAttendue = false    // macOS attend notre réponse (extinction, fermeture de session)
  var veille: Timer?             // fenêtre fermée pendant un travail : on attend qu'il finisse
  var reste = ""
  var dernieresLignes: [String] = []
  var fichiersAOuvrir: [String] = []
  var observation: NSKeyValueObservation?
  var avance: NSProgressIndicator?
  let journal: FileHandle? = {
    let dossier = (CHEMIN_JOURNAL as NSString).deletingLastPathComponent
    try? FileManager.default.createDirectory(atPath: dossier, withIntermediateDirectories: true)
    if !FileManager.default.fileExists(atPath: CHEMIN_JOURNAL) { FileManager.default.createFile(atPath: CHEMIN_JOURNAL, contents: nil) }
    let f = FileHandle(forWritingAtPath: CHEMIN_JOURNAL)
    f?.seekToEndOfFile()
    return f
  }()

  // ——— Démarrage ———
  func applicationDidFinishLaunching(_ notification: Notification) {
    construireMenus()
    construireFenetre()
    // le réseau de WebKit démarre dès maintenant (pendant que le moteur se lance) : la première page arrive plus vite
    WKWebsiteDataStore.default().httpCookieStore.getAllCookies { _ in }
    // l'écran d'attente se présente comme une page du moteur local : WebKit garde alors le même processus pour
    // l'interface (sinon il en relance un, et l'ouverture prend une demi-seconde de plus)
    vue.loadHTMLString(PAGE_ATTENTE, baseURL: URL(string: "http://127.0.0.1/"))
    fenetre.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    lancerServeur()
    demarrerPilote()
  }

  // ——— Essais : piloter l'app sans la regarder ———
  var pilote: Timer?
  var derniereCommande = -1
  func demarrerPilote() {
    guard let dossier = ProcessInfo.processInfo.environment["DERUSH_COQUE_PILOTE"], !dossier.isEmpty else { return }
    // pendant les essais, la fenêtre est souvent derrière une autre : WebKit ne doit pas mettre ses animations en pause
    let reglage = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
    if vue.responds(to: reglage) { vue.perform(reglage, with: nil) }
    pilote = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { [weak self] _ in
      guard let s = self else { return }
      let fichier = dossier + "/commande.json"
      guard let donnees = FileManager.default.contents(atPath: fichier), let c = (try? JSONSerialization.jsonObject(with: donnees)) as? [String: Any],
        let id = c["id"] as? Int, id != s.derniereCommande else { return }
      if !s.pagePrete && c["sans_page"] == nil { return } // la page n'est pas encore là : la commande attend
      s.derniereCommande = id
      try? FileManager.default.removeItem(atPath: fichier)
      let ecrire: (Any) -> Void = { valeur in
        let reponse: [String: Any] = ["id": id, "resultat": JSONSerialization.isValidJSONObject([valeur]) ? valeur : "\(valeur)",
          "fenetre": ["titre": s.fenetre.title, "visible": s.fenetre.isVisible, "largeur": s.fenetre.frame.width, "hauteur": s.fenetre.frame.height, "page": s.vue.url?.absoluteString ?? ""]]
        let d = (try? JSONSerialization.data(withJSONObject: reponse)) ?? Data("{}".utf8)
        try? d.write(to: URL(fileURLWithPath: dossier + "/reponse-\(id).json"))
      }
      let capturer: (@escaping () -> Void) -> Void = { suite in
        guard let nom = c["capture"] as? String else { return suite() }
        s.vue.takeSnapshot(with: nil) { image, _ in
          if let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) { try? png.write(to: URL(fileURLWithPath: nom)) }
          suite()
        }
      }
      if c["fermer"] as? Bool == true { ecrire("fermeture demandée"); s.demanderAQuitter(); return }
      if let code = c["js"] as? String {
        s.vue.callAsyncJavaScript(code, arguments: [:], in: nil, in: .page) { r in
          var valeur: Any = NSNull()
          switch r {
          case .success(let x): valeur = x
          case .failure(let e): valeur = ["erreur": "\(e)"]
          }
          capturer { ecrire(valeur) }
        }
      } else { capturer { ecrire(NSNull()) } }
    }
  }
  func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool { true }

  func construireFenetre() {
    let ecran = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1480, height: 920)
    let taille = NSSize(width: min(1480, ecran.width), height: min(920, ecran.height))
    fenetre = NSWindow(contentRect: NSRect(origin: .zero, size: taille), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    fenetre.title = "Dérush"
    fenetre.titlebarAppearsTransparent = true
    fenetre.backgroundColor = COULEUR_FOND
    fenetre.appearance = NSAppearance(named: .darkAqua)
    fenetre.minSize = NSSize(width: 1040, height: 660)
    fenetre.isReleasedWhenClosed = false
    fenetre.tabbingMode = .disallowed
    fenetre.collectionBehavior = [.fullScreenPrimary]
    fenetre.delegate = self
    fenetre.center()
    fenetre.setFrameAutosaveName("DerushFenetre")

    let conf = WKWebViewConfiguration()
    conf.mediaTypesRequiringUserActionForPlayback = []
    conf.applicationNameForUserAgent = "Derush/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0")"
    if ProcessInfo.processInfo.environment["DERUSH_DEV"] == "1" { conf.preferences.setValue(true, forKey: "developerExtrasEnabled") }
    conf.userContentController.add(self, name: "derush")
    conf.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "derushDemande")
    conf.userContentController.addUserScript(WKUserScript(source: "window.__derushNatif = {systeme: 'mac', version: 1};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    vue = VueDerush(frame: NSRect(origin: .zero, size: taille), configuration: conf)
    vue.navigationDelegate = self
    vue.uiDelegate = self
    vue.allowsBackForwardNavigationGestures = false
    vue.allowsMagnification = false
    vue.setValue(false, forKey: "drawsBackground") // pas d'éclair blanc entre deux pages
    vue.underPageBackgroundColor = COULEUR_FOND
    vue.autoresizingMask = [.width, .height]
    fenetre.contentView = vue
    // le titre de la fenêtre suit celui de la page (« Mon projet — Dérush »)
    observation = vue.observe(\.title, options: [.new]) { [weak self] _, changement in
      let t = (changement.newValue ?? nil) ?? ""
      self?.fenetre.title = t.isEmpty ? "Dérush" : t
    }
  }

  /// Le serveur : Resources/lanceur.sh trouve Node, puis laisse sa place à « node derush.mjs --coque ».
  func lancerServeur() {
    guard let ressources = Bundle.main.resourcePath else { return erreurFatale("Dérush est incomplet", "Le dossier de l’application est introuvable. Réinstalle Dérush.") }
    var arguments: [String] = []
    var sauter = false
    for a in CommandLine.arguments.dropFirst() {
      if sauter { sauter = false; continue }
      if a.hasPrefix("-psn_") { continue }
      if a.hasPrefix("-NS") || a.hasPrefix("-Apple") { sauter = true; continue } // options de macOS, suivies de leur valeur
      arguments.append(a)
    }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/zsh")
    p.arguments = [ressources + "/lanceur.sh"] + arguments
    var env = ProcessInfo.processInfo.environment
    env["DERUSH_COQUE"] = "1"
    env["DERUSH_APP_BUNDLE"] = Bundle.main.bundlePath
    p.environment = env
    let sortie = Pipe()
    let ent = Pipe()
    p.standardOutput = sortie
    p.standardError = sortie
    p.standardInput = ent
    sortie.fileHandleForReading.readabilityHandler = { [weak self] h in
      let d = h.availableData
      if d.isEmpty { h.readabilityHandler = nil; return }
      self?.journal?.write(d)
      let texte = String(decoding: d, as: UTF8.self)
      DispatchQueue.main.async { self?.lireSortie(texte) }
    }
    p.terminationHandler = { [weak self] fini in
      DispatchQueue.main.async { self?.serveurArrete(fini.terminationStatus) }
    }
    do { try p.run() } catch { return erreurFatale("Dérush n’a pas pu démarrer", error.localizedDescription) }
    serveur = p
    entree = ent
  }

  func lireSortie(_ texte: String) {
    reste += texte
    var lignes = reste.components(separatedBy: "\n")
    reste = lignes.removeLast()
    for l in lignes {
      let ligne = l.trimmingCharacters(in: .whitespacesAndNewlines)
      if ligne.isEmpty { continue }
      if ligne.hasPrefix("DERUSH_URL="), let u = URL(string: String(ligne.dropFirst(11))) {
        adresse = u
        vue.load(URLRequest(url: u))
      } else if ligne == "DERUSH_DEJA=1" { emprunte = true }
      else if ligne.hasPrefix("DERUSH_ERREUR=") { codeErreur = String(ligne.dropFirst(14)) }
      else {
        dernieresLignes.append(ligne)
        if dernieresLignes.count > 8 { dernieresLignes.removeFirst() }
      }
    }
  }

  func serveurArrete(_ code: Int32) {
    serveur = nil
    if quitte { return }
    if emprunte && code == 0 { return } // le lanceur a trouvé un Dérush déjà ouvert : c'est lui qu'on affiche
    if adresse == nil {
      switch codeErreur {
      case "node":
        erreurFatale("Dérush a besoin de Node.js", "Node.js est le moteur de Dérush. Installe-le (la version « LTS », un clic), puis rouvre Dérush.", bouton: "Ouvrir nodejs.org", lien: "https://nodejs.org/fr/download")
      case "ffmpeg":
        erreurFatale("Dérush a besoin de FFmpeg", "FFmpeg lit et fabrique les vidéos. Le guide d’installation de Dérush explique comment l’ajouter, puis rouvre Dérush.", bouton: "Ouvrir ffmpeg.org", lien: "https://ffmpeg.org/download.html")
      default:
        erreurFatale("Dérush n’a pas pu démarrer", (dernieresLignes.isEmpty ? "Le moteur de Dérush s’est arrêté tout de suite." : dernieresLignes.joined(separator: "\n")) + "\n\nLe détail est dans le journal (menu Aide › Journal de Dérush).")
      }
    } else {
      // le serveur s'est arrêté : bouton « Quitter » de l'interface, mise à jour, ou panne
      quitte = true
      NSApp.terminate(nil)
    }
  }

  func erreurFatale(_ titre: String, _ texte: String, bouton: String? = nil, lien: String? = nil) {
    let a = NSAlert()
    a.alertStyle = .warning
    a.messageText = titre
    a.informativeText = texte
    if let b = bouton { a.addButton(withTitle: b) }
    a.addButton(withTitle: "Quitter")
    let r = a.runModal()
    if bouton != nil, r == .alertFirstButtonReturn, let l = lien, let u = URL(string: l) { NSWorkspace.shared.open(u) }
    quitte = true
    NSApp.terminate(nil)
  }

  // ——— Menus ———
  func construireMenus() {
    let barre = NSMenu()
    func menu(_ titre: String, _ remplir: (NSMenu) -> Void) {
      let entreeMenu = NSMenuItem()
      let m = NSMenu(title: titre)
      remplir(m)
      entreeMenu.submenu = m
      barre.addItem(entreeMenu)
    }
    func page(_ m: NSMenu, _ titre: String, _ action: String, _ touche: String = "", _ modif: NSEvent.ModifierFlags = [.command]) {
      let e = NSMenuItem(title: titre, action: #selector(actionPage(_:)), keyEquivalent: touche)
      e.keyEquivalentModifierMask = modif
      e.representedObject = action
      e.target = self
      m.addItem(e)
    }
    func systeme(_ m: NSMenu, _ titre: String, _ action: Selector, _ touche: String = "", _ modif: NSEvent.ModifierFlags = [.command]) {
      let e = NSMenuItem(title: titre, action: action, keyEquivalent: touche)
      e.keyEquivalentModifierMask = modif
      m.addItem(e)
    }
    menu("Dérush") { m in
      systeme(m, "À propos de Dérush", #selector(aPropos(_:)))
      m.items.last?.target = self
      m.addItem(.separator())
      page(m, "Réglages…", "reglages", ",")
      page(m, "Connexions…", "connexions")
      m.addItem(.separator())
      systeme(m, "Masquer Dérush", #selector(NSApplication.hide(_:)), "h")
      systeme(m, "Masquer les autres", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option])
      systeme(m, "Tout afficher", #selector(NSApplication.unhideAllApplications(_:)))
      m.addItem(.separator())
      systeme(m, "Quitter Dérush", #selector(NSApplication.terminate(_:)), "q")
    }
    menu("Fichier") { m in
      page(m, "Nouveau projet…", "nouveau", "n")
      page(m, "Bibliothèque de projets", "bibliotheque", "o", [.command, .shift])
      m.addItem(.separator())
      page(m, "Importer des médias…", "importer", "i")
      page(m, "Créer la vidéo…", "creer-video", "e")
      page(m, "Analyser la viralité…", "viralite", "l", [.command, .shift])
      page(m, "Partager…", "partager", "p", [.command, .shift])
      m.addItem(.separator())
      page(m, "Afficher le dossier du projet", "dossier")
      m.addItem(.separator())
      systeme(m, "Fermer", #selector(NSWindow.performClose(_:)), "w")
    }
    menu("Édition") { m in
      systeme(m, "Annuler", Selector(("undo:")), "z")
      systeme(m, "Rétablir", Selector(("redo:")), "z", [.command, .shift])
      m.addItem(.separator())
      systeme(m, "Couper", #selector(NSText.cut(_:)), "x")
      systeme(m, "Copier", #selector(NSText.copy(_:)), "c")
      systeme(m, "Coller", #selector(NSText.paste(_:)), "v")
      systeme(m, "Tout sélectionner", #selector(NSText.selectAll(_:)), "a")
    }
    menu("Présentation") { m in
      page(m, "Demander à l’IA", "ia", "k")
      m.addItem(.separator())
      page(m, "Tout voir dans la timeline", "tout-voir")
      m.addItem(.separator())
      systeme(m, "Plein écran", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control])
    }
    menu("Fenêtre") { m in
      systeme(m, "Réduire", #selector(NSWindow.performMiniaturize(_:)), "m")
      systeme(m, "Zoom", #selector(NSWindow.performZoom(_:)))
      NSApp.windowsMenu = m
    }
    menu("Aide") { m in
      page(m, "Tutoriel de Dérush", "tutoriel")
      page(m, "Raccourcis clavier", "aide", "?")
      m.addItem(.separator())
      systeme(m, "Journal de Dérush", #selector(ouvrirJournal(_:)))
      m.items.last?.target = self
      NSApp.helpMenu = m
    }
    NSApp.mainMenu = barre
  }
  /// Un menu qui agit dans l'interface : la page reçoit le nom de l'action.
  @objc func actionPage(_ sender: NSMenuItem) {
    guard pagePrete, let action = sender.representedObject as? String else { return }
    montrerFenetre()
    vue.evaluateJavaScript("window.derush?.menu?.(\(js(action)))", completionHandler: nil)
  }
  @objc func aPropos(_ sender: Any?) {
    NSApp.orderFrontStandardAboutPanel(options: [
      .credits: NSAttributedString(string: "Le montage vidéo avec ton IA.\nDérush par IABAI — association YABAÏ.", attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]),
    ])
  }
  @objc func ouvrirJournal(_ sender: Any?) { NSWorkspace.shared.open(URL(fileURLWithPath: CHEMIN_JOURNAL)) }

  // ——— La page ———
  func estLocale(_ url: URL) -> Bool {
    guard let a = adresse else { return false }
    return url.scheme == "http" && url.host == a.host && url.port == a.port
  }
  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
    if url.scheme == "about" || estLocale(url) { return decisionHandler(.allow) }
    // tout le reste (un lien vers un site) s'ouvre dans le navigateur de la personne, jamais dans Dérush
    if ["http", "https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
    decisionHandler(.cancel)
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard let u = webView.url, estLocale(u) else { return }
    pagePrete = true
    if !fichiersAOuvrir.isEmpty { donnerFichiers() }
  }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    guard adresse != nil, !quitte else { return }
    // le serveur n'écoute pas encore tout à fait : on réessaie une fois
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
      guard let s = self, let a = s.adresse, !s.pagePrete else { return }
      s.vue.load(URLRequest(url: a))
    }
  }
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    // la page a planté : on la recharge, le projet est enregistré côté serveur
    if let a = adresse { webView.load(URLRequest(url: a)) }
  }
  /// window.open et les liens « nouvelle fenêtre » : dans le navigateur de la personne.
  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = navigationAction.request.url, ["http", "https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
    return nil
  }
  func webViewDidClose(_ webView: WKWebView) { demanderAQuitter() }

  // les boîtes de dialogue de la page deviennent celles du Mac
  func decouper(_ message: String) -> (String, String) {
    for separateur in [" ? ", " ! ", ". ", "\n"] {
      if let r = message.range(of: separateur) {
        return (String(message[..<r.upperBound]).trimmingCharacters(in: .whitespacesAndNewlines), String(message[r.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines))
      }
    }
    return (message, "")
  }
  func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
    let a = NSAlert()
    (a.messageText, a.informativeText) = decouper(message)
    a.addButton(withTitle: "OK")
    a.beginSheetModal(for: fenetre) { _ in completionHandler() }
  }
  func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
    let a = NSAlert()
    (a.messageText, a.informativeText) = decouper(message)
    a.addButton(withTitle: "OK")
    a.addButton(withTitle: "Annuler")
    a.beginSheetModal(for: fenetre) { r in completionHandler(r == .alertFirstButtonReturn) }
  }
  func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
    let a = NSAlert()
    (a.messageText, a.informativeText) = decouper(prompt)
    let champ = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
    champ.stringValue = defaultText ?? ""
    a.accessoryView = champ
    a.addButton(withTitle: "OK")
    a.addButton(withTitle: "Annuler")
    a.window.initialFirstResponder = champ
    a.beginSheetModal(for: fenetre) { r in completionHandler(r == .alertFirstButtonReturn ? champ.stringValue : nil) }
  }
  /// <input type="file"> : la fenêtre « Ouvrir » du Mac.
  func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let p = NSOpenPanel()
    p.allowsMultipleSelection = parameters.allowsMultipleSelection
    p.canChooseDirectories = parameters.allowsDirectories
    p.canChooseFiles = true
    p.prompt = "Choisir"
    p.beginSheetModal(for: fenetre) { r in completionHandler(r == .OK ? p.urls : nil) }
  }

  // ——— Ce que la page demande ———
  func deLaPage(_ message: WKScriptMessage) -> [String: Any]? {
    guard message.frameInfo.isMainFrame, let u = message.frameInfo.request.url, estLocale(u) else { return nil }
    return message.body as? [String: Any]
  }
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let d = deLaPage(message), let a = d["a"] as? String else { return }
    switch a {
    case "teinte":
      if let c = (d["couleur"] as? String).flatMap(couleurHex) { fenetre.backgroundColor = c }
    case "attention":
      if !NSApp.isActive { NSApp.requestUserAttention(.informationalRequest) }
    case "progression":
      montrerProgression(d["p"] as? Double)
    case "copier":
      if let t = d["texte"] as? String { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(t, forType: .string) }
    case "ouvrir":
      if let s = d["url"] as? String, let u = URL(string: s), ["http", "https", "mailto"].contains(u.scheme ?? "") { NSWorkspace.shared.open(u) }
    case "quitter":
      demanderAQuitter()
    default: break
    }
  }
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
    guard let d = deLaPage(message), let a = d["a"] as? String else { return replyHandler(nil, "demande refusée") }
    switch a {
    case "choisir":
      let p = NSOpenPanel()
      let dossiers = d["dossiers"] as? Bool ?? false
      p.canChooseDirectories = dossiers
      p.canChooseFiles = !dossiers
      p.allowsMultipleSelection = d["plusieurs"] as? Bool ?? !dossiers
      p.canCreateDirectories = dossiers
      p.prompt = dossiers ? "Choisir ce dossier" : "Importer"
      if let invite = d["invite"] as? String { p.message = invite }
      if let depart = d["depart"] as? String, !depart.isEmpty { p.directoryURL = URL(fileURLWithPath: depart) }
      else if !dossiers { p.directoryURL = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask).first }
      p.beginSheetModal(for: fenetre) { r in replyHandler(r == .OK ? p.urls.map { $0.path } : [String](), nil) }
    case "coller":
      // le presse-papiers n'est lu que sur un clic de la personne (« Coller ma clé »)
      replyHandler(NSPasteboard.general.string(forType: .string) ?? "", nil)
    default:
      replyHandler(nil, "demande inconnue")
    }
  }
  /// L'avancement d'un rendu, sur l'icône du Dock.
  func montrerProgression(_ p: Double?) {
    let dock = NSApp.dockTile
    guard let p = p, p >= 0, p < 1 else {
      dock.contentView = nil
      avance = nil
      dock.display()
      return
    }
    if avance == nil {
      let image = NSImageView(frame: NSRect(x: 0, y: 0, width: 128, height: 128))
      image.image = NSApp.applicationIconImage
      let barre = NSProgressIndicator(frame: NSRect(x: 14, y: 6, width: 100, height: 14))
      barre.style = .bar
      barre.isIndeterminate = false
      barre.minValue = 0
      barre.maxValue = 1
      image.addSubview(barre)
      dock.contentView = image
      avance = barre
    }
    avance?.doubleValue = p
    dock.display()
  }

  // ——— Des fichiers posés sur l'icône de Dérush ———
  func application(_ sender: NSApplication, openFiles filenames: [String]) {
    fichiersAOuvrir += filenames
    if pagePrete { donnerFichiers() }
    sender.reply(toOpenOrPrint: .success)
  }
  func donnerFichiers() {
    let chemins = fichiersAOuvrir
    fichiersAOuvrir = []
    montrerFenetre()
    vue.evaluateJavaScript("window.derush?.ouvrirFichiers?.(\(js(chemins)))", completionHandler: nil)
  }

  // ——— Fermer, quitter ———
  func montrerFenetre() {
    veille?.invalidate()
    veille = nil
    fenetre.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }
  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    montrerFenetre()
    return false
  }
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
  func windowShouldClose(_ sender: NSWindow) -> Bool {
    demanderAQuitter()
    return false
  }
  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    if quitte || !pagePrete { arreterServeur(); return .terminateNow }
    reponseAttendue = true
    demanderAQuitter()
    return .terminateLater
  }
  func repondre(_ oui: Bool) {
    if reponseAttendue { reponseAttendue = false; NSApp.reply(toApplicationShouldTerminate: oui) }
  }
  /// La page enregistre, puis dit si un travail est en cours (un rendu, l'IA qui monte…).
  func demanderAQuitter() {
    if questionPosee { return }
    guard pagePrete else { return quitterPourDeBon() }
    questionPosee = true
    var repondu = false
    let suite: (Bool) -> Void = { [weak self] occupe in
      guard let s = self, !repondu else { return }
      repondu = true
      s.questionPosee = false
      if !occupe { return s.quitterPourDeBon() }
      s.montrerFenetre()
      let a = NSAlert()
      a.messageText = "Dérush travaille encore"
      a.informativeText = "Un traitement est en cours (un rendu, ou ton IA qui monte). Tu peux le laisser finir : la fenêtre se ferme, et Dérush se quitte tout seul à la fin."
      a.addButton(withTitle: "Laisser finir")
      a.addButton(withTitle: "Quitter maintenant")
      a.addButton(withTitle: "Annuler")
      a.beginSheetModal(for: s.fenetre) { r in
        if r == .alertFirstButtonReturn { s.repondre(false); s.laisserFinir() }
        else if r == .alertSecondButtonReturn { s.quitterPourDeBon() }
        else { s.repondre(false) }
      }
    }
    vue.callAsyncJavaScript("return await window.derush.avantDeQuitter()", arguments: [:], in: nil, in: .page) { resultat in
      if case .success(let v) = resultat, let d = v as? [String: Any] { suite(d["occupe"] as? Bool ?? false) } else { suite(false) }
    }
    // la page ne répond pas (bloquée) : on n'attend pas plus de 2,5 s
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { suite(false) }
  }
  /// La fenêtre se ferme, le travail continue ; Dérush se quitte quand il est fini (ou revient si on clique sur son icône).
  func laisserFinir() {
    fenetre.orderOut(nil)
    veille?.invalidate()
    veille = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
      guard let s = self, let a = s.adresse, let u = URL(string: "api/ping", relativeTo: a) else { return }
      var demande = URLRequest(url: u)
      demande.timeoutInterval = 2
      URLSession.shared.dataTask(with: demande) { donnees, _, _ in
        let d = donnees.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
        let occupe = d?["occupe"] as? Bool ?? false
        DispatchQueue.main.async {
          guard let s = self, s.veille != nil, !occupe else { return }
          s.quitterPourDeBon()
        }
      }.resume()
    }
  }
  func arreterServeur() {
    entree?.fileHandleForWriting.closeFile()
    entree = nil
    if let p = serveur, p.isRunning { p.terminate() }
  }
  func quitterPourDeBon() {
    if quitte { return }
    quitte = true
    veille?.invalidate()
    veille = nil
    // un Dérush emprunté (lancé ailleurs) s'arrête par sa propre porte ; le nôtre reçoit le signal d'arrêt
    if emprunte && pagePrete { vue.evaluateJavaScript("window.derush?.eteindre?.()", completionHandler: nil) }
    arreterServeur()
    DispatchQueue.main.asyncAfter(deadline: .now() + (emprunte ? 0.5 : 0.15)) { [weak self] in
      guard let s = self else { return }
      if s.reponseAttendue { s.repondre(true) } else { NSApp.terminate(nil) }
    }
  }
  func applicationWillTerminate(_ notification: Notification) { arreterServeur() }
}

let application = NSApplication.shared
let coque = Coque()
application.delegate = coque
application.setActivationPolicy(.regular)
application.run()
