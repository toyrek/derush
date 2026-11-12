// Dérush — le tutoriel animé. Huit scènes courtes, jouées en boucle, qui montrent les gestes du logiciel : choisir sa
// façon de créer, déposer, demander à l'IA, régler ce qu'elle a posé, retoucher, habiller, analyser, partager. Il s'ouvre à la première ouverture de Dérush, et se revoit
// depuis le menu Aide ou la fenêtre des raccourcis. Les scènes sont dessinées en HTML et animées en CSS (tuto.css) :
// aucune image, aucune vidéo à charger.
//
//   const tuto = creerTutoriel({esc, ic, ill, logo, nomIA});
//   tuto.ouvrir({surFin})     surFin est appelé quand la personne a fini ou passé le tutoriel
export function creerTutoriel(o) {
  const {ic, ill, logo} = o;
  let el = null;
  let etape = 0;
  let surFin = null;

  const plan = (c, texte = '') => `<i class="tl-plan ${c}">${texte}</i>`;
  const SCENES = [
    {
      titre: ['Choisis', 'ta façon de créer'],
      texte: 'Cinq façons de commencer. Montage : tu déposes tes vidéos. Motion design : rien à déposer, tu décris et ton IA cherche, écrit et anime tout. Extraits courts : une longue vidéo devient plusieurs clips. Voix off : tu racontes tes images, ta voix guide le film. Sur un son : une musique ou une voix devient une vidéo.',
      astuce: ['Bouton « Nouveau projet »', 'tu changes de mode quand tu veux'],
      scene: () => `<div class="ts ts-modes">${[['claude', 'Montage'], ['motion', 'Motion design'], ['extraits', 'Extraits courts'], ['voix', 'Voix off'], ['son', 'Sur un son']].map(([d, n], i) => `<div class="ts-mode m${i + 1}">${ill(d)}<b>${n}</b></div>`).join('')}</div>`,
    },
    {
      titre: ['Dépose', 'ta matière'],
      texte: 'Glisse tes vidéos, tes sons et tes photos dans la fenêtre. Ils restent à leur place sur ton ordinateur : rien n’est copié, même les très gros fichiers. Tu peux aussi enregistrer ta voix ou ta webcam, sans quitter Dérush.',
      astuce: ['Glisser-déposer', 'ou les boutons Importer et Enregistrer'],
      scene: () => `<div class="ts ts-depot">
        <div class="ts-finder"><header><i></i><i></i><i></i><span>Mes rushes</span></header>
          <div class="ts-fichiers"><span class="f f1">${ic('film')}</span><span class="f f2">${ic('film')}</span><span class="f f3">${ic('onde')}</span></div></div>
        <div class="ts-panneau"><header>${ic('grille')}<span>Médias</span></header>
          <div class="ts-cases"><i class="c c1"><b>0:42</b></i><i class="c c2"><b>1:15</b></i><i class="c c3"><b>0:08</b></i><i class="c vide"></i></div></div>
        <span class="ts-vol v1">${ic('film')}</span><span class="ts-vol v2">${ic('film')}</span><span class="ts-vol v3">${ic('onde')}</span>
        <span class="ts-curseur"></span>
      </div>`,
    },
    {
      titre: ['Demande', 'à ton IA'],
      texte: () => `Écris ce que tu veux, comme à un monteur. ${o.nomIA?.() ?? 'Claude'} choisit les meilleurs passages, monte, habille et te livre la vidéo. Tu dis ce qu’il faut changer, et c’est refait. Et si tu relies tes réseaux, elle connaît ton style et ce qui marche chez toi.`,
      astuce: ['Bouton « Demander à l’IA »', 'ou ⌘K'],
      scene: () => `<div class="ts ts-ia">
        <div class="ts-bulle moi"><span class="ts-frappe">3 clips de 20 s pour TikTok, sous-titrés</span></div>
        <div class="ts-bulle ia"><div class="ts-bobine">${ill('bobine')}</div><div><b>Ton IA monte…</b><div class="ts-barre"><i></i></div><small>choisit les passages · pose les titres · règle le son</small></div></div>
        <div class="ts-livraison"><i class="v v1">${ic('lire', 'plein')}</i><i class="v v2">${ic('lire', 'plein')}</i><i class="v v3">${ic('lire', 'plein')}</i><b>${ic('coche')}3 vidéos prêtes</b></div>
        <div class="ts-champ"><span>Écris ce que tu veux…</span><i>${ic('envoi')}</i></div>
      </div>`,
    },
    {
      titre: ['Règle', 'chaque détail'],
      texte: () => `Tout ce que ${o.nomIA?.() ?? 'ton IA'} pose sur ta vidéo apparaît dans la timeline, en direct : les plans, les titres, les effets, les sons. Clique un bloc, dis ce qui doit changer (plus tard, plus gros, moins fort…), et seul ce bloc est retouché.`,
      astuce: ['Clique un bloc de couleur', 'sous la vidéo de ton IA'],
      scene: () => `<div class="ts ts-blocs">
        <div class="ts-b-pistes">
          <div class="ts-b-piste"><i class="b plan b1" style="--x:0;--w:45"></i><i class="b plan b2" style="--x:46;--w:54"></i></div>
          <div class="ts-b-piste"><i class="b texte b3 vise" style="--x:3;--w:24">Titre</i><i class="b texte b4" style="--x:50;--w:42">Sous-titres</i></div>
          <div class="ts-b-piste"><i class="b effet b5" style="--x:42;--w:9"></i><i class="b effet b6" style="--x:76;--w:14">Zoom</i></div>
          <div class="ts-b-piste"><i class="b son b7" style="--x:0;--w:100">Musique</i></div>
        </div>
        <div class="ts-b-fiche"><b>${ic('texte')}Titre</b><span>Plus tôt</span><span class="choisi">Plus tard</span><span>Plus gros</span><span>Retirer</span></div>
      </div>`,
    },
    {
      titre: ['Retouche', 'à la main'],
      texte: 'La timeline marche comme dans CapCut : tu glisses un plan pour le déplacer, tu coupes avec les ciseaux, tu supprimes ce qui est en trop. Tout s’annule avec ⌘Z.',
      astuce: ['S pour couper', '⌫ pour supprimer', 'Espace pour lire'],
      scene: () => `<div class="ts ts-coupe">
        <div class="tl-regle">${'<i></i>'.repeat(9)}</div>
        <div class="tl-piste">${plan('p1', 'P1')}${plan('p2a', 'P2')}${plan('p2b')}${plan('p3', 'P3')}${plan('p4', 'P4')}</div>
        <div class="tl-onde"></div>
        <span class="tl-tete"></span>
        <span class="tl-ciseaux">${ic('ciseaux')}</span>
        <span class="tl-poubelle">${ic('poubelle')}</span>
        <span class="ts-curseur"></span>
        <div class="ts-touches"><kbd>S</kbd><small>couper</small><kbd>⌫</kbd><small>supprimer</small><kbd>espace</kbd><small>lire</small></div>
      </div>`,
    },
    {
      titre: ['Habille', 'ta vidéo'],
      texte: 'Sous-titres, titres, effets et vrais sons : un clic dans l’onglet Habiller, ou une phrase à ton IA. Ce que tu vois dans le lecteur est exactement ce que tu obtiendras.',
      astuce: ['Onglet Habiller', 'Bouton Sous-titres'],
      scene: () => `<div class="ts ts-habille">
        <div class="ts-options"><span class="o o1">${ic('cc')}Sous-titres</span><span class="o o2">${ic('titre')}Titres</span><span class="o o3">${ic('baguette')}Effets</span><span class="o o4">${ic('vague')}Vrais sons</span></div>
        <div class="ts-telephone"><i class="ts-image"></i><b class="ts-titre-video">LE SECRET</b>
          <div class="ts-st"><span class="m m1">ÇA</span><span class="m m2">CHANGE</span><span class="m m3">TOUT</span></div>
          <div class="ts-ondes">${'<i></i>'.repeat(14)}</div></div>
        <span class="ts-eclat e1">${ic('etincelle', 'plein')}</span><span class="ts-eclat e2">${ic('etincelle', 'plein')}</span>
      </div>`,
    },
    {
      titre: ['Analyse', 'avant de publier'],
      texte: 'Ton IA regarde la vidéo finie et note l’accroche, le rythme, le son, les textes, la fin. Elle dit quoi changer en premier, et peut le faire d’un clic. Une estimation honnête, pas une promesse de vues.',
      astuce: ['Bouton Analyser', 'sous chaque vidéo'],
      scene: () => `<div class="ts ts-analyse">
        <div class="ts-jauge"><svg viewBox="0 0 120 120"><circle class="fond" cx="60" cy="60" r="50"/><circle class="arc" cx="60" cy="60" r="50"/></svg>
          <div class="ts-chiffres"><div>${[0, 14, 31, 47, 60, 71, 78].map((n) => `<b>${n}</b>`).join('')}</div></div><small>sur 100</small></div>
        <div class="ts-axes">${[['Accroche', 'a1', '6'], ['Rythme', 'a2', '8'], ['Son', 'a3', '9'], ['Fin', 'a4', '7']].map(([n, c, v]) => `<div class="a ${c}"><span>${n}</span><i><u></u></i><b>${v}</b></div>`).join('')}</div>
        <div class="ts-conseil">${ic('baguette')}<span><b>À faire en premier</b>Commence par ta meilleure phrase.</span><em>${ic('etincelle', 'plein')}Demander</em></div>
      </div>`,
    },
    {
      titre: ['Partage', 'au bon endroit'],
      texte: 'Pour chaque réseau : la légende, les hashtags, le bon moment. Tu relis, puis tu publies d’un clic sur TikTok, Instagram, YouTube et LinkedIn. Rien ne part sans toi.',
      astuce: ['Bouton Partager', 'Réseaux reliés une seule fois'],
      scene: () => `<div class="ts ts-partage">
        <div class="ts-fiche"><i class="ts-mini">${ic('lire', 'plein')}</i><div><u class="l l1"></u><u class="l l2"></u><u class="l l3"></u>
          <div class="ts-tags"><span class="t t1">#podcast</span><span class="t t2">#persan</span><span class="t t3">#histoire</span></div></div></div>
        <svg class="ts-fils" viewBox="0 0 520 300" aria-hidden="true"><path d="M250 150 C 320 150, 330 62, 400 62"/><path d="M250 150 C 320 150, 340 122, 400 122"/><path d="M250 150 C 320 150, 340 182, 400 182"/><path d="M250 150 C 320 150, 330 242, 400 242"/></svg>
        ${['tiktok', 'instagram', 'youtube', 'linkedin'].map((k, i) => `<span class="ts-reseau r${i + 1}">${logo(k, 34)}<i>${ic('coche')}</i></span>`).join('')}
        <span class="ts-publier">${ic('publier')}Publier</span>
      </div>`,
    },
  ];

  function rendre(sens = 1) {
    const s = SCENES[etape];
    const dernier = etape === SCENES.length - 1;
    const scene = el.querySelector('.tuto-scene');
    scene.classList.remove('entre', 'entre-inverse');
    scene.innerHTML = s.scene();
    void scene.offsetWidth; // les animations de la scène repartent du début
    scene.classList.add(sens < 0 ? 'entre-inverse' : 'entre');
    el.querySelector('.tuto-num').innerHTML = `<b>${String(etape + 1).padStart(2, '0')}</b><small>/ ${String(SCENES.length).padStart(2, '0')}</small>`;
    el.querySelector('.tuto-titre').innerHTML = `${s.titre[0]} <em>${s.titre[1]}</em>`;
    el.querySelector('.tuto-texte').textContent = typeof s.texte === 'function' ? s.texte() : s.texte;
    el.querySelector('.tuto-astuces').innerHTML = s.astuce.map((a) => `<span>${a}</span>`).join('');
    el.querySelector('.tuto-points').innerHTML = SCENES.map((_, i) => `<button data-aller="${i}" class="${i === etape ? 'actif' : i < etape ? 'vu' : ''}" aria-label="Étape ${i + 1}"></button>`).join('');
    el.querySelector('[data-tuto="precedent"]').disabled = etape === 0;
    el.querySelector('[data-tuto="suivant"]').innerHTML = dernier ? `${ic('etincelle', 'plein')}<span>C’est parti</span>` : `<span>Suivant</span>${ic('img-plus')}`;
    el.querySelector('[data-tuto="passer"]').classList.toggle('invisible', dernier);
    const texte = el.querySelector('.tuto-droite');
    texte.classList.remove('change');
    void texte.offsetWidth;
    texte.classList.add('change');
  }
  function aller(n) {
    const avant = etape;
    etape = Math.max(0, Math.min(SCENES.length - 1, n));
    if (etape !== avant) rendre(etape - avant);
  }
  function fermer() {
    if (!el) return;
    document.removeEventListener('keydown', clavier, true);
    const e = el;
    el = null;
    e.classList.add('sort');
    setTimeout(() => e.remove(), 220);
    surFin?.();
  }
  function clavier(e) {
    if (!el) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); return fermer(); }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); return etape === SCENES.length - 1 ? fermer() : aller(etape + 1); }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); return aller(etape - 1); }
    // pendant le tutoriel, les raccourcis du montage ne font rien
    if (!e.metaKey && !e.ctrlKey) e.stopPropagation();
  }
  function ouvrir(options = {}) {
    if (el) return;
    surFin = options.surFin ?? null;
    etape = 0;
    el = document.createElement('div');
    el.className = 'tuto';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Tutoriel de Dérush');
    el.innerHTML = `<div class="tuto-carte">
        <div class="tuto-gauche"><div class="tuto-scene"></div></div>
        <div class="tuto-droite">
          <div class="tuto-num"></div>
          <h2 class="tuto-titre"></h2>
          <p class="tuto-texte"></p>
          <div class="tuto-astuces"></div>
          <span class="espace"></span>
          <div class="tuto-nav"><div class="tuto-points"></div><span class="espace"></span>
            <button class="btn" data-tuto="precedent" title="Étape précédente (←)">${ic('img-moins')}</button>
            <button class="btn claude" data-tuto="suivant" title="Étape suivante (→)"></button></div>
        </div>
        <button class="tuto-passer" data-tuto="passer" title="Fermer le tutoriel (Échap). Tu le retrouves dans le menu Aide.">Passer</button>
      </div>`;
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-aller]');
      if (p) return aller(Number(p.dataset.aller));
      const a = e.target.closest('[data-tuto]')?.dataset.tuto;
      if (a === 'passer') return fermer();
      if (a === 'precedent') return aller(etape - 1);
      if (a === 'suivant') return etape === SCENES.length - 1 ? fermer() : aller(etape + 1);
    });
    document.body.append(el);
    document.addEventListener('keydown', clavier, true);
    rendre();
  }
  return {ouvrir, fermer, ouvert: () => !!el, etapes: SCENES.length};
}
