#!/usr/bin/env python3
"""Dérush — les dessins du graphiste (ChatGPT), mis au propre pour la vidéo (lib/graphiste.mjs).

  graphiste.py nettoyer <entree.png> <sortie.png> [--marge 0.03] [--garder-taille]
      Fond transparent : efface les pixels presque invisibles et les taches loin du sujet (le voile que laisse le
      détourage), puis recadre au sujet avec une petite marge. Une image sans transparence est copiée telle quelle.
  graphiste.py planche <entree.png> <dossier> --colonnes C --lignes L [--images N] [--opaque]
      Une planche de sprites (une grille régulière) : découpée en N images f-01.png… de même taille, nettoyées, au même
      cadre (le cadre commun de toutes les cases : le mouvement dessiné reste tel quel), plus planche.png nettoyée.

Écrit son résultat en JSON (une ligne) sur sa sortie : {"ok": true, …} ou {"ok": false, "erreur": "…"}.
"""
import json
import os
import sys

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError as e:  # sans Pillow ni numpy : Dérush range les images telles quelles
    print(json.dumps({"ok": False, "erreur": f"module absent : {e.name}"}))
    sys.exit(0)

SEUIL = 24  # alpha en dessous duquel un pixel ne se voit pas : effacé


def masque_propre(a):
    """L'alpha nettoyé : rien sous SEUIL, et rien loin d'une partie bien opaque du dessin (les taches du détourage)."""
    h, w = a.shape
    fort = Image.fromarray(((a >= 200) * 255).astype("uint8"))
    # une ouverture : les points opaques isolés de quelques pixels disparaissent
    fort = fort.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    k = max(9, int(min(w, h) * 0.012) | 1)
    zone = np.array(fort.filter(ImageFilter.MaxFilter(k))) > 0
    return np.where(zone & (a >= SEUIL), a, 0).astype("uint8")


def transparente(arr):
    """Une image a-t-elle vraiment un fond transparent (plus de 3 % de pixels invisibles) ?"""
    return arr.shape[2] == 4 and float((arr[..., 3] < 16).mean()) > 0.03


def nettoyer_rgba(arr):
    a = arr[..., 3]
    a2 = masque_propre(a)
    efface = int(((a > 0) & (a2 == 0)).sum())
    arr = arr.copy()
    arr[..., 3] = a2
    arr[a2 == 0, :3] = 0
    return arr, efface


def boite(a):
    ys, xs = np.nonzero(a)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def elargir(b, marge, w, h):
    x0, y0, x1, y1 = b
    return max(0, x0 - marge), max(0, y0 - marge), min(w, x1 + marge), min(h, y1 + marge)


def nettoyer(entree, sortie, marge=0.03, garder=False):
    im = Image.open(entree)
    im.load()
    arr = np.array(im.convert("RGBA"))
    if not transparente(arr):
        im.convert("RGB").save(sortie, optimize=True)
        return {"ok": True, "largeur": im.width, "hauteur": im.height, "transparent": False, "efface": 0}
    arr, efface = nettoyer_rgba(arr)
    h, w = arr.shape[:2]
    b = boite(arr[..., 3])
    if b and not garder:
        x0, y0, x1, y1 = elargir(b, int(max(w, h) * marge), w, h)
        arr = arr[y0:y1, x0:x1]
    Image.fromarray(arr).save(sortie, optimize=True)
    return {"ok": True, "largeur": int(arr.shape[1]), "hauteur": int(arr.shape[0]), "transparent": True, "efface": efface}


def planche(entree, dossier, colonnes, lignes, images=None, opaque=False):
    im = Image.open(entree)
    im.load()
    arr = np.array(im.convert("RGBA"))
    H, W = arr.shape[:2]
    images = min(images or colonnes * lignes, colonnes * lignes)
    cw, ch = W // colonnes, H // lignes
    transp = not opaque and transparente(arr)
    if transp:
        arr, _ = nettoyer_rgba(arr)
    cases = []
    for k in range(images):
        r, c = divmod(k, colonnes)
        # arrondi vers le bas : toutes les cases ont exactement la même taille (cw × ch), sans dépasser l'image
        x0, y0 = c * W // colonnes, r * H // lignes
        cases.append(arr[y0:y0 + ch, x0:x0 + cw])
    # les cases vides (le modèle en a dessiné moins) ne font pas une image noire dans l'animation
    pleines = [x for x in cases if not transp or boite(x[..., 3])]
    if not pleines:
        return {"ok": False, "erreur": "planche vide"}
    if transp:
        # le cadre commun : la réunion des dessins de toutes les cases, avec une petite marge
        bs = [boite(x[..., 3]) for x in pleines]
        u = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
        x0, y0, x1, y1 = elargir(u, int(max(cw, ch) * 0.03), cw, ch)
        pleines = [x[y0:y1, x0:x1] for x in pleines]
    os.makedirs(dossier, exist_ok=True)
    for k, x in enumerate(pleines):
        img = Image.fromarray(x) if transp else Image.fromarray(x).convert("RGB")
        img.save(os.path.join(dossier, f"f-{k + 1:02d}.png"), optimize=True)
    (Image.fromarray(arr) if transp else Image.fromarray(arr).convert("RGB")).save(os.path.join(dossier, "planche.png"), optimize=True)
    return {"ok": True, "images": len(pleines), "vides": len(cases) - len(pleines), "largeur": int(pleines[0].shape[1]), "hauteur": int(pleines[0].shape[0]), "transparent": transp}


def main(argv):
    if len(argv) < 3 or argv[0] not in ("nettoyer", "planche"):
        print(__doc__)
        return {"ok": False, "erreur": "usage"}
    quoi, entree, sortie, *reste = argv

    def option(nom, defaut=None):
        if nom in reste:
            i = reste.index(nom)
            return reste[i + 1] if i + 1 < len(reste) else defaut
        return defaut

    if quoi == "nettoyer":
        return nettoyer(entree, sortie, marge=float(option("--marge", 0.03)), garder="--garder-taille" in reste)
    return planche(entree, sortie, int(option("--colonnes", 4)), int(option("--lignes", 2)), int(option("--images", 0)) or None, opaque="--opaque" in reste)


if __name__ == "__main__":
    try:
        r = main(sys.argv[1:])
    except Exception as e:  # une image illisible : Dérush range la version brute
        r = {"ok": False, "erreur": str(e)[:300]}
    print(json.dumps(r))
