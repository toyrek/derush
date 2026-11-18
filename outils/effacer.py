"""Dérush — l'effaceur de texte incrusté (sous-titres d'une appli, titre, filigrane), image par image.

    python effacer.py <entrée> <sortie.mp4> [--de S] [--a S] [--zone x,y,l,h] [--methode auto|lama|telea]
                      [--modele lama_fp32.onnx] [--cache dossier] [--pas 2] [--hauteur-min 0.022]

Où est le texte : Apple Vision le lit (une image sur --pas, gardé jusqu'à la lecture suivante), sur Mac ; ailleurs,
ou pour ne pas toucher au texte filmé (une enseigne), --zone donne la bande à vider (en fractions de l'image : 0.05,0.72,
0.9,0.16, ou en pixels). Seules les lignes d'au moins --hauteur-min de la hauteur comptent (un sous-titre, un titre).
Le trou : les lettres et leur contour (d'après leur couleur), élargis ; la boîte entière si la couleur ne tranche pas.
Le remplissage : LaMa (big-lama en ONNX, Apache-2.0) sur un carré autour du texte ramené à 512 px, par CoreML sur Mac ;
Telea (OpenCV) si le modèle manque ou sur demande (aussi bon sur un fond uni, quinze fois plus rapide).
Le son est recopié tel quel. Réponse : une ligne JSON sur la sortie ; « progress=NN% » sur la sortie d'erreur.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

import cv2
import numpy as np

FFMPEG = os.environ.get("DERUSH_FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("DERUSH_FFPROBE", "ffprobe")

p = argparse.ArgumentParser()
p.add_argument("entree")
p.add_argument("sortie")
p.add_argument("--de", type=float, default=0.0)
p.add_argument("--a", type=float, default=None)
p.add_argument("--zone", default=None)
p.add_argument("--methode", default="auto", choices=["auto", "lama", "telea"])
p.add_argument("--modele", default=None)
p.add_argument("--cache", default=None)
p.add_argument("--pas", type=int, default=2)
p.add_argument("--hauteur-min", type=float, default=0.022)
A = p.parse_args()

v = json.loads(subprocess.check_output([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                                        "stream=width,height,avg_frame_rate:format=duration", "-of", "json", A.entree]))
W, H = int(v["streams"][0]["width"]), int(v["streams"][0]["height"])
fps_txt = v["streams"][0]["avg_frame_rate"]
n_, d_ = (fps_txt.split("/") + ["1"])[:2]
FPS = float(n_) / float(d_ or 1) if float(d_ or 1) else 30.0
DUREE = float(v.get("format", {}).get("duration") or 0)
FIN = A.a if A.a is not None else DUREE or 1e9


def zone_fixe():
    """--zone : en fractions (toutes ≤ 1) ou en pixels ; renvoie [x0, y0, x1, y1] en pixels."""
    if not A.zone:
        return None
    x, y, l, h = [float(t) for t in A.zone.replace(";", ",").split(",")[:4]]
    if max(x, y, l, h) <= 1:
        x, y, l, h = x * W, y * H, l * W, h * H
    return [int(max(0, x)), int(max(0, y)), int(min(W, x + l)), int(min(H, y + h))]


ZONE = zone_fixe()

# ——— lire le texte (Apple Vision, sur Mac) ———
VISION = None
if ZONE is None:
    try:
        import Vision  # noqa: N813 (pyobjc)
        from Foundation import NSURL
        VISION = (Vision, NSURL)
    except Exception:  # pas sur Mac, ou pyobjc absent
        VISION = None
if ZONE is None and VISION is None:
    print(json.dumps({"ok": False, "erreur": "Sans Apple Vision (Mac), donne la bande à vider : --zone x,y,l,h (fractions de l'image)."}))
    sys.exit(0)
TMP = tempfile.mkdtemp(prefix="derush-effacer-")


def boites_vision(img):
    """Les lignes de texte lues par Apple Vision (niveau précis), en pixels, assez hautes pour compter."""
    Vision, NSURL = VISION
    f = os.path.join(TMP, "image.jpg")
    cv2.imwrite(f, cv2.cvtColor(img, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(0)  # précis : il couvre mieux le contour des lettres
    req.setUsesLanguageCorrection_(False)
    h = Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(f), None)
    h.performRequests_error_([req], None)
    r = []
    for o in req.results() or []:
        b = o.boundingBox()
        if b.size.height < A.hauteur_min:
            continue
        r.append([int(b.origin.x * W), int((1 - b.origin.y - b.size.height) * H), int((b.origin.x + b.size.width) * W), int((1 - b.origin.y) * H)])
    return r


def lignes(bx):
    """Apple Vision coupe parfois une ligne en morceaux (et oublie un petit mot entre eux) : on joint ceux d'une même ligne."""
    r = []
    for b in sorted(bx, key=lambda b: (b[1], b[0])):
        lg = next((x for x in r if abs((x[1] + x[3]) - (b[1] + b[3])) / 2 < 0.5 * (b[3] - b[1])), None)
        if lg:
            lg[:] = [min(lg[0], b[0]), min(lg[1], b[1]), max(lg[2], b[2]), max(lg[3], b[3])]
        else:
            r.append(list(b))
    return r


def masque(img, bx, marge=8):
    """Les lettres et leur contour dans chaque ligne (élargis) ; la boîte entière si la couleur ne tranche pas."""
    m = np.zeros((H, W), np.uint8)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    for x0, y0, x1, y1 in (bx if ZONE else lignes(bx)):
        x0, y0, x1, y1 = max(0, x0 - marge), max(0, y0 - marge), min(W, x1 + marge), min(H, y1 + marge)
        if x1 <= x0 or y1 <= y0:
            continue
        val, sat = hsv[y0:y1, x0:x1, 2], hsv[y0:y1, x0:x1, 1]
        lettres = ((val > 225) & ((sat < 40) | (sat > 200))) | (val < 35)  # blanc ou couleur vive, contour sombre
        m[y0:y1, x0:x1] = lettres * 255 if 0.05 < lettres.mean() < 0.7 else 255
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))


# ——— remplir (LaMa, sinon Telea) ———
LAMA = None
if A.methode != "telea" and A.modele and os.path.exists(A.modele):
    try:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.add_free_dimension_override_by_name("batch", 1)  # CoreML refuse une dimension libre
        fournisseurs = ["CPUExecutionProvider"]
        if "CoreMLExecutionProvider" in ort.get_available_providers():
            cache = A.cache or os.path.join(tempfile.gettempdir(), "derush-effaceur-coreml")
            os.makedirs(cache, exist_ok=True)
            fournisseurs = [("CoreMLExecutionProvider", {"ModelFormat": "MLProgram", "MLComputeUnits": "CPUAndGPU", "ModelCacheDirectory": cache}), "CPUExecutionProvider"]
        LAMA = ort.InferenceSession(A.modele, so, providers=fournisseurs)
    except Exception as e:  # CoreML refusé (bac à sable…) : le processeur seul
        try:
            LAMA = ort.InferenceSession(A.modele, so, providers=["CPUExecutionProvider"])
        except Exception:
            print(f"LaMa indisponible ({e}) : Telea à la place", file=sys.stderr)
            LAMA = None
if A.methode == "lama" and LAMA is None:
    print(json.dumps({"ok": False, "erreur": "LaMa n'est pas installé (Connexions › Effaceur de texte) : prends --methode telea."}))
    sys.exit(0)


def remplir(img, m, marge=96):
    ys, xs = np.nonzero(m)
    if not len(ys):
        return img
    if LAMA is None:
        return cv2.inpaint(img, m, 5, cv2.INPAINT_TELEA)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    c = int(min(max(y1 - y0, x1 - x0) + 2 * marge, W, H))
    ty = int(np.clip((y0 + y1) // 2 - c // 2, 0, H - c))
    tx = int(np.clip((x0 + x1) // 2 - c // 2, 0, W - c))
    crop, mc = img[ty:ty + c, tx:tx + c], m[ty:ty + c, tx:tx + c]
    x = cv2.resize(crop, (512, 512), interpolation=cv2.INTER_AREA).astype(np.float32).transpose(2, 0, 1)[None] / 255
    mm = (cv2.resize(mc, (512, 512), interpolation=cv2.INTER_AREA) > 0).astype(np.float32)[None, None]
    y = LAMA.run(None, {"image": x, "mask": mm})[0][0].transpose(1, 2, 0)
    y = cv2.resize(np.clip(y, 0, 255).astype(np.uint8), (c, c), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    a = cv2.GaussianBlur(cv2.dilate(mc, np.ones((5, 5), np.uint8)), (0, 0), 2).astype(np.float32)[..., None] / 255
    img[ty:ty + c, tx:tx + c] = (crop * (1 - a) + y * a).round().astype(np.uint8)
    return img


# ——— la vidéo, image par image (le son recopié) ———
dec = subprocess.Popen([FFMPEG, "-v", "error", "-i", A.entree, "-map", "0:v:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen([FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", fps_txt,
                        "-i", "-", "-i", A.entree, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "14", "-preset", "medium",
                        "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", A.sortie], stdin=subprocess.PIPE)
n, effacees, t0, boites, total = 0, 0, time.perf_counter(), [], max(1, int((min(FIN, DUREE or FIN) - A.de) * FPS))
taille = W * H * 3
while True:
    buf = dec.stdout.read(taille)
    if len(buf) < taille:
        break
    t = n / FPS
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
    if A.de <= t <= FIN:
        if ZONE:
            boites = [ZONE]
        elif (n - int(A.de * FPS)) % max(1, A.pas) == 0:
            boites = boites_vision(img)
        if boites:
            img = remplir(img, masque(img, boites))
            effacees += 1
        k = n - int(A.de * FPS)
        if k % 15 == 0:
            print(f"progress={min(99, int(k / total * 100))}%", file=sys.stderr, flush=True)
    enc.stdin.write(img.tobytes())
    n += 1
enc.stdin.close()
code = enc.wait()
dec.wait()
print(json.dumps({"ok": code == 0, "images": n, "effacees": effacees, "methode": "lama" if LAMA is not None else "telea",
                  "lecture": "zone" if ZONE else "vision", "duree_s": round(time.perf_counter() - t0, 1), "sortie": A.sortie}))
sys.exit(0)  # le compte rendu dit si tout s'est bien passé (« ok »)
