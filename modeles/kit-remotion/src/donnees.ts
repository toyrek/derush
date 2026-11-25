// Les données du pack Dérush, lues telles quelles (le pack est le dossier parent de ce kit).
import montageJson from '../../montage.json';
import motsJson from '../../sous-titres/mots.json';

export type Temps = {s: number; image: number; tc: string};
export type PointCadrage = {t: number; x: number; y: number; fenetre?: number[]; coupe?: boolean};
export type Plan = {
  n?: number;
  id: string;
  type: 'plan';
  titre: string;
  debut: Temps;
  fin: Temps;
  duree: {s: number; images: number};
  source: {id: string; nom: string; type: 'video' | 'audio' | 'image'; fps: number};
  fichier: {
    chemin: string; debut_utile_s: number; fin_utile_s: number; largeur?: number; hauteur?: number; fps?: number; voix?: string; fond?: string; clair?: string; son?: boolean;
    /** Personne détourée image par image (pour un titre « derrière la personne ») : decoupes/<plan>/d_00000.webp (WebP avec transparence), un par image du fichier. */
    masques?: {dossier: string; premiere: number; derniere: number};
  };
  son: {garder: boolean; gain_db: number; version: 'original' | 'voix' | 'fond' | 'clair'; avant_s: number; apres_s: number};
  /** L'étalonnage du plan, posé dans Dérush : les paramètres de colorCorrection (@remotion/effects), ou rien. */
  couleur?: {exposure: number; contrast: number; saturation: number; temperature: number; tint: number} | null;
  cadrage?: {points: PointCadrage[]};
  cadre?: 'plein' | 'incrustation';
  /** La transition qui amène ce plan (Dérush 12) : il commence avant_s secondes avant sa coupe, par-dessus le plan qui sort. */
  transition?: {genre: 'enchaine' | 'volet'; avant_s: number};
  /** Le plan qui sort d'une transition (Dérush 12) continue ce temps après sa coupe, sous le plan qui entre. */
  transition_apres_s?: number;
  /** Par-dessus (Dérush 12) : le son d'une vidéo détaché de son image (« Détacher le son ») : seul le son se joue. */
  son_seul?: boolean;
  /** La vitesse du plan (Dérush 12) : 0,5 = ralenti, 2 = accéléré (le son suit). Absente : 1. */
  vitesse?: number;
  /** Ses fondus (Dérush 12), en secondes du montage : l'image depuis ou vers le noir, le son ; la courbe ; ce qui fond. */
  fondu?: {entree?: number; sortie?: number; courbe?: 'lineaire' | 'lente' | 'rapide' | 'douce'; quoi?: 'tout' | 'image' | 'son'};
  texte?: string;
  notes?: string;
};
export type Bloc = {n: number; id: string; type: 'bloc'; titre: string; genre: string; genre_lisible: string; consigne: string; debut: Temps; fin: Temps; duree: {s: number; images: number}};
export type Indication = {id: string; genre_lisible: string; consigne: string; debut: Temps; fin: Temps};
export type Effet = {id: string; modele: string; debut: Temps; fin: Temps; reglages: Record<string, unknown>;
  /** Une animation de l'IA (Dérush 12.1) : ses images, une par image, dans animations/<id>/a_00000.webp (transparentes). */
  animation?: {id: string; nom: string; images: number; fps: number; dossier: string}};
export type Mot = {t: string; debut: number; fin: number; plan: string; evenement?: boolean};

export const montage = montageJson as unknown as {
  sortie: {largeur: number; hauteur: number; fps: number; images: number; duree: Temps};
  montage: (Plan | Bloc)[];
  superpositions: Plan[];
  indications: Indication[];
  /** Le style du film (sous-titres, couleur, police, grain…) choisi dans Dérush. */
  style?: Record<string, unknown>;
  /** Les effets posés dans Dérush : le kit les dessine déjà. Change leurs réglages ici, ou remplace-les par mieux. */
  habillage?: {effets: Effet[]; sans_sous_titres: string[]};
};
export const mots = (motsJson as unknown as {mots: Mot[]}).mots;
