// Dérush — la garde de Treg en lecture seule : un crochet (« PreToolUse ») que Claude Code lance avant chaque outil
// Treg, quand Dérush lui donne Treg seulement pour LIRE les comptes de la personne (lib/conseil.mjs : le profil du
// créateur, la relecture des vues).
// Claude écrit sur l'entrée de ce script le geste qu'il va faire ({tool_name, tool_input, …}). La garde laisse passer
// la liste des réseaux reliés, la fiche d'un appel et l'appel d'une fiche de lecture (outilTregLecture, lib/treg.mjs),
// et refuse tout le reste : publier, commenter, supprimer, les fiches payantes. Au moindre doute (entrée illisible,
// module introuvable), elle refuse.
// Elle est rangée avec les outils de Dérush, hors du dossier de travail : l'IA peut écrire dans celui-ci.
//   node outils/garde-treg.mjs < geste.json
const refuser = () => process.stdout.write(JSON.stringify({hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Dérush : ici, Treg est en lecture seule.'}}));

let texte = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { texte += d; });
process.stdin.on('end', async () => {
  try {
    const {outilTregLecture} = await import('../lib/treg.mjs');
    const geste = JSON.parse(texte);
    // permis : rien à dire, Claude suit ses réglages habituels
    if (!outilTregLecture(geste?.tool_name, geste?.tool_input)) refuser();
  } catch {
    refuser();
  }
});
