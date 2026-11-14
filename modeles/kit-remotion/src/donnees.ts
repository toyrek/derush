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
  texte?: string;
  notes?: string;
};
export type Bloc = {n: number; id: string; type: 'bloc'; titre: string; genre: string; genre_lisible: string; consigne: string; debut: Temps; fin: Temps; duree: {s: number; images: number}};
export type Indication = {id: string; genre_lisible: string; consigne: string; debut: Temps; fin: Temps};
export type Effet = {id: string; modele: string; debut: Temps; fin: Temps; reglages: Record<string, unknown>};
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
