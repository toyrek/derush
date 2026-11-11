#!/usr/bin/env python3
"""Dérush — transcription mot à mot avec Whisper, sans rien envoyer en ligne : MLX (puce Apple) ou faster-whisper (ailleurs).

Usage : python transcrire.py <fichier audio ou vidéo> <sortie.json> [langue|auto] [modèle]
La progression est écrite sur la sortie d'erreur (« progress=NN% »).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np


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
    brut = subprocess.run(
        [ffmpeg, "-v", "error", "-i", source, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    audio = np.frombuffer(brut, np.int16).astype(np.float32) / 32768.0
    if audio.size == 0:
        raise SystemExit("Aucun son dans ce fichier.")

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

    nom = modele if "/" in modele or modele.startswith("large") or modele in ("medium", "small", "base", "tiny") else "large-v3-turbo"
    if nom.startswith("mlx-community/"):
        nom = "large-v3-turbo"
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
