#!/usr/bin/env python3
"""Dérush — lit le texte à l'écran sur des images d'une vidéo, avec Apple Vision (sur le Mac, rien n'est envoyé en ligne).

Deux usages :
  controle.py lire <dossier d'images> <sortie.json>
      Pour chaque image (ordre alphabétique) : chaque ligne de texte lue, et chaque mot avec sa boîte
      (x, y, l, h en fractions de l'image, origine en haut à gauche) et la confiance de la lecture.
      « connu » dit si le correcteur du Mac connaît le mot (français ou anglais) : un vrai mot n'est pas deux mots collés.
  controle.py planche <description.json> <sortie.jpg>
      Une planche d'images réduites, avec des boîtes de couleur et une légende par image :
      {"colonnes": 8, "largeur": 220, "images": [{"fichier": "...", "legende": "3,5 s", "boites": [{"x": 0.1, "y": 0.2, "l": 0.3, "h": 0.05, "couleur": "#ff3030"}]}]}

La progression est écrite sur la sortie d'erreur (« progress=NN% »).
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def correcteur():
    """Le correcteur d'orthographe du Mac : dit si un mot existe en français ou en anglais (None s'il manque)."""
    try:
        from AppKit import NSSpellChecker
        sc = NSSpellChecker.sharedSpellChecker()
        langues = [x for x in ("fr", "en") if x in (sc.availableLanguages() or [])]
    except Exception:
        return None
    memo = {}

    def connu(mot):
        m = mot.lower()
        if m not in memo:
            memo[m] = any(sc.checkSpellingOfString_startingAt_language_wrap_inSpellDocumentWithTag_wordCount_(m, 0, l, False, 0, None)[0].length == 0 for l in langues)
        return memo[m]

    return connu if langues else None


def lire(dossier, sortie):
    import Vision
    from Foundation import NSURL

    connu = correcteur()

    fichiers = sorted(glob.glob(os.path.join(dossier, "*.jpg")) + glob.glob(os.path.join(dossier, "*.png")))
    req = Vision.VNRecognizeTextRequest.alloc().initWithCompletionHandler_(None)
    req.setRecognitionLevel_(0)  # précis
    langues = [x for x in ("fr-FR", "en-US", "es-ES", "de-DE", "it-IT", "pt-BR") if x in (req.supportedRecognitionLanguagesAndReturnError_(None)[0] or [])]
    req.setRecognitionLanguages_(langues or ["en-US"])
    # sans correction de la langue : un mot collé doit rester collé, c'est ce qu'on cherche
    req.setUsesLanguageCorrection_(False)
    images = []
    for n, f in enumerate(fichiers):
        h = Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(f), None)
        ok, _ = h.performRequests_error_([req], None)
        lignes = []
        for o in (req.results() or []) if ok else []:
            c = o.topCandidates_(1)[0]
            s = str(c.string())
            b = o.boundingBox()
            mots = []
            i = 0
            for mot in s.split():
                j = s.index(mot, i)
                i = j + len(mot)
                r, _ = c.boundingBoxForRange_error_((j, len(mot)), None)
                if r is None:
                    continue
                m = r.boundingBox()
                x = {"t": mot, "x": round(m.origin.x, 4), "y": round(1 - m.origin.y - m.size.height, 4), "l": round(m.size.width, 4), "h": round(m.size.height, 4)}
                if connu and sum(ch.isalpha() for ch in mot) >= 4:
                    x["connu"] = bool(connu(mot.strip(".,;:!?…()[]«»\"'’")))
                mots.append(x)
            lignes.append({"t": s, "confiance": round(float(c.confidence()), 2), "x": round(b.origin.x, 4), "y": round(1 - b.origin.y - b.size.height, 4), "l": round(b.size.width, 4), "h": round(b.size.height, 4), "mots": mots})
        images.append({"fichier": os.path.basename(f), "lignes": lignes})
        print(f"progress={int((n + 1) * 100 / max(1, len(fichiers)))}%", file=sys.stderr, flush=True)
    with open(sortie, "w", encoding="utf-8") as s:
        json.dump({"langues": langues, "images": images}, s, ensure_ascii=False)


def police(taille):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, taille)
        except Exception:
            continue
    return ImageFont.load_default()


def planche(description, sortie):
    with open(description, encoding="utf-8") as f:
        d = json.load(f)
    images = d["images"]
    if not images:
        raise SystemExit("aucune image")
    col = max(1, int(d.get("colonnes", 8)))
    L = int(d.get("largeur", 220))
    premiere = Image.open(images[0]["fichier"])
    H = round(L * premiere.height / premiere.width)
    bande = max(18, L // 10)
    lignes = (len(images) + col - 1) // col
    toile = Image.new("RGB", (col * L, lignes * (H + bande)), (18, 18, 22))
    dessin = ImageDraw.Draw(toile)
    fnt = police(max(11, bande - 6))
    for k, im in enumerate(images):
        x0, y0 = (k % col) * L, (k // col) * (H + bande)
        img = Image.open(im["fichier"]).convert("RGB").resize((L, H), Image.LANCZOS)
        toile.paste(img, (x0, y0))
        for b in im.get("boites", []):
            c = b.get("couleur", "#ff3030")
            bx, by = x0 + b["x"] * L, y0 + b["y"] * H
            dessin.rectangle([bx - 1, by - 1, bx + b["l"] * L + 1, by + b["h"] * H + 1], outline=c, width=max(2, L // 110))
        if im.get("legende"):
            dessin.text((x0 + 4, y0 + H + 2), im["legende"], fill=im.get("couleur_legende", "#e8e8e8"), font=fnt)
        print(f"progress={int((k + 1) * 100 / len(images))}%", file=sys.stderr, flush=True)
    toile.save(sortie, quality=88)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "lire":
        lire(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 4 and sys.argv[1] == "planche":
        planche(sys.argv[2], sys.argv[3])
    else:
        raise SystemExit(__doc__)
