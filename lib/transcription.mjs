// Dérush — transcription mot à mot : Whisper sur le Mac, import de fichiers existants, ElevenLabs Scribe en option.
// Format interne (cache .derush/medias/<id>/mots.json) : {t, d, f, loc?, p?, ev?} — d et f en secondes dans le fichier source.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg, ecrireJson, lireJson} from './outils.mjs';
import {etatMoteurs, lancerPython, MODELE_WHISPER, DOSSIER_SUPPORT} from './moteurs.mjs';
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {chargerCle} from "./elevenlabs.mjs";
import {arrondi} from './commun.mjs';

function normaliser(mots) {
  return mots
    .filter((w) => w.t && Number.isFinite(w.d) && Number.isFinite(w.f))
    .map((w) => ({...w, d: arrondi(w.d, 3), f: arrondi(Math.max(w.f, w.d), 3)}))
    .sort((a, b) => a.d - b.d);
}

/** Répartit les mots d'une phrase sur sa durée, au prorata de leur longueur (quand on n'a pas l'horodatage mot à mot). */
function repartir(texte, debut, fin, loc) {
  const mots = String(texte).trim().split(/\s+/).filter(Boolean);
  const total = mots.reduce((s, w) => s + w.length + 1, 0);
  let t = debut;
  return mots.map((w) => {
    const d = ((w.length + 1) / total) * (fin - debut);
    const r = {t: w, d: t, f: t + d, ...(loc != null ? {loc: String(loc)} : {})};
    t += d;
    return r;
  });
}

/** JSON d'ElevenLabs, Whisper, faster-whisper, WhisperX, whisper.cpp, transformers.js (ou JSONL de segments). */
export function depuisJson(d) {
  const mots = [];
  let approx = false;
  const ajouter = (t, s, e, loc, p, ev) => {
    t = String(t ?? '').trim();
    if (!t || !Number.isFinite(Number(s)) || !Number.isFinite(Number(e))) return;
    mots.push({t, d: Number(s), f: Number(e), ...(loc != null ? {loc: String(loc)} : {}), ...(p != null && Number.isFinite(Number(p)) ? {p: arrondi(Number(p), 3)} : {}), ...(ev ? {ev: true} : {})});
  };
  const mot = (w, loc) => ajouter(
    w.text ?? w.word ?? w.w,
    w.start ?? w.s ?? (w.offsets ? w.offsets.from / 1000 : undefined),
    w.end ?? w.e ?? (w.offsets ? w.offsets.to / 1000 : undefined),
    w.speaker_id ?? w.speakerId ?? w.speaker ?? loc,
    w.probability ?? w.p ?? w.confidence ?? w.score,
    w.type === 'audio_event',
  );
  const segments = Array.isArray(d) ? d : (d?.segments ?? d?.transcription ?? d?.chunks ?? null);
  if (Array.isArray(d?.words)) {
    for (const w of d.words) if (!w.type || w.type === 'word' || w.type === 'audio_event') mot(w);
  } else if (Array.isArray(segments)) {
    for (const s of segments) {
      if (Array.isArray(s.words) && s.words.length) for (const w of s.words) mot(w, s.speaker);
      else if (s.offsets && s.text != null) ajouter(s.text, s.offsets.from / 1000, s.offsets.to / 1000);
      else if (Array.isArray(s.timestamp) && s.text != null) ajouter(s.text, s.timestamp[0], s.timestamp[1]);
      else if (s.text != null && (s.start ?? s.s) != null) {
        approx = true;
        mots.push(...repartir(s.text, Number(s.start ?? s.s), Number(s.end ?? s.e), s.speaker));
      }
    }
  }
  if (!mots.length) throw new Error('Aucun mot horodaté dans ce fichier. Formats lus : ElevenLabs, Whisper, WhisperX, whisper.cpp, SRT, VTT.');
  return {mots: normaliser(mots), approx, langue: d?.language_code ?? d?.languageCode ?? d?.language ?? null};
}

const lireHorodatage = (x) => {
  const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(x);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`) : NaN;
};

/** Sous-titres SRT ou VTT : horodatage par phrase, réparti ensuite mot à mot (approximatif). */
export function depuisSousTitres(txt) {
  const mots = [];
  for (const bloc of txt.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lignes = bloc.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lignes.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lignes[i].split('-->').map((x) => lireHorodatage(x.trim().split(/\s+/)[0]));
    const texte = lignes.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
    if (Number.isFinite(a) && Number.isFinite(z) && z > a && texte) mots.push(...repartir(texte, a, z));
  }
  if (!mots.length) throw new Error('Aucun sous-titre lisible dans ce fichier.');
  return {mots: normaliser(mots), approx: true, langue: null};
}

/** Lit un fichier de transcription quel que soit son format. */
export function lireFichierTranscription(nom, texte) {
  const brut = String(texte).replace(/^﻿/, '');
  const debut = brut.trimStart();
  if (/\.(srt|vtt)$/i.test(nom) || debut.startsWith('WEBVTT') || (!/^[[{]/.test(debut) && /-->/.test(brut.slice(0, 3000)))) return depuisSousTitres(brut);
  let d;
  try {
    d = JSON.parse(brut);
  } catch {
    try {
      d = brut.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      throw new Error('Fichier illisible : ni JSON, ni JSONL, ni SRT, ni VTT.');
    }
  }
  return depuisJson(d);
}

export function enregistrer(P, m, res, moteur) {
  const D = P.dossierMedia(m.id);
  const cree = new Date().toISOString();
  ecrireJson(path.join(D, 'mots.json'), {moteur, langue: res.langue, approx: res.approx, cree_le: cree, mots: res.mots}, 0);
  m.transcription = {moteur, mots: res.mots.length, langue: res.langue, approx: !!res.approx, cree_le: cree};
  P.sauver();
  return m.transcription;
}

export const lireMots = (P, m) => lireJson(path.join(P.cache, 'medias', m.id, 'mots.json'))?.mots ?? null;

// ——— Moteurs ———

let SDK;
async function sdkElevenLabs() {
  if (SDK == null) {
    try {
      SDK = await import("@elevenlabs/elevenlabs-js");
    } catch {
      // sinon, le module installé dans le dossier de Dérush au branchement (il survit aux mises à jour de l'app)
      try {
        const m = await import(pathToFileURL(createRequire(path.join(DOSSIER_SUPPORT, "package.json")).resolve("@elevenlabs/elevenlabs-js")).href);
        SDK = m.ElevenLabsClient ? m : m.default;
      } catch {
        SDK = null;
      }
    }
  }
  return SDK;
}

/**
 * Le module ElevenLabs est-il installé ? On regarde seulement s'il est là, sans le charger : son chargement arrête
 * Dérush une demi-seconde, et cette question est posée à chaque ouverture.
 */
function sdkPresent() {
  for (const base of [import.meta.url, pathToFileURL(path.join(DOSSIER_SUPPORT, "package.json")).href]) {
    try { createRequire(base).resolve("@elevenlabs/elevenlabs-js"); return true; } catch { /* pas ici */ }
  }
  return false;
}

/** Moteurs utilisables sur cette machine, avec la raison quand l'un ne l'est pas. */
export async function moteurs() {
  const r = {};
  const local = (await etatMoteurs()).whisper;
  r.whisper = local.ok ? {ok: true, nom: "Whisper (sur ton ordinateur)", detail: local.detail} : {ok: false, installable: local.installable, taille: local.taille, pourquoi: local.pourquoi};
  if (!chargerCle()) r.elevenlabs = {ok: false, pourquoi: "Option : ElevenLabs n'est pas branché (Réglages)."};
  else if (!sdkPresent()) r.elevenlabs = {ok: false, pourquoi: "Option : le module ElevenLabs n'est pas installé (rebranche ElevenLabs dans les Réglages)."};
  else r.elevenlabs = {ok: true, nom: "ElevenLabs Scribe v2", detail: "En ligne, payant, sépare les voix des locuteurs."};
  return r;
}

/** Transcrit un rush avec le moteur demandé et enregistre le résultat. */
export async function transcrire(P, m, moteur, prog) {
  if (!m.audio) throw new Error("Ce rush n'a pas de son.");
  const D = P.dossierMedia(m.id);
  let res;
  if (moteur === "whisper") {
    const etat = (await etatMoteurs()).whisper;
    if (!etat.ok) throw new Error(etat.pourquoi);
    const sortie = path.join(D, "whisper.json");
    await lancerPython("transcrire.py", [m.chemin, sortie, process.env.DERUSH_LANGUE || P.d.langue || "fr", MODELE_WHISPER], prog);
    res = depuisJson(lireJson(sortie));
  } else if (moteur === "elevenlabs") {
    const S = await sdkElevenLabs();
    if (!S || !chargerCle()) throw new Error((await moteurs()).elevenlabs.pourquoi);
    const audio = path.join(D, "pour-transcription.mp3");
    await ffmpeg(["-y", "-i", m.chemin, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio], {duree: m.duree, prog: (p) => prog(p * 0.15)});
    prog(0.2);
    try {
      const client = new S.ElevenLabsClient();
      const langue = process.env.DERUSH_LANGUE || P.d.langue;
      const r = await client.speechToText.convert({
        file: fs.createReadStream(audio), modelId: "scribe_v2", timestampsGranularity: "word", diarize: true, tagAudioEvents: true,
        ...(langue && langue !== "auto" ? {languageCode: langue} : {}),
      });
      ecrireJson(path.join(D, "elevenlabs-brut.json"), r);
      res = depuisJson(r);
    } finally {
      fs.rmSync(audio, {force: true});
    }
  } else {
    throw new Error(`Moteur inconnu : ${moteur}`);
  }
  return enregistrer(P, m, res, moteur === "whisper" ? "whisper (sur l’ordinateur)" : "elevenlabs scribe v2");
}
