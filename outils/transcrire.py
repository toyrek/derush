#!/usr/bin/env python3
"""Dérush — transcription mot à mot avec Whisper, sans rien envoyer en ligne : MLX (puce Apple) ou faster-whisper (ailleurs).

Usage : python transcrire.py <fichier audio ou vidéo> <sortie.json> [langue|auto] [modèle]
La progression est écrite sur la sortie d'erreur (« progress=NN% »).

Quand le modèle est déjà sur le disque, la bibliothèque de Hugging Face est mise hors ligne (HF_HUB_OFFLINE) : sans
cela, elle demande à huggingface.co la dernière version du modèle à chaque transcription (aucun son n'était envoyé,
mais le site voyait passer chaque appel). Si le modèle sur le disque se révèle incomplet, le script se relance une fois
en ligne pour le compléter.
"""
import importlib.util
import json
import os
import re
import subprocess
import sys

import numpy as np

EN_LIGNE = "DERUSH_WHISPER_EN_LIGNE"  # « 1 » : la relance en ligne (voir plus haut), ou pour forcer un téléchargement


def nom_faster(modele):
    """Le nom du modèle pour faster-whisper (un modèle prévu pour MLX devient « large-v3-turbo »)."""
    nom = modele if "/" in modele or modele.startswith("large") or modele in ("medium", "small", "base", "tiny") else "large-v3-turbo"
    return "large-v3-turbo" if nom.startswith("mlx-community/") else nom


def depot_du_modele(modele, mlx):
    """Le dépôt Hugging Face d'où vient le modèle : celui donné à MLX, ou celui que faster-whisper prend pour ce nom."""
    if mlx:
        return modele
    nom = nom_faster(modele)
    if "/" in nom:
        return nom
    return "mobiuslabsgmbh/faster-whisper-large-v3-turbo" if nom == "large-v3-turbo" else f"Systran/faster-whisper-{nom}"


def modele_sur_disque(depot):
    """Le modèle est-il déjà dans le cache de Hugging Face ? (Le même contrôle que Dérush : ses poids sont là.)"""
    cache = os.environ.get("HF_HUB_CACHE") or os.environ.get("HUGGINGFACE_HUB_CACHE") or os.path.join(
        os.environ.get("HF_HOME") or os.path.join(os.path.expanduser("~"), ".cache", "huggingface"), "hub")
    d = os.path.join(cache, "models--" + depot.replace("/", "--"), "snapshots")
    try:
        return any(os.path.exists(os.path.join(d, s, f)) for s in os.listdir(d) for f in ("weights.safetensors", "weights.npz", "model.safetensors", "model.bin"))
    except OSError:
        return False


def hors_ligne_en_cause(e):
    """L'erreur vient-elle du mode hors ligne (un fichier du modèle qui manque sur le disque) ?"""
    noms = " ".join(c.__name__ for c in type(e).__mro__)
    return bool(re.search(r"LocalEntryNotFound|OfflineMode|EntryNotFound", noms) or re.search(r"offline|local_files_only|outgoing traffic|cannot find the requested files", str(e), re.I))


class Progression:
    """Lit la barre tqdm de Whisper et la réécrit en « progress=NN% » pour Dérush."""

    def __init__(self, flux):
        self.flux = flux
        self.dernier = -1

    def write(self, texte):
        for m in re.finditer(r"(\d+)%\|", texte):
            p = int(m.group(1))
            if p != self.dernier:
                self.dernier = p
                self.flux.write(f"progress={p}%\n")
                self.flux.flush()

    def flush(self):
        self.flux.flush()


def main():
    source, sortie = sys.argv[1], sys.argv[2]
    langue = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ("", "auto") else None
    modele = sys.argv[4] if len(sys.argv) > 4 else "mlx-community/whisper-large-v3-turbo"
    ffmpeg = os.environ.get("DERUSH_FFMPEG", "ffmpeg")
    try:
        brut = subprocess.run(
            [ffmpeg, "-v", "error", "-i", source, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
            capture_output=True, check=True,
        ).stdout
    except subprocess.CalledProcessError as e:
        # une vidéo sans piste son : FFmpeg ne trouve rien à extraire (« Stream map '0:a:0' matches no streams »)
        if b"matches no streams" in (e.stderr or b""):
            raise SystemExit("Aucun son dans ce fichier.")
        raise SystemExit("FFmpeg n’a pas pu lire le son de ce fichier : " + (e.stderr or b"").decode(errors="replace").strip()[-300:])
    audio = np.frombuffer(brut, np.int16).astype(np.float32) / 32768.0
    if audio.size == 0:
        raise SystemExit("Aucun son dans ce fichier.")

    # le modèle est déjà là : rien ne doit partir vers huggingface.co (à décider avant de charger la bibliothèque)
    mlx_installe = importlib.util.find_spec("mlx_whisper") is not None
    hors_ligne = False
    if os.environ.get(EN_LIGNE) != "1" and "HF_HUB_OFFLINE" not in os.environ and modele_sur_disque(depot_du_modele(modele, mlx_installe)):
        os.environ["HF_HUB_OFFLINE"] = "1"
        hors_ligne = True
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    try:
        return transcrire(audio, sortie, langue, modele)
    except Exception as e:  # noqa: BLE001 — seul le cas « hors ligne » est rattrapé, le reste remonte tel quel
        if not (hors_ligne and hors_ligne_en_cause(e)):
            raise
    # le modèle du disque est incomplet : une seule relance, en ligne cette fois, pour le compléter
    env = {k: v for k, v in os.environ.items() if k != "HF_HUB_OFFLINE"}
    env[EN_LIGNE] = "1"
    sys.stderr.flush()
    raise SystemExit(subprocess.run([sys.executable] + sys.argv, env=env).returncode)


def transcrire(audio, sortie, langue, modele):
    try:
        import mlx_whisper
    except ImportError:
        mlx_whisper = None

    # Whisper « nettoie » volontiers la parole : une amorce avec des hésitations l'incite à les écrire,
    # pour que Dérush puisse les enlever d'un clic (« Enlever les euh »).
    amorces = {
        "fr": "Euh… alors, hum, je vais vous expliquer, euh, comment ça s'est passé.",
        "en": "Um, so, uh, let me tell you, hmm, how it went.",
        "es": "Eh… bueno, este, te cuento, eh, cómo pasó.",
    }
    erreur = sys.stderr
    if mlx_whisper is None:
        return transcrire_faster(audio, sortie, langue, modele, amorces, erreur)
    sys.stderr = Progression(erreur)
    try:
        r = mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=modele,
            language=langue,
            word_timestamps=True,
            verbose=False,
            condition_on_previous_text=False,
            hallucination_silence_threshold=2.0,
            initial_prompt=amorces.get(langue or "", None),
        )
    finally:
        sys.stderr = erreur
    segments = [
        {
            "start": s["start"],
            "end": s["end"],
            "text": s["text"],
            "words": [
                {"word": w["word"], "start": w["start"], "end": w["end"], "probability": w.get("probability")}
                for w in s.get("words", [])
            ],
        }
        for s in r["segments"]
    ]
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump({"language": r.get("language"), "modele": modele, "segments": segments}, f, ensure_ascii=False)
    erreur.write("progress=100%\n")


def transcrire_faster(audio, sortie, langue, modele, amorces, erreur):
    """faster-whisper (CTranslate2) : même sortie que MLX, avec les temps de chaque mot."""
    from faster_whisper import WhisperModel

    nom = nom_faster(modele)
    m = WhisperModel(nom, device="auto", compute_type="auto")
    morceaux, info = m.transcribe(
        audio, language=langue, word_timestamps=True, condition_on_previous_text=False,
        initial_prompt=amorces.get(langue or "", None), vad_filter=False,
    )
    duree = max(len(audio) / 16000.0, 0.001)
    segments = []
    for s in morceaux:
        segments.append({
            "start": s.start, "end": s.end, "text": s.text,
            "words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in (s.words or [])],
        })
        erreur.write(f"progress={min(99, int(100 * s.end / duree))}%\n")
        erreur.flush()
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump({"language": info.language, "modele": nom, "segments": segments}, f, ensure_ascii=False)
    erreur.write("progress=100%\n")


if __name__ == "__main__":
    main()
