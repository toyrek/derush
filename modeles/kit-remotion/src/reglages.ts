// Réglages que l'IA (ou toi) peut changer sans toucher au reste du kit.

/**
 * Plans qui ont déjà du texte incrusté (sous-titres, titres) : on n'y ajoute pas de sous-titres.
 * Mets ici leurs ID, par exemple ['P5']. Ceux cochés dans Dérush sont déjà pris en compte.
 */
export const PLANS_SANS_SOUS_TITRES: string[] = [];

/**
 * Affiche les cases à créer et les notes de l'humain pendant le travail (le studio, `images.mjs`). Un rendu ne les
 * dessine jamais : `rendre.mjs` et « Créer la vidéo » de Dérush passent `afficherConsignes: false`.
 */
export const AFFICHER_CONSIGNES = true;
