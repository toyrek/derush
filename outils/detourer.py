#!/usr/bin/env python3
"""Dérush — détoure la personne filmée, image par image, avec Apple Vision (sur le Mac, rien n'est envoyé en ligne).

Deux usages :
  detourer.py masques  <vidéo> <dossier> <t0> <t1> <fps> [largeur]
      Masques légers pour l'aperçu : m_<n>.png, n = numéro de l'image dans la vidéo (temps × fps).
  detourer.py decoupes <vidéo> <dossier> <i0> <i1> [côté max]
      Personne détourée pour le rendu : d_<i>.webp (image + transparence), pour les images i0 à i1 du fichier.

La progression est écrite sur la sortie d'erreur (« progress=NN% »).
"""
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

import Quartz
import Vision
from Foundation import NSURL

FFMPEG = os.environ.get("DERUSH_FFMPEG", "ffmpeg")


def masque_personne(chemin):
    """Masque de la personne (0 à 1) pour une image, en qualité maximale."""
    h = Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(chemin), None)
    r = Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(None)
    r.setQualityLevel_(Vision.VNGeneratePersonSegmentationRequestQualityLevelAccurate)
    r.setOutputPixelFormat_(1278226488)  # une seule couche, 8 bits
    ok, err = h.performRequests_error_([r], None)
    if not ok or not r.results():
        return None
    pb = r.results()[0].pixelBuffer()
    Quartz.CVPixelBufferLockBaseAddress(pb, 0)
    try:
        w, hh = Quartz.CVPixelBufferGetWidth(pb), Quartz.CVPixelBufferGetHeight(pb)
        bpr = Quartz.CVPixelBufferGetBytesPerRow(pb)
        brut = Quartz.CVPixelBufferGetBaseAddress(pb).as_buffer(bpr * hh)
        return np.frombuffer(brut, dtype=np.uint8).reshape(hh, bpr)[:, :w].astype(np.float32) / 255.0
    finally:
        Quartz.CVPixelBufferUnlockBaseAddress(pb, 0)


def composantes(binaire):
    """Zones d'un seul tenant d'une petite grille de 0 et de 1 : (étiquettes, nombre de zones)."""
    H, W = binaire.shape
    etiq = np.zeros((H, W), np.int32)
    n = 0
    for y0 in range(H):
        for x0 in range(W):
            if not binaire[y0, x0] or etiq[y0, x0]:
                continue
            n += 1
            pile = [(y0, x0)]
            etiq[y0, x0] = n
            while pile:
                y, x = pile.pop()
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < H and 0 <= xx < W and binaire[yy, xx] and not etiq[yy, xx]:
                        etiq[yy, xx] = n
                        pile.append((yy, xx))
    return etiq, n


def sujet_principal(m, precedent):
    """Ne garde que la personne principale (la plus grande zone, de préférence la même qu'à l'image d'avant)."""
    H, W = m.shape
    pas = max(1, max(H, W) // 160)
    petit = m[::pas, ::pas] > 0.5
    etiq, n = composantes(petit)
    if n == 0:
        return m * 0, None
    mieux, score_max = 1, -1.0
    for k in range(1, n + 1):
        zone = etiq == k
        score = float(zone.sum())
        if precedent is not None and precedent.shape == zone.shape:
            score += 3.0 * float((zone & precedent).sum())
        if score > score_max:
            mieux, score_max = k, score
    zone = etiq == mieux
    # un peu de marge autour, pour ne pas rogner les cheveux ni les doigts
    large = zone.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        large |= np.roll(np.roll(zone, dy, 0), dx, 1)
    grand = np.asarray(Image.fromarray((large * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float32) / 255.0
    return m * np.clip(grand * 2, 0, 1), zone


def extraire(video, dossier, filtre, debut_s, nombre, premier):
    """Extrait des images de la vidéo en JPEG (numérotées à partir de `premier`)."""
    args = [FFMPEG, "-v", "error", "-nostdin"]
    if debut_s is not None:
        args += ["-ss", f"{max(0.0, debut_s):.6f}"]
    args += ["-i", video, "-vf", filtre, "-fps_mode", "passthrough", "-q:v", "2", "-start_number", str(premier)]
    if nombre is not None:
        args += ["-frames:v", str(nombre)]
    subprocess.run(args + [os.path.join(dossier, "f_%07d.jpg")], check=True)


def progres(i, n):
    sys.stderr.write(f"progress={int(100 * i / max(1, n))}%\n")
    sys.stderr.flush()


def traiter(images, ecrire):
    """Détoure une suite d'images : sujet principal, puis lissage dans le temps (poids 1-2-1)."""
    precedent = None
    fenetre = []  # (numéro, chemin, masque)
    total = len(images)

    def sortir(k):
        n, chemin, m = fenetre[k]
        avant = fenetre[k - 1][2] if k > 0 else m
        apres = fenetre[k + 1][2] if k + 1 < len(fenetre) else m
        lisse = (2 * m + (avant if avant.shape == m.shape else m) + (apres if apres.shape == m.shape else m)) / 4.0
        ecrire(n, chemin, lisse)

    for i, (n, chemin) in enumerate(images):
        m = masque_personne(chemin)
        if m is None:
            m = np.zeros((16, 9), np.float32)
        m, precedent = sujet_principal(m, precedent)
        fenetre.append((n, chemin, m))
        if len(fenetre) == 3:
            if i == 2:
                sortir(0)
            sortir(1)
            fenetre.pop(0)
        progres(i + 1, total)
    if total == 1:
        sortir(0)
    elif total >= 2:
        if total == 2:
            sortir(0)
        sortir(len(fenetre) - 1)


def main():
    mode, video, dossier = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(dossier, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="derush-detourage-")
    try:
        if mode == "masques":
            t0, t1, fps = float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
            largeur = int(sys.argv[7]) if len(sys.argv) > 7 else 540
            n0, n1 = int(round(t0 * fps)), int(round(t1 * fps))
            manquants = [n for n in range(n0, n1 + 1) if not os.path.exists(os.path.join(dossier, f"m_{n}.png"))]
            if not manquants:
                progres(1, 1)
                return
            a, b = manquants[0], manquants[-1]
            # on se place une demi-image avant, pour que la première image extraite soit bien l'image a
            extraire(video, tmp, "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'", (a - 0.5) / fps, b - a + 1, a)

            def ecrire(n, chemin, m):
                alpha = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "L")
                with Image.open(chemin) as im:
                    w, h = im.size
                alpha = alpha.resize((largeur, max(2, round(largeur * h / w))), Image.LANCZOS)
                img = Image.new("LA", alpha.size, 255)
                img.putalpha(alpha)
                img.save(os.path.join(dossier, f"m_{n}.png"), optimize=False, compress_level=4)

            images = sorted((int(f[2:9]), os.path.join(tmp, f)) for f in os.listdir(tmp) if f.endswith(".jpg"))
            traiter(images, ecrire)
        elif mode == "decoupes":
            i0, i1 = int(sys.argv[4]), int(sys.argv[5])
            cote = int(sys.argv[6]) if len(sys.argv) > 6 else 1920
            extraire(video, tmp, f"select='between(n,{i0},{i1})',scale='if(gt(iw,ih),min({cote},iw),-2)':'if(gt(iw,ih),-2,min({cote},ih))'", None, None, i0)

            def ecrire(n, chemin, m):
                with Image.open(chemin) as im:
                    rgb = im.convert("RGB")
                alpha = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "L").resize(rgb.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
                rgb.putalpha(alpha)
                rgb.save(os.path.join(dossier, f"d_{n:05d}.webp"), "WEBP", quality=90, method=3)

            images = sorted((int(f[2:9]), os.path.join(tmp, f)) for f in os.listdir(tmp) if f.endswith(".jpg"))
            traiter(images, ecrire)
        else:
            raise SystemExit("Usage : detourer.py masques|decoupes …")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    sys.stderr.write("progress=100%\n")


if __name__ == "__main__":
    main()
