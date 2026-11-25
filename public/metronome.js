// Dérush — le métronome de la porte des IA (12.1), un minuteur dans un Worker. Une page cachée (la fenêtre de Dérush
// en arrière-plan, réduite, une autre app devant) voit ses minuteurs ralentis, jusqu'à une fois par minute ; ceux d'un
// Worker ne le sont pas, et son message réveille la page. Ainsi la porte reste vivante pendant que l'IA monte, même
// quand la personne fait autre chose. La page envoie un délai (en ms) ; le métronome répond quand il est écoulé.
let minuteur = null;
onmessage = (e) => {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => postMessage(0), Math.max(0, Math.min(60000, Number(e.data) || 0)));
};
