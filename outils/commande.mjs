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
