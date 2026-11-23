#!/usr/bin/env node
// Dérush — les essais de la partie « association » (lib/asso.mjs, lib/journal.mjs, lib/qr.mjs) et des fiches de genre
// (competences/genres-video) :
//  - asso.json se lit, et rien d'autre qu'une page HelloAsso de l'association n'est accepté comme page de don ;
//  - le récit donne les sommes réunies par chaque groupe ; l'étape « la suite » s'efface quand son projet n'est pas ouvert ;
//  - le projet en cours est illustré (son logo rangé dans l'app, l'affiche et les photos de sa cagnotte, ses dates, ses
//    vidéos) ; une image, un logo ou une vidéo venus d'ailleurs sont écartés ;
//  - Revolut : seule une page de don de revolut.com est acceptée, et son code QR est juste (codes relus par un vrai
//    lecteur, puis épinglés ici) ;
//  - les cagnottes viennent du site (ici : un faux site, sur cet ordinateur), une cagnotte finie ou une adresse
//    étrangère est écartée, la liste est gardée une heure, et sans réponse la dernière liste connue sert ;
//  - la bannière se masque 30 jours ;
//  - un message part au format du site, un refus du site donne une phrase lisible et l'adresse de repli ;
//  - le journal des erreurs ne garde rien de personnel (dossier personnel, adresse, clé), ne s'empile pas, et
//    l'analyse reconnaît les causes courantes ;
//  - les 42 genres ont chacun leur fiche, leur provenance, et plus aucune partie du moteur d'origine.
// Aucun appel à internet : le « site » est un petit serveur local.
//   node outils/essai-asso.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-asso.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-asso-'));
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');

// ——— le faux site de l'association ———
const DON = 'https://www.helloasso.com/associations/yabai/';
const dans = (jours) => new Date(Date.now() + jours * 864e5).toISOString();
const site = {recus: [], dons: [], don: 200, campagnes: null, contact: 200, appels: 0};
const serveur = http.createServer((req, res) => {
  let corps = '';
  req.on('data', (d) => { corps += d; });
  req.on('end', () => {
    const json = (code, j) => { res.writeHead(code, {'content-type': 'application/json'}); res.end(JSON.stringify(j)); };
    if (req.url.startsWith('/api/trpc/helloassoSync.getDonationCampaigns')) {
      site.appels++;
      if (site.campagnes === null) return json(503, {error: 'indisponible'});
      return json(200, {result: {data: {json: site.campagnes}}});
    }
    if (req.url.startsWith('/api/trpc/donations.create')) {
      site.dons.push(JSON.parse(corps || '{}'));
      if (site.don === 500) return json(500, [{error: {json: {message: 'boum'}}}]);
      if (site.don === 'ailleurs') return json(200, [{result: {data: {json: {url: 'https://paiement.exemple.test/x', checkoutId: 1}}}}]);
      return json(200, [{result: {data: {json: {url: 'https://www.helloasso.com/associations/yabai/checkout/12345', checkoutId: 12345}}}}]);
    }
    if (req.url.startsWith('/api/trpc/contact.sendMessage')) {
      site.recus.push({url: req.url, corps: JSON.parse(corps || '{}')});
      if (site.contact === 429) return json(429, {error: 'Trop de messages envoyés.'});
      if (site.contact === 400) return json(400, [{error: {json: {message: JSON.stringify([{path: ['email'], message: 'Vérifiez votre adresse email.'}])}}}]);
      if (site.contact === 500) return json(500, [{error: {json: {message: 'boum'}}}]);
      return json(200, [{result: {data: {json: {success: true}}}}]);
    }
    json(404, {});
  });
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
process.env.DERUSH_ASSO_API = `http://127.0.0.1:${serveur.address().port}/api/trpc`;

const A = await import(pathToFileURL(path.join(D, 'lib', 'asso.mjs')).href);
const J = await import(pathToFileURL(path.join(D, 'lib', 'journal.mjs')).href);
const Q = await import(pathToFileURL(path.join(D, 'lib', 'qr.mjs')).href);
const {createHash} = await import('node:crypto');

// De fausses clés, assemblées ici : ce fichier ne porte aucune chaîne en forme de clé (le contrôle d'avant publication,
// et celui de GitHub, la prendraient pour une fuite).
const FAUSSES = {anthropic: ['sk', 'ant', 'abcdefghijklmnopqrstuvwxyz'].join('-'), openai: ['sk', 'proj', 'ABCDEFGHIJKLMNOP1234'].join('-'), treg: ['trg', 'live', 'abcdefgh1234'].join('_'), jeton: 'abcdefghijklmnopqrstuvwxyz012345', fenetre: '0123456789abcdef'.repeat(3)};

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${JSON.stringify(detail || cond).slice(0, 400)}` : ''}`); } };
const leve = async (f) => { try { await f(); return null; } catch (e) { return e; } };

console.log('asso.json');
const a = A.lireAsso();
essai('l’association : son nom, sa mission, son site, son adresse', a.nom === 'YABAÏ' && a.mission.length > 40 && a.site.startsWith('https://www.yabai.fr') && a.contact === 'contact@yabai.fr', a);
essai('le don libre et les projets : des pages HelloAsso de l’association, rien d’autre', a.dons.asso.lien.startsWith(DON) && a.dons.projets.length >= 1 && a.dons.projets.every((p) => p.lien.startsWith(DON) && p.slug && p.titre), a.dons);
essai('les réseaux : chacun sur son propre site, en https', a.reseaux.length >= 3 && a.reseaux.every((r) => r.lien.startsWith('https://') && new URL(r.lien).hostname.includes(r.id === 'x' ? 'x.com' : r.id)), a.reseaux);
essai('les photos : seulement celles du site de l’association, avec une légende', a.photos.length >= 6 && a.photos.every((p) => /^https:\/\/(www\.)?yabai\.fr\//.test(p.src) && p.legende), a.photos);
essai('une photo peut dire où regarder et qui l’a prise, rien de plus', a.photos.every((p) => p.cadre === null || /^\d{1,3}% \d{1,3}%$/.test(p.cadre)) && a.photos.some((p) => p.cadre) && a.photos[0].credit.startsWith('@'), a.photos.map((p) => [p.cadre, p.credit]));
essai('le récit : un titre, et ce que chaque groupe a réuni, dans l’ordre', a.recit.titre.length > 5 && a.recit.titre_fort.length > 5 && a.recit.intro.length > 80 && a.recit.etapes.map((x) => x.montant).join() === '43000,60000,10000' && a.recit.etapes.every((x) => x.quand && x.mention && x.texte.length > 60), a.recit);
essai('seule la dernière étape parle de la suite, et dit de quel projet', a.recit.etapes.map((x) => x.suite).join() === 'false,false,true' && a.recit.etapes.at(-1).mention === 'à réunir' && a.recit.etapes.at(-1).projet === a.dons.projets[0].slug);
const vedette = a.dons.projets[0];
essai('le projet en cours est illustré : son logo est un fichier de l’app, qui existe', vedette.logo === '/marque/la-6t-a-tottori.webp' && fs.statSync(path.join(D, 'public', vedette.logo)).size > 5000 && vedette.devise.length > 5, [vedette.logo, vedette.devise]);
essai('ses images : l’affiche d’abord (entière, sans zoom), puis des photos ; chez HelloAsso ou dans le dossier du site', vedette.images.length >= 2 && vedette.images[0].affiche === true && vedette.images.slice(1).every((i) => i.affiche === false)
  && vedette.images.every((i) => i.legende && /^https:\/\/(cdn\.helloasso\.com\/|ik\.imagekit\.io\/tnefgb1lg\/|(www\.)?yabai\.fr\/)/.test(i.src)), vedette.images);
essai('une image de HelloAsso est demandée allégée (l’affiche pèse sinon près de 2 Mo)', vedette.images.filter((i) => i.src.includes('cdn.helloasso.com')).every((i) => /[?&]width=\d+/.test(i.src) && i.src.includes('img_format=webp')));
essai('ses faits ont un pictogramme connu, ses vidéos sont sur un réseau', vedette.faits.length >= 2 && vedette.faits.every((x) => ['calendrier', 'lieu', 'avion', 'outil', 'groupe', 'coeur'].includes(x.icone) && x.texte) && vedette.videos.length >= 1 && vedette.videos.every((v) => v.titre && /^https:\/\/www\.instagram\.com\//.test(v.lien)), [vedette.faits, vedette.videos]);
const louche = A.lireAsso({dons: {projets: [{slug: 'x', titre: 'Un projet', texte: 't', lien: `${DON}collectes/x`,
  logo: 'https://exemple.test/logo.png', images: [{src: 'https://exemple.test/a.jpg', legende: 'a'}, {src: 'https://ik.imagekit.io/autre-compte/a.jpg', legende: 'b'}, {src: 'http://www.yabai.fr/a.jpg', legende: 'c'}, {src: 'https://www.yabai.fr/ok.webp', legende: 'd', cadre: 'url(x)', affiche: 'oui'}],
  faits: [{icone: 'onload=alert(1)', texte: 'un fait'}, {icone: 'lieu', texte: ''}], videos: [{titre: 'v', lien: 'https://exemple.test/v'}, {titre: 'w', lien: 'javascript:alert(1)'}, {titre: 'bonne', lien: 'https://www.youtube.com/watch?v=x'}]}]}}).dons.projets[0];
essai('ce qui vient d’ailleurs est écarté : logo, images, vidéos ; un pictogramme inconnu devient un cœur', louche.logo === null && louche.images.length === 1 && louche.images[0].src === 'https://www.yabai.fr/ok.webp' && louche.images[0].cadre === null && louche.images[0].affiche === false
  && louche.faits.length === 1 && louche.faits[0].icone === 'coeur' && louche.videos.length === 1 && louche.videos[0].titre === 'bonne', louche);
essai('un logo de projet : un fichier de public/marque ou une image du site, rien d’autre', A.lireAsso({dons: {projets: [{slug: 'x', titre: 'P', lien: `${DON}collectes/x`, logo: '/marque/../../secret.png'}]}}).dons.projets[0].logo === null
  && A.lireAsso({dons: {projets: [{slug: 'x', titre: 'P', lien: `${DON}collectes/x`, logo: 'https://www.yabai.fr/images/logo.webp'}]}}).dons.projets[0].logo === 'https://www.yabai.fr/images/logo.webp');
essai('Revolut : une page de don de revolut.com, et rien d’autre', A.PAGE_REVOLUT.test(a.dons.revolut.lien) && a.dons.revolut.titre.length > 3 && a.dons.revolut.texte.length > 20
  && ['http://revolut.com/app/donations/549cad02-8123-4062-bda1-f84543750d7d', 'https://revolut.com.exemple.test/app/donations/549cad02-8123-4062-bda1-f84543750d7d', 'https://exemple.test/app/donations/549cad02-8123-4062-bda1-f84543750d7d',
    'https://revolut.com/app/donations/549cad02-8123-4062-bda1-f84543750d7d?vers=ailleurs', 'https://revolut.com/app/autre/549cad02-8123-4062-bda1-f84543750d7d', 'https://revolut.com/app/donations/pas-un-identifiant'].every((l) => !A.PAGE_REVOLUT.test(l)), a.dons.revolut);
essai('le texte ne promet rien de faux : pas de compteur d’argent', !/collecté/i.test(JSON.stringify(a)));
essai('« open source » est vrai : la licence GPL-3.0 est là, entière, et annoncée', fs.readFileSync(path.join(D, 'LICENSE'), 'utf8').includes('GNU GENERAL PUBLIC LICENSE') && fs.readFileSync(path.join(D, 'LICENSE'), 'utf8').includes('Version 3, 29 June 2007') && fs.statSync(path.join(D, 'LICENSE')).size > 34000 && JSON.parse(fs.readFileSync(path.join(D, 'package.json'), 'utf8')).license === 'GPL-3.0-only' && /GPL-3\.0/.test(fs.readFileSync(path.join(D, 'LICENCE.md'), 'utf8')) && !/Tous droits réservés/.test(fs.readFileSync(path.join(D, 'LICENCE.md'), 'utf8')));
essai('l’app fabriquée emporte asso.json et la licence', /'asso\.json'/.test(fs.readFileSync(path.join(D, 'outils', 'construire-app.mjs'), 'utf8')) && /'LICENSE'/.test(fs.readFileSync(path.join(D, 'outils', 'construire-app.mjs'), 'utf8')));

console.log('Les cagnottes (HelloAsso, par le site)');
const brut = [
  {slug: 'la-6t-a-tottori-former-fabriquer-partir', title: 'La 6T à Tottori : former, fabriquer, partir', description: 'Quatre jeunes…', url: `${DON}collectes/la-6t-a-tottori-former-fabriquer-partir`, image: 'https://cdn.helloasso.com/img/x.png', goal: null, currentAmount: 0, endDate: dans(40)},
  {slug: 'finie', title: 'Une cagnotte finie', description: '', url: `${DON}collectes/finie`, image: null, endDate: dans(-3)},
  {slug: 'nouvelle', title: 'Une nouvelle cagnotte', description: 'Ouverte hier.', url: `${DON}collectes/nouvelle`, image: 'https://exemple.test/x.png', endDate: dans(12)},
  {slug: 'pirate', title: 'Une page ailleurs', description: '', url: 'https://www.helloasso.com/associations/autre/collectes/pirate'},
  {slug: 'pirate2', title: 'Une page ailleurs', description: '', url: 'https://exemple.test/associations/yabai/collectes/x'},
  {slug: '2', title: 'Don libre', description: '', url: `${DON}formulaires/2`},
];
const lues = A.lireCampagnes(brut);
essai('les pages hors de l’association sont écartées, les autres gardées', lues.length === 4 && !lues.some((c) => c.slug.startsWith('pirate')), lues.map((c) => c.slug));
essai('une image qui ne vient pas de HelloAsso n’est pas reprise', lues.find((c) => c.slug === 'nouvelle').image === null && lues[0].image.startsWith('https://cdn.helloasso.com/'));
essai('collecte ou don libre, reconnus à leur adresse', lues[0].genre === 'collecte' && lues.find((c) => c.slug === '2').genre === 'don');
essai('aucun montant n’est repris (unité non établie)', lues.every((c) => !('goal' in c) && !('currentAmount' in c) && !('objectif' in c)));
essai('une liste abîmée ne casse rien', A.lireCampagnes(null).length === 0 && A.lireCampagnes([null, 3, {url: 5}]).length === 0);

site.campagnes = brut;
let e = null;
let s = await A.soutien({force: true});
essai('« Soutenir » : en direct, les projets ouverts seulement, celui de asso.json avec son objectif', s.direct === true && s.dons.projets.map((p) => p.slug).join() === 'la-6t-a-tottori-former-fabriquer-partir,nouvelle' && s.dons.projets[0].objectif === 10000 && s.dons.projets[1].objectif === null, s.dons.projets);
essai('les jours restants sont comptés', s.dons.projets[0].jours === 39 || s.dons.projets[0].jours === 40, s.dons.projets[0].jours);
essai('une cagnotte ouverte sur HelloAsso apparaît sans mise à jour de Dérush', s.dons.projets[1].titre === 'Une nouvelle cagnotte' && s.dons.projets[1].lien === `${DON}collectes/nouvelle`);
essai('le don libre reste celui de asso.json tant qu’il est ouvert', s.dons.asso.lien === `${DON}formulaires/2`);
essai('le récit arrive entier tant que son projet est ouvert', s.asso.recit.etapes.length === 3 && s.asso.recit.etapes.at(-1).suite === true, s.asso.recit.etapes.map((x) => x.quand));
essai('le projet ouvert garde ses illustrations, et la bande de sa cagnotte arrive de HelloAsso, allégée', s.dons.projets[0].logo === vedette.logo && s.dons.projets[0].images.length === vedette.images.length && s.dons.projets[0].faits.length >= 2 && s.dons.projets[0].videos.length >= 1
  && s.dons.projets[0].image === 'https://cdn.helloasso.com/img/x.png?width=920&img_format=webp&quality=80', s.dons.projets[0]);
essai('une cagnotte que Dérush ne connaît pas : montrée quand même, sans illustration inventée', s.dons.projets[1].logo === null && s.dons.projets[1].images.length === 0 && s.dons.projets[1].faits.length === 0 && s.dons.projets[1].image === null, s.dons.projets[1]);
essai('Revolut arrive avec son code QR, prêt à dessiner', s.dons.revolut.lien === a.dons.revolut.lien && s.dons.revolut.qr.taille === 45 && /^(M\d+ \d+h\d+v1h-\d+z)+$/.test(s.dons.revolut.qr.d), s.dons.revolut);
const avant = site.appels;
s = await A.soutien();
essai('la liste est gardée une heure : pas de second appel au site', site.appels === avant && s.direct === true, {avant, apres: site.appels});
site.campagnes = null;
s = await A.soutien({force: true});
essai('le site ne répond plus : la dernière liste connue sert, et c’est dit', s.direct === false && s.dons.projets.length === 2, {direct: s.direct, n: s.dons.projets.length});
fs.rmSync(path.join(process.env.DERUSH_SUPPORT, 'asso-campagnes.json'), {force: true});
s = await A.soutien({force: true});
essai('jamais lue et hors ligne : les projets de asso.json, sans planter', s.direct === false && s.dons.projets.length >= 1 && s.dons.projets[0].slug === 'la-6t-a-tottori-former-fabriquer-partir', s.dons.projets);
site.campagnes = [{slug: '9', title: 'Un autre don libre', description: '', url: `${DON}formulaires/9`}];
s = await A.soutien({force: true});
essai('le don libre a changé sur HelloAsso : Dérush prend celui qui est ouvert', s.dons.asso.lien === `${DON}formulaires/9` && s.dons.projets.length === 0, s.dons);
essai('plus aucun projet ouvert : le récit s’arrête aux voyages faits', s.asso.recit.etapes.length === 2 && s.asso.recit.etapes.every((x) => !x.suite), s.asso.recit.etapes.map((x) => x.quand));
site.campagnes = [brut[2]];
s = await A.soutien({force: true});
essai('une autre cagnotte ouverte, mais pas celle du récit : l’étape « la suite » s’efface aussi', s.dons.projets.length === 1 && s.dons.projets[0].slug === 'nouvelle' && s.asso.recit.etapes.length === 2, s.asso.recit.etapes.map((x) => x.quand));
site.campagnes = [{slug: '9', title: 'Un autre don libre', description: '', url: `${DON}formulaires/9`}];
s = await A.soutien({force: true});

console.log('Le code QR (pour donner avec Revolut depuis son téléphone)');
// Ces trois codes ont été relus par le lecteur de codes du Mac (Vision) le 23 novembre 2026 : leur empreinte est épinglée.
const empreinte = (c) => createHash('sha256').update(c.lignes.join('\n')).digest('hex').slice(0, 16);
const connus = [['https://www.yabai.fr', 2, 2, '973fda42bb400bb8'], ['Dérush', 1, 6, '0d8158997c4d172f'], ['x'.repeat(106), 6, 3, '536f804ac066bd50']];
essai('trois codes relus par un vrai lecteur n’ont pas bougé', connus.every(([texte, version, masque, attendu]) => { const c = Q.qr(texte); return c.version === version && c.masque === masque && empreinte(c) === attendu; }), connus.map(([texte]) => { const c = Q.qr(texte); return [c.version, c.masque, empreinte(c)]; }));
const code = Q.qr(a.dons.revolut.lien);
const sombre = (x, y) => code.lignes[y][x] === '1';
const repere = (x0, y0) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); if (sombre(x0 + x, y0 + y) !== (d !== 2)) return false; } return true; };
essai('le code de Revolut : carré, de la bonne taille, avec ses trois repères', code.taille === 17 + 4 * code.version && code.lignes.length === code.taille && code.lignes.every((l) => l.length === code.taille && /^[01]+$/.test(l)) && repere(0, 0) && repere(code.taille - 7, 0) && repere(0, code.taille - 7), [code.taille, code.version]);
essai('ses lignes de cadence alternent, et le module toujours sombre est là', Array.from({length: code.taille - 16}, (_, i) => i + 8).every((i) => sombre(i, 6) === (i % 2 === 0) && sombre(6, i) === (i % 2 === 0)) && sombre(8, code.taille - 8));
// les 15 bits de format, lus aux deux endroits : le niveau M, le masque annoncé, et un reste de division nul
const format = (copie) => { let bits = 0; const lire = (i, x, y) => { if (sombre(x, y)) bits |= 1 << i; }; const n = code.taille;
  if (copie === 1) { for (let i = 0; i <= 5; i++) lire(i, 8, i); lire(6, 8, 7); lire(7, 8, 8); lire(8, 7, 8); for (let i = 9; i < 15; i++) lire(i, 14 - i, 8); }
  else { for (let i = 0; i < 8; i++) lire(i, n - 1 - i, 8); for (let i = 8; i < 15; i++) lire(i, 8, n - 15 + i); }
  return bits ^ 0x5412; };
const reste = (bits) => { let v = bits; for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10); return v; };
essai('son format, écrit deux fois, dit le niveau M et le bon masque', format(1) === format(2) && reste(format(1)) === 0 && (format(1) >>> 13) === 0 && ((format(1) >>> 10) & 7) === code.masque, [format(1).toString(2), format(2).toString(2), code.masque]);
essai('un texte vide ou trop long (plus de 106 octets) ne donne pas de code', Q.qr('') === null && Q.qr(null) === null && Q.qr('x'.repeat(107)) === null && Q.qr('é'.repeat(54)) === null && Q.qr('é'.repeat(53)).version === 6 && Q.cheminQr('x'.repeat(200)) === null);
const trace = Q.cheminQr('https://www.yabai.fr');
essai('le tracé garde une marge blanche de 4 modules tout autour', trace.taille === 25 + 8 && [...trace.d.matchAll(/M(\d+) (\d+)h(\d+)/g)].every(([, x, y, l]) => Number(x) >= 4 && Number(y) >= 4 && Number(x) + Number(l) <= 29 && Number(y) <= 28), trace.taille);

console.log('Le don libre (sans cagnotte)');
essai('les montants proposés sont ceux de la page de don du site', A.MONTANTS_DON.join() === '5,10,20,50,100' && s.libre.montants.join() === '5,10,20,50,100' && s.libre.deduction === 0.66);
let don = await A.creerDon({montant: '12,50', prenom: ' Sam ', nom: 'Diallo', email: 'sam@exemple.fr', message: 'Bravo !'});
let envoi = site.dons.at(-1)[0].json;
essai('le site reçoit le montant en centimes et le nom, comme depuis sa propre page', don.montant === 12.5 && envoi.amount === 1250 && envoi.donorFirstName === 'Sam' && envoi.donorLastName === 'Diallo' && envoi.donorEmail === 'sam@exemple.fr' && envoi.message === 'Bravo !' && envoi.isAnonymous === false && envoi.wantsFiscalReceipt === false && envoi.isRecurring === false, envoi);
essai('la page de paiement rendue est celle de HelloAsso', don.lien === 'https://www.helloasso.com/associations/yabai/checkout/12345', don);
don = await A.creerDon({montant: 20, prenom: '', nom: '', email: 'sam@exemple.fr', anonyme: true});
envoi = site.dons.at(-1)[0].json;
essai('un don anonyme : le nom n’est pas transmis, l’adresse du reçu oui', envoi.donorFirstName === 'Donateur' && envoi.donorLastName === 'Anonyme' && envoi.isAnonymous === true && envoi.amount === 2000 && !('message' in envoi), envoi);
const nd = site.dons.length;
for (const [quoi, corps, attendu] of [['moins de 1 €', {montant: '0,5', prenom: 'Sam', nom: 'Diallo', email: 'sam@exemple.fr'}, /commence à 1/], ['un montant qui n’en est pas un', {montant: 'vingt', prenom: 'Sam', nom: 'Diallo', email: 'sam@exemple.fr'}, /commence à 1/], ['un montant énorme (une faute de frappe)', {montant: 5000000, prenom: 'Sam', nom: 'Diallo', email: 'sam@exemple.fr'}, /écris-nous/], ['sans nom', {montant: 10, prenom: 'S', nom: '', email: 'sam@exemple.fr'}, /prénom et ton nom/], ['sans adresse', {montant: 10, prenom: 'Sam', nom: 'Diallo', email: 'sam'}, /adresse e-mail/]]) {
  e = await leve(() => A.creerDon(corps));
  essai(`refusé avant tout envoi : ${quoi}`, attendu.test(e?.message ?? '') && site.dons.length === nd, e?.message);
}
site.don = 'ailleurs';
e = await leve(() => A.creerDon({montant: 10, prenom: 'Sam', nom: 'Diallo', email: 'sam@exemple.fr'}));
essai('une page de paiement qui n’est pas chez HelloAsso est refusée, avec la page de l’asso en repli', /n’a pas pu être préparé/.test(e?.message ?? '') && e.repli?.lien === a.dons.asso.lien, {m: e?.message, repli: e?.repli});
site.don = 500;
e = await leve(() => A.creerDon({montant: 10, prenom: 'Sam', nom: 'Diallo', email: 'sam@exemple.fr'}));
essai('le site en panne : dit clairement, avec la page HelloAsso de l’asso en repli', /n’a pas pu être préparé/.test(e?.message ?? '') && e.repli?.lien?.startsWith(DON), e?.message);
site.don = 200;

console.log('La bannière');
let b = A.etatBanniere();
essai('montrée d’abord, avec le projet en cours', b.montrer === true && b.nom === 'YABAÏ' && /Tottori/.test(b.projet?.titre ?? ''), b);
essai('elle montre le logo du projet rangé dans l’app (aucune image d’internet sur l’accueil)', b.projet.logo === '/marque/la-6t-a-tottori.webp', b.projet);
b = A.masquerBanniere();
essai('masquée pour 30 jours', b.montrer === false && Math.abs(Date.parse(JSON.parse(fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, 'reglages.json'), 'utf8')).dons_masque_jusqua) - Date.now() - 30 * 864e5) < 60000);

console.log('Écrire à l’équipe, signaler un bug');
site.contact = 200;
let r = await A.envoyerMessage({nom: ' Sam ', email: 'sam@exemple.fr', sujet: 'Une idée\npour Dérush', message: 'Bonjour, voici une idée pour Dérush.'});
const recu = site.recus.at(-1);
essai('le message part au format du site (un seul envoi, nom et sujet nettoyés)', r.ok === true && recu.url.includes('batch=1') && recu.corps[0].json.name === 'Sam' && recu.corps[0].json.email === 'sam@exemple.fr' && recu.corps[0].json.subject === 'Une idée pour Dérush' && recu.corps[0].json.message.startsWith('Bonjour'), recu);
const n0 = site.recus.length;
e = await leve(() => A.envoyerMessage({nom: 'Sam', email: 'pas une adresse', sujet: 's', message: 'Un message assez long.'}));
essai('une adresse fausse est refusée avant tout envoi', /adresse e-mail/.test(e?.message ?? '') && site.recus.length === n0, e?.message);
e = await leve(() => A.envoyerMessage({nom: 'Sam', email: 'sam@exemple.fr', sujet: 's', message: 'court'}));
essai('un message trop court aussi', /trop court/.test(e?.message ?? '') && site.recus.length === n0, e?.message);
site.contact = 429;
e = await leve(() => A.envoyerMessage({nom: 'Sam', email: 'sam@exemple.fr', sujet: 's', message: 'Un message assez long.'}));
essai('trop de messages : une phrase claire, et l’adresse pour écrire autrement', /Trop de messages/.test(e?.message ?? '') && e.repli?.email === 'contact@yabai.fr', e?.message);
site.contact = 400;
e = await leve(() => A.envoyerMessage({nom: 'Sam', email: 'sam@exemple.fr', sujet: 's', message: 'Un message assez long.'}));
essai('le site refuse l’adresse : dit en français, sans son jargon', /adresse e-mail/.test(e?.message ?? '') && !/[{[]/.test(e.message), e?.message);
site.contact = 500;
e = await leve(() => A.envoyerMessage({nom: 'Sam', email: 'sam@exemple.fr', sujet: 's', message: 'Un message assez long.'}));
essai('le site en panne : le message n’est pas parti, et on sait où écrire', /n’est pas parti/.test(e?.message ?? '') && /contact@yabai\.fr/.test(e.message), e?.message);
site.contact = 200;
r = await A.signalerBug({nom: 'Sam', email: 'sam@exemple.fr', description: 'La vidéo ne se crée plus depuis ce matin, le rendu s’arrête à 40 %.', rapport: `Dérush — ${os.homedir()}/Movies/x — ${FAUSSES.anthropic}`});
const bug = site.recus.at(-1).corps[0].json;
essai('un bug : le sujet dit la version et le début de la description', /^\[Dérush \d+\.\d+(\.\d+)?\] Bug : La vidéo ne se crée plus/.test(bug.subject), bug.subject);
essai('le diagnostic joint ne porte ni dossier personnel ni clé', bug.message.includes('Diagnostic de Dérush') && !bug.message.includes(os.homedir()) && !bug.message.includes(FAUSSES.anthropic.slice(0, 12)), bug.message.slice(-200));
r = await A.signalerBug({nom: 'Sam', email: 'sam@exemple.fr', description: 'La vidéo ne se crée plus depuis ce matin.', rapport: null});
essai('sans diagnostic : seulement ce que la personne a écrit', site.recus.at(-1).corps[0].json.message === 'La vidéo ne se crée plus depuis ce matin.');
e = await leve(() => A.signalerBug({nom: 'Sam', email: 'sam@exemple.fr', description: 'bug'}));
essai('une description vide de sens est refusée', /Décris/.test(e?.message ?? ''), e?.message);
const ticket = A.lienTicket(`erreur dans ${os.homedir()}/x`);
essai('le ticket GitHub : le dépôt de Dérush, le diagnostic sans le dossier personnel', ticket.startsWith('https://github.com/toyrek/derush/issues/new?') && !decodeURIComponent(ticket).includes(os.homedir()), ticket.slice(0, 120));

console.log('Le journal des erreurs');
const sale = `Erreur dans ${os.homedir()}/Movies/Dérush/projet — /Users/quelquun/Desktop/x.mp4 — C:\\Users\\Jean\\Videos — moi@exemple.fr — ${FAUSSES.openai} — ${FAUSSES.treg} — ?c=${FAUSSES.fenetre} — Bearer ${FAUSSES.jeton}`;
const propre = J.nettoyer(sale);
essai('rien de personnel ne reste : dossier personnel, autre compte, adresse', !propre.includes(os.homedir()) && !/quelquun|Jean|moi@exemple/.test(propre) && propre.includes('<e-mail>'), propre);
essai('ni clé, ni jeton, ni clé de fenêtre', ![FAUSSES.openai, FAUSSES.treg, FAUSSES.fenetre.slice(0, 20), FAUSSES.jeton].some((k) => propre.includes(k)), propre);
essai('le reste de la phrase est gardé', propre.startsWith('Erreur dans ~/Movies/Dérush/projet') && propre.includes('x.mp4'), propre);
J.viderJournal();
J.noterErreur({source: 'ia', message: 'Claude : Not logged in · Please run /login', ou: 'étape « travail »'});
J.noterErreur({source: 'ia', message: 'Claude : Not logged in · Please run /login'});
J.noterErreur({source: 'programme', message: `ENOSPC: no space left on device, write '${os.homedir()}/x'`, detail: 'at ecrire (lib/x.mjs:3)'});
J.noterErreur({source: 'interface', message: 'TypeError: Cannot read properties of undefined (reading \'id\')', ou: '/app.js:120'});
J.noterErreur({message: ''});
const lus = J.lireErreurs();
essai('la même erreur répétée ne fait qu’une ligne, comptée', lus.length === 3 && lus.at(-1).fois === 2, lus.map((x) => [x.source, x.fois]));
essai('la plus récente d’abord, sans dossier personnel', lus[0].source === 'interface' && !JSON.stringify(lus).includes(os.homedir()), lus[0]);
const pistes = J.analyser(lus, [{nom: 'FFmpeg', requis: true, ok: false, detail: 'absent'}, {nom: 'Blender', requis: false, ok: false, detail: 'absent (facultatif)'}]);
essai('l’analyse reconnaît : IA déconnectée, disque plein, erreur du programme, outil requis absent', ['plus connectée', 'disque est plein', 'programme de Dérush', 'manque « FFmpeg »'].every((m) => pistes.some((p) => p.cause.includes(m))) && !pistes.some((p) => /Blender/.test(p.cause)), pistes.map((p) => p.cause));
essai('la plus fréquente d’abord, chacune avec un geste à essayer', pistes[0].fois === 2 && pistes.every((p) => p.geste.length > 15), pistes[0]);
const d = J.diagnostic({etat: [{nom: 'FFmpeg', requis: true, ok: true, detail: 'FFmpeg 8.0'}], plus: {'IA choisie': 'claude'}});
essai('le diagnostic : la version, le système, l’analyse, ce qui est installé, les erreurs', /^Dérush \d/.test(d.texte) && d.texte.includes('— Analyse —') && d.texte.includes('✓ FFmpeg') && d.texte.includes('IA choisie : claude') && d.erreurs === 3 && d.pistes.length >= 3 && !d.texte.includes(os.homedir()), d.texte.slice(0, 300));
for (let i = 0; i < 340; i++) J.noterErreur({message: `erreur ${i}`});
essai('le journal ne grossit pas sans fin (300 lignes au plus)', fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, 'journal-erreurs.jsonl'), 'utf8').trim().split('\n').length === 300);
J.viderJournal();
essai('vidé, le diagnostic le dit', J.diagnostic().texte.includes('Aucune erreur notée') && J.lireErreurs().length === 0);

console.log('Les fiches de genre (competences/genres-video)');
const G = path.join(D, 'competences', 'genres-video');
const cat = JSON.parse(fs.readFileSync(path.join(G, 'catalogue.json'), 'utf8'));
const genres = cat.familles.flatMap((f) => f.genres);
const fiches = fs.readdirSync(path.join(G, 'fiches')).filter((n) => n.endsWith('.md')).sort();
essai('42 genres en 7 familles, chacun avec un nom et un résumé en français', genres.length === 42 && cat.familles.length === 7 && genres.every((g) => g.nom && g.resume && g.fiche === `fiches/${g.id}.md`) && new Set(genres.map((g) => g.nom.toLowerCase())).size === 42);
essai('chaque genre a sa fiche, et chaque fiche son genre', fiches.length === 42 && genres.every((g) => fiches.includes(`${g.id}.md`)));
const textes = fiches.map((f) => [f, fs.readFileSync(path.join(G, 'fiches', f), 'utf8')]);
essai('chaque fiche garde la méthode du monteur et la vérification', textes.every(([, t]) => /^## How a pro cuts this/m.test(t) && /^## Check before delivering/m.test(t)), textes.filter(([, t]) => !/^## How a pro cuts this/m.test(t)).map(([f]) => f));
const moteur = textes.filter(([, t]) => /^## (Before you start|Make the edit|Refine the plan|Deliver|Example requests)\b/m.test(t) || /\*\*Default skin/.test(t) || /genre preset `/.test(t)).map(([f]) => f);
essai('plus aucune partie du moteur d’origine (installation, commandes, habillage par défaut)', moteur.length === 0, moteur);
essai('chacune commence par l’en-tête de Dérush et dit sa provenance et sa licence', textes.every(([, t]) => t.includes('**Dans Dérush.**') && /_Adapté de « [\w-]+ », Claude Video Editing Skills \(Viprasol Tech, licence MIT, commit `[0-9a-f]{12}`\)/.test(t)));
const index = fs.readFileSync(path.join(G, 'SKILL.md'), 'utf8');
essai('l’index : le nom de la compétence, et chaque genre avec sa fiche', /^---\nname: genres-video\ndescription: /.test(index) && genres.every((g) => index.includes(`| ${g.nom} | \`${g.fiche}\` |`)));
essai('la licence et la provenance sont là, et dans le registre des licences', fs.readFileSync(path.join(G, 'LICENSE'), 'utf8').startsWith('MIT License') && /commit `[0-9a-f]{40}`/.test(fs.readFileSync(path.join(G, 'SOURCE.md'), 'utf8')) && fs.readFileSync(path.join(D, 'competences', 'LICENCES.md'), 'utf8').includes('`genres-video`') && fs.existsSync(path.join(D, 'competences', 'licences', 'viprasol.txt')));
const C = await import(pathToFileURL(path.join(D, 'lib', 'competences.mjs')).href);
const comp = C.listerCompetences().find((x) => x.nom === 'genres-video');
essai('Dérush la donne à l’IA, et elle ne lance rien toute seule', !!comp && comp.lance === false && comp.source === 'derush', comp);

serveur.close();
console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
