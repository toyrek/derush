#!/usr/bin/env python3
"""Dérush — sépare la voix de tout le reste (musique, ambiance, bruit) avec Demucs (htdemucs).

Usage : python voix.py <fichier audio ou vidéo> <dossier de sortie>
Écrit voix.flac et fond.flac (stéréo, même durée que la source, à l'échantillon près).
Le fichier est traité par morceaux de 30 s (avec 1 s de contexte de chaque côté) : la mémoire reste faible,
même pour un podcast d'une heure.
"""
import math
import os
import subprocess
import sys

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

MORCEAU = 30.0
MARGE = 1.0


def separer(modele, x, appareil):
    ref = x.mean(0)
    moyenne, ecart = ref.mean(), ref.std() + 1e-8
    with torch.no_grad():
        y = apply_model(modele, ((x - moyenne) / ecart)[None].to(appareil), device=appareil, shifts=0, split=True, overlap=0.25, progress=False)[0]
    return (y.cpu() * ecart) + moyenne


def main():
    source, dossier = sys.argv[1], sys.argv[2]
    ffmpeg = os.environ.get("DERUSH_FFMPEG", "ffmpeg")
    modele = get_model("htdemucs")
    modele.eval()
    sr = modele.samplerate
    i_voix = modele.sources.index("vocals")

    # le son entier décodé une fois en PCM 16 bits : chaque morceau est ensuite lu à l'échantillon près
    pcm = os.path.join(dossier, "voix.part.pcm")
    subprocess.run([ffmpeg, "-y", "-v", "error", "-i", source, "-map", "0:a:0", "-ac", "2", "-ar", str(sr), "-f", "s16le", pcm], check=True)
    tout = np.memmap(pcm, dtype=np.int16, mode="r").reshape(-1, 2)
    total = tout.shape[0]
    n = max(1, math.ceil(total / (MORCEAU * sr)))
    appareil = "mps" if torch.backends.mps.is_available() else "cpu"
    modele.to(appareil)
    voix = sf.SoundFile(os.path.join(dossier, "voix.part.flac"), "w", sr, 2, "PCM_16", format="FLAC")
    fond = sf.SoundFile(os.path.join(dossier, "fond.part.flac"), "w", sr, 2, "PCM_16", format="FLAC")
    try:
        for k in range(n):
            d = round(k * MORCEAU * sr)
            f = min(total, round((k + 1) * MORCEAU * sr))
            a = max(0, d - round(MARGE * sr))
            b = min(total, f + round(MARGE * sr))
            x = torch.from_numpy((tout[a:b].astype(np.float32) / 32768.0).T.copy())
            try:
                y = separer(modele, x, appareil)
            except Exception:
                if appareil == "cpu":
                    raise
                appareil = "cpu"  # certaines opérations ne passent pas sur le GPU : on continue sur le processeur
                modele.to(appareil)
                y = separer(modele, x, appareil)
            v = y[i_voix]
            reste = torch.stack([y[j] for j in range(y.shape[0]) if j != i_voix]).sum(0)
            voix.write(v[:, d - a:f - a].T.numpy().clip(-1, 1))
            fond.write(reste[:, d - a:f - a].T.numpy().clip(-1, 1))
            sys.stderr.write(f"progress={int((k + 1) * 100 / n)}%\n")
            sys.stderr.flush()
    finally:
        voix.close()
        fond.close()
        del tout
        os.remove(pcm)
    os.replace(os.path.join(dossier, "voix.part.flac"), os.path.join(dossier, "voix.flac"))
    os.replace(os.path.join(dossier, "fond.part.flac"), os.path.join(dossier, "fond.flac"))


if __name__ == "__main__":
    main()
