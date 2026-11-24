// Une scène d'exemple, écrite pour Dérush : un champ sous un soleil qui tourne, peint en touches épaisses.
// La recette, en trois temps (c'est celle de la scène de référence du moteur, /tableaux/scenes/09_postimp.js) :
//   1. un fond en aplats, qui BOUGE avec le temps (le soleil pulse, les nuages glissent, le vent passe dans le champ) ;
//   2. ce fond est repeint en touches par PAINT.strokes : chaque touche prend la couleur du fond sous elle et suit une
//      direction (autour du soleil dans le ciel, couchée par le vent dans le champ). Les touches ne changent pas de
//      place d'une image à l'autre (boil: 0) : le tableau vit sans clignoter ;
//   3. quelques détails vivants par-dessus (des oiseaux), dessinés à la main.
// draw(c, lt, t) : c = le canevas à peindre en entier ; lt = le temps dans la scène ; t = le temps du film.
SCENES['champ'] = (() => {
  const W = 1920, H = 1080, P = PAINT;
  const HORIZON = 620;
  const SOLEIL = [1380, 300];
  const C = {ciel: '#27408f', ciel2: '#5f86cf', halo: '#f7df7a', soleil: '#fff3b8', nuage: '#a9c4ee', colline: '#2f6b4f', colline2: '#3f8a5c', ble: '#e2a92f', ble2: '#b9791c', sillon: '#8a5a1a', oiseau: '#151a3a'};

  function fond(g, t) {
    // le ciel
    const d = g.createLinearGradient(0, 0, 0, HORIZON);
    d.addColorStop(0, C.ciel); d.addColorStop(1, C.ciel2);
    g.fillStyle = d; g.fillRect(0, 0, W, HORIZON);
    // le soleil et ses anneaux, qui respirent
    for (let i = 5; i >= 0; i--) {
      const r = 70 + i * 46 + 10 * Math.sin(t * 1.3 - i * 0.7);
      g.fillStyle = i === 0 ? C.soleil : P.rgb(P.mix(P.hex(C.halo), P.hex(C.ciel2), i / 6));
      g.beginPath(); g.arc(SOLEIL[0], SOLEIL[1], r, 0, Math.PI * 2); g.fill();
    }
    // des nuages qui glissent vers la gauche
    g.fillStyle = C.nuage;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 470 - t * 38) % (W + 500) + W + 500) % (W + 500) - 250, y = 110 + (i * 97) % 300;
      g.beginPath(); g.ellipse(x, y, 190, 42, 0, 0, Math.PI * 2); g.ellipse(x + 110, y + 26, 130, 34, 0, 0, Math.PI * 2); g.fill();
    }
    // deux rangées de collines
    for (const [y0, amp, col, f] of [[560, 46, C.colline, 0.004], [600, 30, C.colline2, 0.007]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y0 + amp * Math.sin(x * f + 1.3) + amp * 0.5 * Math.sin(x * f * 2.7));
      g.lineTo(W, H); g.fill();
    }
    // le champ : des bandes claires et sombres que le vent déplace
    for (let y = HORIZON; y < H; y += 14) {
      const p = (y - HORIZON) / (H - HORIZON);
      const onde = Math.sin(y * 0.045 - t * 2.1 + Math.sin(y * 0.013) * 2);
      g.fillStyle = P.rgb(P.mix(P.hex(C.ble), P.hex(C.ble2), 0.5 + 0.5 * onde * (0.4 + 0.6 * p)));
      g.fillRect(0, y, W, 15);
    }
    // des sillons qui partent vers l'horizon
    g.strokeStyle = C.sillon; g.lineWidth = 9;
    for (let i = -9; i <= 9; i++) { g.beginPath(); g.moveTo(W / 2 + i * 42, HORIZON); g.lineTo(W / 2 + i * 330, H); g.stroke(); }
  }

  // la direction des touches : elles tournent autour du soleil ; dans le champ, le vent les couche
  const direction = (x, y, t) => (y < HORIZON
    ? Math.atan2(y - SOLEIL[1], x - SOLEIL[0]) + Math.PI / 2 + 0.25 * Math.sin(x * 0.004 + t * 0.6)
    : -0.35 + 0.5 * Math.sin(x * 0.006 + y * 0.01 - t * 2.1));
  const couleursCiel = P.swatch(['#27408f', '#5f86cf', '#8fb3ec', '#f7df7a'], 0.55);
  const couleursChamp = P.swatch(['#e2a92f', '#f3cf5b', '#b9791c', '#7c8f3a'], 0.5);

  return {
    draw(c, lt, t) {
      const base = P.scratch('champFond'), g = base.getContext('2d');
      fond(g, t);
      c.drawImage(base, 0, 0);
      P.strokes(c, base, {cell: 13, len: 46, width: 9, angle: direction, seed: 3, t, boil: 0, outline: 0.8, outlineMix: 0.4, palette: (x, y, col, r) => couleursCiel(col, r), mask: (x, y) => y < HORIZON});
      P.strokes(c, base, {cell: 11, len: 34, width: 8, angle: direction, seed: 5, t, boil: 0, outline: 0.85, outlineCol: [70, 40, 10], outlineMix: 0.45, palette: (x, y, col, r) => couleursChamp(col, r), mask: (x, y) => y >= HORIZON});
      // trois oiseaux qui traversent, battant des ailes
      c.strokeStyle = C.oiseau; c.lineWidth = 7; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const x = 300 + i * 170 + lt * 120, y = 250 + i * 46 + 18 * Math.sin(lt * 2 + i), a = 18 * Math.sin(lt * 9 + i * 1.7);
        c.beginPath(); c.moveTo(x - 30, y - a); c.quadraticCurveTo(x - 12, y - 14, x, y); c.quadraticCurveTo(x + 12, y - 14, x + 30, y - a); c.stroke();
      }
    },
  };
})();
