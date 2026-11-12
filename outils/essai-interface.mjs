// Dérush — essai de l'interface sans fenêtre (pour qui modifie Dérush) : pilote Chrome par son protocole de débogage.
//
// 1. Lance un serveur d'essai sur une copie de projet, sans toucher à la vraie bibliothèque :
//      DERUSH_BIBLIOTHEQUE=<dossier d'essai> DERUSH_SANS_NAVIGATEUR=1 node derush.mjs <projet> --port 4334
//    (il ajoute ce projet à recents.json, partagé avec la vraie app : sauvegarde ce fichier avant, remets-le après)
// 2. node outils/essai-interface.mjs http://127.0.0.1:4334/ etapes.json [largeur] [hauteur]
//
// etapes.json est une liste d'étapes :
//   {"js": "expression", "dire": "nom"}   évalue du JavaScript dans la page (et affiche le résultat si « dire »)
//   {"clic": "sélecteur CSS"}             clique au milieu de l'élément (il est d'abord amené à l'écran)
//   {"touche": "Backspace"}               appuie sur une touche
//   {"attendre": 500}                     attend (millisecondes)
//   {"jusqua": "expression", "max": 15000} attend que l'expression soit vraie
//   {"capture": "chemin.png"}             capture la fenêtre
// La page expose window.derush : aller(t), lire(), pause(), temps(), ajouterEffet(modele, t), selectionner(id), projet(), style().
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [url, fichierEtapes, largeur = '1480', hauteur = '920'] = process.argv.slice(2);
const etapes = JSON.parse(fs.readFileSync(fichierEtapes, 'utf8'));
const ICI = process.env.TMPDIR || '/tmp';
const PORT = 9341;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--hide-scrollbars', `--user-data-dir=${path.join(ICI, 'derush-essai-chrome')}`, '--force-device-scale-factor=1', `--window-size=${largeur},${hauteur}`,
  // un faux micro et une fausse caméra, acceptés sans question : pour essayer « Enregistrer » sans matériel
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, url,
], {stdio: 'ignore'});
try {
  let ws;
  for (let i = 0; i < 80 && !ws; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      ws = pages.find((x) => x.type === 'page' && x.url.startsWith(url))?.webSocketDebuggerUrl;
    } catch {}
    if (!ws) await attendre(250);
  }
  if (!ws) throw new Error('Chrome ne répond pas');
  const sock = new WebSocket(ws);
  await new Promise((ok, ko) => { sock.onopen = ok; sock.onerror = ko; });
  let n = 0;
  const attente = new Map();
  const erreurs = [];
  sock.onmessage = (m) => {
    const j = JSON.parse(m.data);
    if (j.id && attente.has(j.id)) { attente.get(j.id)(j); attente.delete(j.id); }
    if (j.method === 'Runtime.exceptionThrown') erreurs.push(j.params.exceptionDetails.exception?.description ?? j.params.exceptionDetails.text);
    if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') erreurs.push(j.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const cdp = (method, params = {}) => new Promise((ok, ko) => {
    const id = ++n;
    attente.set(id, (j) => (j.error ? ko(new Error(`${method} : ${j.error.message}`)) : ok(j.result)));
    sock.send(JSON.stringify({id, method, params}));
  });
  await cdp('Runtime.enable');
  const evaluer = async (expr) => {
    const r = await cdp('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw new Error(`JS : ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  for (const e of etapes) {
    if (e.js) { const v = await evaluer(e.js); if (e.dire) console.log(`${e.dire} :`, typeof v === 'string' ? v : JSON.stringify(v)); }
    if (e.attendre) await attendre(e.attendre);
    if (e.jusqua) {
      const t0 = Date.now();
      let ok = false;
      while (Date.now() - t0 < (e.max ?? 15000)) { if (await evaluer(e.jusqua)) { ok = true; break; } await attendre(200); }
      if (!ok) console.log(`⚠️ jamais vrai : ${e.jusqua}`);
    }
    if (e.clicJs) {
      const r = await evaluer(e.clicJs);
      for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', {type, x: r.x, y: r.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1});
    }
    if (e.clic) {
      const r = await evaluer(`(() => { const el = document.querySelector(${JSON.stringify(e.clic)}); if (!el) return null; el.scrollIntoView({block: 'center'}); const b = el.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; })()`);
      if (!r) { console.log(`⚠️ introuvable : ${e.clic}`); continue; }
      for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', {type, x: r.x, y: r.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1});
    }
    if (e.touche) for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', {type, key: e.touche === 'Space' ? ' ' : e.touche, code: e.touche, windowsVirtualKeyCode: e.touche === 'Space' ? 32 : 0});
    if (e.capture) {
      const {data} = await cdp('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(e.capture, Buffer.from(data, 'base64'));
    }
  }
  if (erreurs.length) console.log('ERREURS DE LA PAGE :\n' + [...new Set(erreurs)].slice(0, 12).join('\n'));
  else console.log('aucune erreur dans la page');
  try { await cdp('Browser.close'); } catch {}
  sock.close();
} finally {
  await attendre(400);
  if (chrome.exitCode == null) chrome.kill();
}
