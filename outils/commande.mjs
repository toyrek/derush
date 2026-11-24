// Dérush — ce que partagent les commandes données à l'IA (derush-son, derush-controle, derush-detourer) : l'aide et les
// options. L'IA lit l'aide avant de se servir d'un outil : elle doit dire tout ce qu'il faut, exemples compris, sans
// qu'elle ait à ouvrir le code.

/** « --help », « -h », « --aide » partout, ou « aide »/« help » en premier mot : écrit l'aide et sort (code 0). */
export function aide(args, texte, {siVide = false} = {}) {
  const demande = args.some((x) => ['--help', '-h', '--aide'].includes(x)) || ['aide', 'help'].includes(args[0]) || (siVide && !args.length);
  if (!demande) return;
  process.stdout.write(`${texte.trimEnd()}\n`);
  process.exit(0);
}

/** Les options « --nom valeur » et les drapeaux « --nom », retirés de `args` au passage (le reste : les fichiers). */
export function options(args) {
  const opt = (nom) => { const i = args.indexOf(nom); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v ?? null; };
  const drapeau = (nom) => { const i = args.indexOf(nom); if (i < 0) return false; args.splice(i, 1); return true; };
  return {opt, drapeau};
}

/** Dans le bac à sable d'une IA (Codex, Gemini), le relais de Dérush est là : une commande lui passe sa demande. */
export const relaisPresent = () => !!((process.env.DERUSH_RELAIS_BOITE || process.env.DERUSH_RELAIS) && process.env.DERUSH_RELAIS_JETON);

/**
 * Passe une demande au relais de Dérush (la boîte de fichiers, ou l'adresse locale) et renvoie sa réponse, l'objet de
 * la ligne « ##<marque> {…}## ». Ce que Dérush écrit en route (l'avancement) va sur la sortie d'erreur.
 */
export async function demanderAuRelais(route, corps, marque) {
  let ligne = null;
  try {
    if (process.env.DERUSH_RELAIS_BOITE) {
      const {demanderParBoite} = await import(new URL('../lib/boite.mjs', import.meta.url).href);
      ligne = await demanderParBoite({boite: process.env.DERUSH_RELAIS_BOITE, jeton: process.env.DERUSH_RELAIS_JETON, route, corps, surTexte: (t) => process.stderr.write(t)});
    } else {
      const r = await fetch(`${process.env.DERUSH_RELAIS}/${route}`, {method: 'POST', headers: {'x-derush-relais': process.env.DERUSH_RELAIS_JETON, 'content-type': 'application/json'}, body: JSON.stringify(corps)});
      const texte = await r.text();
      ligne = texte.split('\n').reverse().find((l) => l.startsWith(`##${marque} `)) ?? null;
      for (const l of texte.split('\n')) if (l && !l.startsWith('##DERUSH-')) process.stderr.write(`${l}\n`);
    }
  } catch (err) { return {ok: false, message: `le relais de Dérush n’a pas répondu (${err.message}).`}; }
  const m = new RegExp(`^##${marque} (.*)##\\s*$`).exec(String(ligne ?? '').trim());
  try { return m ? JSON.parse(m[1]) : {ok: false, message: 'le relais de Dérush n’a pas répondu.'}; } catch { return {ok: false, message: 'réponse illisible du relais de Dérush.'}; }
}
