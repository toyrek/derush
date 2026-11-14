// Dérush — la vitrine des pièces (composition « Pieces ») : pour voir chacune avant de s'en servir, au format du projet.
//   node remotion/images.mjs Pieces --de 0 --a 17 --pas 15
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Barreaux, BoutonAbonnement, CarteListe, CartonDeFin, CasesQuiSeDessinent, Etiquette, SousTitres, TitreGeant, VieuxPapier} from './index';

/** Un fond qui vit (dégradé lent) : la vitrine n'a pas de rush. */
const Fond: React.FC = () => {
  const f = useCurrentFrame();
  const a = 200 + 30 * Math.sin(f / 40);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${50 + 20 * Math.sin(f / 55)}% 35%, hsl(${a} 55% 32%) 0%, hsl(${a + 30} 50% 12%) 55%, #07070a 100%)`}}>
      <div style={{position: 'absolute', left: '28%', top: '44%', width: '44%', height: '60%', borderRadius: '45% 45% 12% 12%', background: 'rgba(255,255,255,.06)'}} />
      <div style={{position: 'absolute', left: '39%', top: '30%', width: '22%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(255,255,255,.07)'}} />
    </AbsoluteFill>
  );
};
/** Une page claire (un manga, un document) pour les effets qui s'y posent. */
const Page: React.FC = () => (
  <AbsoluteFill style={{background: '#f3efe6', padding: '12%'}}>
    {Array.from({length: 14}, (_, i) => <div key={i} style={{height: 14, margin: '22px 0', background: '#1c1c1c', opacity: 0.12 + (i % 3) * 0.05, width: `${60 + ((i * 37) % 35)}%`}} />)}
  </AbsoluteFill>
);

const phrase = 'J’ai reçu la nouveauté Fire ! de Hideko Mizuno, dans la collection Héritages.';
const motsDemo = phrase.split(' ').map((t, i) => ({t, debut: 0.25 + i * 0.27, fin: 0.25 + i * 0.27 + 0.24}));

export const DemoPieces: React.FC = () => {
  const {fps} = useVideoConfig();
  const s = (x: number) => Math.round(x * fps);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Sequence durationInFrames={s(2.5)} name="TitreGeant"><Fond /><TitreGeant texte={'RÉCEPTION\nPRESSE'} surTitre="AKATA · HÉRITAGES" duree={s(2.5)} /></Sequence>
      <Sequence from={s(2.5)} durationInFrames={s(3)} name="Etiquette et SousTitres">
        <Fond /><Etiquette texte="SERVICE PRESSE · AKATA" duree={s(3)} /><SousTitres mots={motsDemo} />
      </Sequence>
      <Sequence from={s(5.5)} durationInFrames={s(3)} name="CarteListe">
        <Fond /><CarteListe surTitre="La collection" titre="HÉRITAGES" elements={['Moto Hagio', 'Hideko Mizuno', 'Keiko Takemiya', 'Riyoko Ikeda']} duree={s(3)} />
      </Sequence>
      <Sequence from={s(8.5)} durationInFrames={s(2)} name="Barreaux"><Page /><Barreaux duree={s(2)} /></Sequence>
      <Sequence from={s(10.5)} durationInFrames={s(2)} name="VieuxPapier et Cases"><VieuxPapier><Page /></VieuxPapier><CasesQuiSeDessinent duree={s(2)} /></Sequence>
      <Sequence from={s(12.5)} durationInFrames={s(2)} name="BoutonAbonnement"><Fond /><BoutonAbonnement duree={s(2)} /></Sequence>
      <Sequence from={s(14.5)} durationInFrames={s(3)} name="CartonDeFin">
        <CartonDeFin titre="FIRE !" auteur="Hideko Mizuno" editeur="Akata · Héritages" detail="Volume 1"><Fond /></CartonDeFin>
      </Sequence>
    </AbsoluteFill>
  );
};
export const DUREE_DEMO_S = 17.5;
