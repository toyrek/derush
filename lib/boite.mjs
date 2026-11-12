// Dérush — demander quelque chose au relais par « la boîte » : des fichiers du dossier de travail, pour une commande qui
// tourne dans un bac à sable sans réseau local (Gemini). La commande dépose sa demande ; Dérush, hors du bac à sable,
// répond dans un fichier qu'on lit ici au fur et à mesure (voir lib/relais.mjs). Le script de rendu du kit
// (modeles/kit-remotion/rendre.mjs) fait la même chose de son côté : il doit tenir dans un seul fichier.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Dépose une demande et suit la réponse. `surTexte(t)` reçoit ce que Dérush écrit en route (l'avancement).
 * Renvoie la dernière ligne, celle qui commence par « ##DERUSH- » (le résultat) ; lève une erreur si Dérush ne répond pas.
 */
export async function demanderParBoite({boite, jeton, route, corps, surTexte = () => {}, attenteMs = 30000}) {
  const id = crypto.randomBytes(12).toString('hex');
  const battement = path.join(boite, `battement-${id}`);
  const vivre = () => { try { fs.writeFileSync(battement, String(Date.now())); } catch { /* sans importance */ } };
  vivre();
  const demande = path.join(boite, `demande-${id}.json`);
  fs.writeFileSync(`${demande}.tmp`, JSON.stringify({jeton, route, corps}));
  fs.renameSync(`${demande}.tmp`, demande);
  const signe = setInterval(vivre, 3000);
  let fd = null;
  const reponse = path.join(boite, `reponse-${id}.txt`);
  try {
    const debut = Date.now();
    while (!fs.existsSync(reponse)) {
      if (Date.now() - debut > attenteMs) throw new Error('Dérush ne répond pas à la demande.');
      await pause(150);
    }
    fd = fs.openSync(reponse, 'r');
    const dec = new TextDecoder();
    const bloc = Buffer.alloc(65536);
    let pos = 0;
    let reste = '';
    for (;;) {
      const n = fs.readSync(fd, bloc, 0, bloc.length, pos);
      if (!n) { await pause(200); continue; }
      pos += n;
      reste += dec.decode(bloc.subarray(0, n), {stream: true});
      let i;
      while ((i = reste.indexOf('\n')) >= 0) {
        const ligne = reste.slice(0, i);
        reste = reste.slice(i + 1);
        if (/^##DERUSH-[A-Z]+ .*##\s*$/.test(ligne)) return ligne.trim();
        surTexte(`${ligne}\n`);
      }
      // un morceau sans fin de ligne (l'avancement) part tout de suite, sauf s'il peut être le début de la dernière ligne
      if (reste && !reste.startsWith('#')) { surTexte(reste); reste = ''; }
    }
  } finally {
    clearInterval(signe);
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* déjà fermé */ } }
    // la boîte reste propre : la réponse lue et le signe de vie sont retirés
    for (const f of [reponse, battement]) { try { fs.unlinkSync(f); } catch { /* déjà retiré */ } }
  }
}
