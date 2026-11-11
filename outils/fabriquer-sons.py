#!/usr/bin/env python3
"""Dérush — fabrique les bruitages fournis avec l'app (synthèse pure : aucun échantillon, aucun droit à demander).

Usage : python fabriquer-sons.py <dossier de sortie>      (il faut numpy)
"""
import os
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def ecrire(chemin, g, d=None):
    d = g if d is None else d
    x = np.stack([g, d], axis=1)
    x = x / max(1e-9, np.abs(x).max()) * 10 ** (-3 / 20)  # crête à -3 dBFS
    with wave.open(chemin, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def passe_bas(x, fc):
    """Passe-bas à un pôle ; fc (Hz) peut varier d'un échantillon à l'autre."""
    k = 1 - np.exp(-2 * np.pi * np.broadcast_to(fc, x.shape) / SR)
    y = np.empty_like(x)
    a = 0.0
    for i in range(len(x)):
        a += k[i] * (x[i] - a)
        y[i] = a
    return y


def bruit(n):
    return rng.standard_normal(n)


def souffle(duree=0.55):
    """Souffle qui monte et se coupe net : à jouer juste avant un impact."""
    n = int(duree * SR)
    t = np.linspace(0, 1, n)
    env = t ** 2.4 * (1 - np.clip((t - 0.97) / 0.03, 0, 1))
    fc = 300 + 9000 * t ** 2.2
    pan = 0.5 + 0.35 * np.sin(np.pi * t)
    return passe_bas(bruit(n), fc) * env * (1 - pan) * 2, passe_bas(bruit(n), fc) * env * pan * 2


def passage(duree=0.36):
    """Passage d'air rapide (monte puis redescend) : coup de zoom, changement de plan."""
    n = int(duree * SR)
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * t) ** 1.6
    fc = 500 + 6500 * np.sin(np.pi * t) ** 2
    pan = t
    return passe_bas(bruit(n), fc) * env * (1 - pan * 0.7), passe_bas(bruit(n), fc) * env * (0.3 + pan * 0.7)


def fouet(duree=0.2):
    """Coup de fouet : sifflement très bref."""
    n = int(duree * SR)
    t = np.linspace(0, 1, n)
    env = np.exp(-((t - 0.32) / 0.16) ** 2)
    haut = bruit(n) - passe_bas(bruit(n), 1800)
    x = passe_bas(haut, 2500 + 9000 * np.exp(-((t - 0.3) / 0.2) ** 2)) * env
    return x, x


def impact(duree=0.45):
    """Coup sourd : une basse qui descend, avec un petit claquement."""
    n = int(duree * SR)
    t = np.arange(n) / SR
    f = 95 * np.exp(-t * 9) + 42
    corps = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    clic = passe_bas(bruit(n), 2500.0) * np.exp(-t * 90) * 0.6
    return corps + clic, corps + clic


def declic(duree=0.14):
    """Déclic d'appareil photo : deux clics très courts."""
    n = int(duree * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for t0, force in ((0.0, 1.0), (0.062, 0.8)):
        d = np.clip(t - t0, 0, None)
        x += force * (t >= t0) * (bruit(n) - passe_bas(bruit(n), 3500.0)) * np.exp(-d * 240)
        x += force * 0.5 * (t >= t0) * np.sin(2 * np.pi * 1900 * d) * np.exp(-d * 160)
    return x, x


def pop(duree=0.09):
    """Petit « pop » : apparition d'un mot ou d'une pastille."""
    n = int(duree * SR)
    t = np.arange(n) / SR
    f = 420 + 900 * (t / duree)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * np.minimum(1, t * 900)
    return x, x


def glitch(duree=0.26):
    """Parasites numériques : rafales hachées."""
    n = int(duree * SR)
    t = np.arange(n) / SR
    pas = 96
    brut = np.repeat(bruit(n // pas + 1), pas)[:n]
    porte = (np.sin(2 * np.pi * 31 * t) > -0.2) * (np.sin(2 * np.pi * 13 * t + 1) > -0.5)
    bip = np.sign(np.sin(2 * np.pi * (700 + 500 * np.sign(np.sin(2 * np.pi * 9 * t))) * t)) * 0.35
    x = (brut * 0.8 + bip) * porte * np.exp(-t * 5)
    return x, np.roll(x, 90)


if __name__ == "__main__":
    dossier = sys.argv[1]
    os.makedirs(dossier, exist_ok=True)
    for nom, f in (("souffle", souffle), ("passage", passage), ("fouet", fouet), ("impact", impact), ("declic", declic), ("pop", pop), ("glitch", glitch)):
        ecrire(os.path.join(dossier, f"{nom}.wav"), *f())
        print(nom)
