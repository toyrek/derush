// Dérush — « Sur ma timeline » (Dérush 12) : ton IA (Claude ou ChatGPT) monte directement dans ta timeline, geste par
// geste, par la porte des IA (lib/porte-ia.mjs). Pas de vidéo fabriquée, pas de dossier de montage : chaque geste se
// voit (le curseur de l'IA), s'annule d'un ⌘Z, et le montage reste le tien, à retoucher. Rapide : quelques minutes.
// Gemini pas encore (son bac à sable coupe la porte). Idée reprise d'Editroom (Robbie Tilton, licence MIT) : Magic.
import path from 'node:path';
import {lancerConseil, etatConseil, arreterConseil, oublierConseil} from './conseil.mjs';
import {lanceur} from './porte-apps.mjs';
import {CONSIGNES_PORTE} from './porte-ia-outils.mjs';

export const cleTimeline = (P) => `timeline:${P.racine}`;

const SYSTEME = `Tu es le monteur de Dérush. La personne te demande de monter DIRECTEMENT sur sa timeline, ouverte dans
Dérush sous ses yeux : tu travailles uniquement avec les outils mcp__derush__… (la porte de Dérush). Chacun de tes gestes
s'affiche sur sa timeline avec ton curseur, et elle peut l'annuler d'un ⌘Z.

${CONSIGNES_PORTE}

Règles :
- Fais exactement ce qu'elle demande, rien de plus (pas de vidéo fabriquée, pas d'export, sauf si elle le demande).
- Commence par lire_projet et lister_medias ; regarde (regarder_media) ou lis (lire_transcription) avant de choisir un
  passage ; garde les phrases entières quand on parle ; vérifie le résultat (lire_projet, voir_image) avant de finir.
- Ne supprime pas ce qu'elle a posé sans qu'elle le demande.
- Tu réponds en français simple, au tutoiement.
- À la fin, écris le fichier reponse.json : {"fait": "ce que tu as changé, en deux ou trois phrases, avec les temps"}.`;

/** Lance « Sur ma timeline ». Renvoie l'état (etatTimeline). `moteur` : claude ou codex (sinon l'IA choisie). */
export function monterSurTimeline(P, {texte, moteur = null, qualite = 'soigne'} = {}) {
  const t = String(texte ?? '').trim();
  if (!t) throw new Error('Écris d’abord ce que ton IA doit faire sur ta timeline.');
  if (t.length > 8000) throw new Error('Ta demande est trop longue (8 000 caractères au plus).');
  const l = lanceur();
  const cle = cleTimeline(P);
  oublierConseil(cle);
  return lancerConseil({
    cle, dossier: path.join(P.cache, 'sur-la-timeline'), consigne: t, systeme: SYSTEME, competences: [], porte: {command: l.command, args: l.args},
    moteur, qualite, attendu: 'reponse.json', delaiMs: 25 * 60000,
    valider: (r) => ({fait: String(r?.fait ?? r?.resume ?? r?.texte ?? '').slice(0, 3000) || 'C’est fait.'}),
  });
}
/** Où en est « Sur ma timeline » : {etat, moteur, etapes, reponse, erreur}, ou null. */
export const etatTimeline = (P) => etatConseil(cleTimeline(P));
export const arreterTimeline = (P) => arreterConseil(cleTimeline(P));
