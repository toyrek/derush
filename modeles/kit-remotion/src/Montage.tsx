import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {blur} from '@remotion/effects/blur';
import {chromaticAberration} from '@remotion/effects/chromatic-aberration';
import {zoomBlur} from '@remotion/effects/zoom-blur';
import {colorCorrection} from '@remotion/effects/color-correction';
import {montage, mots, type Bloc, type Plan, type PointCadrage} from './donnees';
import {PLANS_SANS_SOUS_TITRES} from './reglages';
// Le moteur d'habillage est le même fichier que dans l'app Dérush : l'aperçu et le rendu dessinent la même chose.
// @ts-ignore (JavaScript pur)
import {CATALOGUE, chargerPolices, creerHabillage, decoupeA, mouvementA, preparerEtat} from './moteur.js';

// Le montage de Dérush, avec son habillage (transitions, titres, sous-titres, style).
// Pour aller plus loin : remplace <ACreer> par de vraies scènes, ajoute tes propres calques dans <Montage>,
// change les réglages des effets dans ../montage.json (« habillage »). Garde les temps décidés par l'humain.

const ETAT = preparerEtat({
  sortie: montage.sortie,
  duree: montage.sortie.images / montage.sortie.fps,
  coupes: montage.montage.map((it) => it.debut.s).filter((t) => t > 0),
  effets: (montage.habillage?.effets ?? []).map((e) => ({id: e.id, modele: e.modele, debut: e.debut.s, fin: e.fin.s, reglages: e.reglages})),
  style: montage.style ?? {},
  mots,
  sansSousTitres: [...(montage.habillage?.sans_sous_titres ?? []), ...PLANS_SANS_SOUS_TITRES],
});
const BASE_PUBLIC = staticFile('polices').replace(/\/polices$/, '');

const volume = (db: number) => Math.pow(10, (db || 0) / 20);

/** Fenêtre de recadrage au temps t (interpolée, sans glisser à travers une coupe de caméra). */
function fenetreA(points: PointCadrage[] | undefined, t: number): number[] | null {
  if (!points?.length || !points[0].fenetre) return null;
  let a = 0;
  while (a < points.length - 1 && points[a + 1].t <= t) a++;
  const p = points[a];
  const q = points[a + 1];
  if (!q || q.coupe || q.t === p.t) return p.fenetre;
  const f = Math.min(1, Math.max(0, (t - p.t) / (q.t - p.t)));
  return p.fenetre.map((v, i) => v + (q.fenetre[i] - v) * f);
}

/** Place l'image du plan pour qu'elle remplisse le cadre, centrée sur la fenêtre de recadrage. */
function placer(it: Plan, t: number, largeur: number, hauteur: number): React.CSSProperties {
  const w = it.fichier.largeur || largeur;
  const h = it.fichier.hauteur || hauteur;
  const s = Math.max(largeur / w, hauteur / h);
  const fen = fenetreA(it.cadrage?.points, t);
  const fx = fen && fen[2] < 0.999 ? fen[0] / (1 - fen[2]) : 0.5;
  const fy = fen && fen[3] < 0.999 ? fen[1] / (1 - fen[3]) : 0.5;
  return {position: 'absolute', left: -(w * s - largeur) * fx, top: -(h * s - hauteur) * fy, width: w * s, height: h * s, maxWidth: 'none'};
}

const PlanVideo: React.FC<{it: Plan; petit?: boolean}> = ({it, petit}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = it.debut.s + frame / fps;
  const m = petit ? null : mouvementA(ETAT, t);
  const L = petit ? width * 0.42 : width;
  const H = petit ? height * 0.42 : height;
  const cadre: React.CSSProperties = petit
    ? {position: 'absolute', right: '5%', top: '6%', width: L, height: H, borderRadius: 28, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.45)'}
    : {position: 'absolute', left: 0, top: 0, width: L, height: H, overflow: 'hidden'};
  // effets d'optique des transitions (le même calcul que l'aperçu de Dérush)
  // l'étalonnage du plan (posé dans Dérush : les mêmes réglages que son aperçu), puis les effets d'optique des transitions
  const couleur = it.couleur ? [colorCorrection(it.couleur)] : [];
  const effets = m
    ? [
        ...couleur,
        ...(m.flouZoom > 0.5 ? [zoomBlur({amount: m.flouZoom, center: [0.5, 0.45], samples: 32})] : []),
        ...(m.flouFile.px > 0.5 ? [blur({radius: m.flouFile.px, horizontal: m.flouFile.angle === 0, vertical: m.flouFile.angle !== 0})] : []),
        ...(m.rvb > 0.5 ? [chromaticAberration({amount: m.rvb, angle: 20})] : []),
      ]
    : couleur;
  return (
    <div style={cadre}>
      <Video src={staticFile(it.fichier.chemin)} trimBefore={Math.round(it.fichier.debut_utile_s * fps)} muted style={placer(it, t, L, H)} effects={effets} />
    </div>
  );
};

/** La personne détourée, posée au-dessus du titre « derrière la personne » (images préparées par Dérush). */
const Decoupe: React.FC<{it: Plan}> = ({it}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = it.debut.s + frame / fps;
  const d = it.fichier.masques;
  if (!d || !decoupeA(ETAT, t)) return null;
  const j = Math.round((it.fichier.debut_utile_s + frame / fps) * (it.fichier.fps || fps));
  if (j < d.premiere || j > d.derniere) return null;
  return <Img src={staticFile(`${d.dossier}/d_${String(j).padStart(5, '0')}.webp`)} style={placer(it, t, width, height)} />;
};

/** Plan de son seul (podcast, voix off) : les images restent à créer. */
const SonSeul: React.FC<{it: Plan; afficher: boolean}> = ({it, afficher}) => (
  <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #1d2a33, #07090c)', justifyContent: 'center', alignItems: 'center', padding: '8%'}}>
    {afficher ? (
      <>
        <div style={{color: '#9fd8ff', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 34, letterSpacing: 4, textTransform: 'uppercase'}}>Images à créer · {it.id}</div>
        <div style={{color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 44, fontWeight: 700, textAlign: 'center', marginTop: 24}}>{it.titre || it.texte || ''}</div>
      </>
    ) : null}
  </AbsoluteFill>
);

/** Case réservée dans le montage : l'IA la remplace par la scène demandée. */
const ACreer: React.FC<{it: Bloc; afficher: boolean}> = ({it, afficher}) => (
  <AbsoluteFill style={{background: afficher ? 'repeating-linear-gradient(135deg, #241c38 0 28px, #2a2140 28px 56px)' : '#0b0b10', justifyContent: 'center', alignItems: 'center', padding: '8%'}}>
    {afficher ? (
      <div style={{border: '6px dashed #b39ddb', borderRadius: 40, padding: '6%', textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif'}}>
        <div style={{color: '#d1c4e9', fontSize: 34, letterSpacing: 4, textTransform: 'uppercase'}}>À créer · {it.genre_lisible}</div>
        <div style={{color: 'white', fontSize: 64, fontWeight: 800, margin: '20px 0'}}>{it.titre || it.id}</div>
        <div style={{color: '#e8e3f5', fontSize: 36, lineHeight: 1.35}}>{it.consigne}</div>
      </div>
    ) : null}
  </AbsoluteFill>
);

const Consignes: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const actives = montage.indications.filter((i) => t >= i.debut.s && t < i.fin.s);
  if (!actives.length) return null;
  return (
    <AbsoluteFill style={{padding: 40, alignItems: 'flex-start', justifyContent: 'flex-start', gap: 12}}>
      {actives.map((i) => (
        <div key={i.id} style={{background: 'rgba(58,49,16,.92)', borderLeft: '8px solid #e0b100', color: '#ffe9a6', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 28, padding: '10px 18px', borderRadius: 10}}>
          <b>{i.genre_lisible}</b> — {i.consigne}
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const Montage: React.FC<{afficherConsignes: boolean}> = ({afficherConsignes}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const m = mouvementA(ETAT, t);
  const plans = montage.montage.filter((it): it is Plan => it.type === 'plan');
  const sons = [...plans, ...montage.superpositions].filter((p) => p.son.garder);

  // Habillage : trois calques remplis par le moteur (derrière la personne, avec l'image, par-dessus tout).
  const derriere = useRef<HTMLDivElement>(null);
  const milieu = useRef<HTMLDivElement>(null);
  const devant = useRef<HTMLDivElement>(null);
  const habillage = useRef<{maj: (etat: unknown, t: number) => void} | null>(null);
  const [attente] = useState(() => delayRender('Polices de Dérush'));
  const [pret, setPret] = useState(false);
  useEffect(() => { chargerPolices(BASE_PUBLIC).then(() => setPret(true)); }, []);
  useLayoutEffect(() => {
    habillage.current ??= creerHabillage({derriere: derriere.current, milieu: milieu.current, devant: devant.current, urlBase: BASE_PUBLIC});
    habillage.current.maj(ETAT, t);
  });
  useEffect(() => { if (pret) continueRender(attente); }, [pret, attente]);

  const calque: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width, height};
  const filtre = m.flou > 0.3 || m.sombre > 0.01 ? `blur(${m.flou}px) brightness(${1 - m.sombre})` : undefined;
  return (
    <AbsoluteFill style={{backgroundColor: 'black', overflow: 'hidden'}}>
      {/* tout ce qui bouge avec l'image : plans, titres, personne détourée */}
      <div style={{...calque, transform: `translate(${m.tx}px, ${m.ty}px) scale(${m.echelle}) rotate(${m.rot}deg)`, filter: filtre}}>
        {montage.montage.map((it) => (
          <Sequence key={it.id} name={`${it.id} ${it.titre || ''}`} from={it.debut.image} durationInFrames={it.duree.images}>
            {it.type === 'bloc' ? <ACreer it={it as Bloc} afficher={afficherConsignes} /> : (it as Plan).source.type !== 'audio' ? <PlanVideo it={it as Plan} /> : <SonSeul it={it as Plan} afficher={afficherConsignes} />}
          </Sequence>
        ))}
        {montage.superpositions.map((it) => (
          <Sequence key={it.id} name={`${it.id} (par-dessus)`} from={it.debut.image} durationInFrames={it.duree.images}>
            {it.source.type !== 'audio' ? <PlanVideo it={it} petit={it.cadre === 'incrustation'} /> : null}
          </Sequence>
        ))}
        <div ref={derriere} style={calque} />
        {plans.filter((it) => it.fichier.masques).map((it) => (
          <Sequence key={`decoupe-${it.id}`} name={`${it.id} (personne détourée)`} from={it.debut.image} durationInFrames={it.duree.images}>
            <Decoupe it={it} />
          </Sequence>
        ))}
        <div ref={milieu} style={calque} />
      </div>
      <div ref={devant} style={calque} />

      {sons.map((p) => {
        // le son peut commencer avant l'image (J-cut) et continuer après (L-cut)
        const debut = Math.max(0, p.debut.image - Math.round(p.son.avant_s * fps));
        const fin = p.fin.image + Math.round(p.son.apres_s * fps);
        const fichier = p.son.version !== 'original' && p.fichier[p.son.version] ? p.fichier[p.son.version] : p.fichier.chemin;
        const depart = p.fichier.debut_utile_s - (p.debut.image - debut) / fps;
        return (
          <Sequence key={`son-${p.id}`} name={`son ${p.id}`} from={debut} durationInFrames={Math.max(1, fin - debut)} layout="none">
            <Audio src={staticFile(fichier)} startFrom={Math.max(0, Math.round(depart * fps))} volume={volume(p.son.gain_db)} />
          </Sequence>
        );
      })}
      {/* bruitages des transitions, des titres, et ceux posés à la main. La place laissée à chacun est large (2 s) : un
          bruitage refait avec ElevenLabs a une traîne plus longue que celui d'origine (jusqu'à 1,2 s) et serait coupé net
          à la durée du catalogue ; <Audio> s'arrête de lui-même à la fin de son fichier. */}
      {(ETAT.sons as {t: number; fichier: string; volume: number}[]).map((s, i) => (
        <Sequence key={`bruitage-${i}`} name={`bruitage ${s.fichier}`} from={Math.round(s.t * fps)} durationInFrames={Math.max(1, Math.ceil(Math.max(2, dureeSon(s.fichier) + 0.05) * fps))} layout="none">
          <Audio src={staticFile(`sons/${s.fichier}`)} volume={s.volume} />
        </Sequence>
      ))}
      {afficherConsignes ? <Consignes /> : null}
    </AbsoluteFill>
  );
};

/** Durée d'un bruitage fourni (en secondes). */
function dureeSon(fichier: string): number {
  const d = Object.values(CATALOGUE as Record<string, {fichier?: string; duree?: number}>).find((x) => x.fichier === fichier);
  return d?.duree ?? 0.6;
}
