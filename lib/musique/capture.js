// Écrit pour Dérush, à la place du fichier du même nom de huashu-motion (qui pilote Chrome pour lire une page).
// Dans Dérush, la musique ne lit pas une page : derush-musique reçoit la partition ou le style directement.
export async function openFilm() {
  throw new Error('Dans Dérush, la musique ne lit pas une page : donne la partition ou le style à derush-musique.');
}
