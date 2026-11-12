#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sons-openverse : chercher des sons libres avec l'API Openverse (sans clé), les télécharger dans la
bibliothèque de sons et noter leur crédit. Python 3.9 ou plus récent, bibliothèque standard seulement.

  openverse.py chercher "whoosh"                    # 20 résultats au plus, usage commercial seulement
  openverse.py telecharger 3 --type whoosh          # le n° 3 de la dernière recherche (ou un identifiant)
  openverse.py credits [FICHIER ...]                # les crédits à coller sous une vidéo
  openverse.py quota                                # ce qu'il reste : 20 appels par minute, 200 par jour
  openverse.py indexer                              # met à jour l'index de Real SFX, s'il est installé
  openverse.py preparer                             # crée la bibliothèque et son CREDITS.md

La bibliothèque est ~/Music/Sons (ou la variable SONS_BIBLIOTHEQUE, ou --bibliotheque DOSSIER).
"""
import argparse
import csv
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = os.environ.get("SONS_OPENVERSE_API", "https://api.openverse.org/v1").rstrip("/")
AGENT = "sons-openverse/1.0 (skill Claude Code)"
LIMITE_MINUTE, LIMITE_JOUR = 20, 200           # API sans clé : 20 appels par minute, 200 par jour
PAR_PAGE_MAX = 20                              # sans clé, une page ne dépasse pas 20 résultats
EXTENSIONS = {"mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "aif", "aiff"}

# Les types sont ceux que Real SFX comprend dans un catalogue (catalog.csv) : le type décide du rôle du son.
TYPES = {
    "whoosh": "passage d'air, transition, balayage",
    "impact": "coup, choc, boum",
    "riser": "montée avant un moment fort",
    "pop": "pop, bulle",
    "chime": "carillon, clochette, tintement",
    "ui": "son d'interface, notification",
    "click": "clic, déclic, bouton",
    "typing": "frappe au clavier",
    "error": "erreur, alerte",
    "camera": "obturateur, appareil photo",
    "paper": "papier, page",
    "glass": "verre",
    "cartoon": "dessin animé",
    "foley": "bruitage d'objet, pas, porte",
    "water": "eau, goutte",
    "ambience": "ambiance, fond sonore",
    "glitch": "glitch, parasite",
    "scifi": "science-fiction",
    "other": "autre",
}
COLONNES = ["file", "type", "source", "hit", "hits_in_source", "titre", "auteur", "licence", "url_licence",
            "page_source", "openverse_id", "credit", "attribution", "date"]
ENTETE_CREDITS = """# Crédits des sons

Une ligne par son téléchargé avec le skill « sons-openverse ».
Un son marqué **crédit obligatoire** (CC BY) doit être cité partout où la vidéo est publiée : dans la description,
ou au générique. Pour sortir les crédits d'une vidéo : la commande `credits FICHIER ...` de sons-openverse.

"""


# ------------------------------------------------------------------ dossiers et petits outils
def dossier_etat():
    """Là où sont rangés le compte des appels et les derniers résultats (SONS_ETAT pour le choisir)."""
    if os.environ.get("SONS_ETAT"):
        d = Path(os.environ["SONS_ETAT"]).expanduser()
        d.mkdir(parents=True, exist_ok=True)
        return d
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    elif os.name == "nt":
        base = Path(os.environ.get("APPDATA") or Path.home())
    else:
        base = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state")
    d = base / "sons-openverse"
    d.mkdir(parents=True, exist_ok=True)
    return d


def bibliotheque(choix=None):
    return Path(choix or os.environ.get("SONS_BIBLIOTHEQUE") or Path.home() / "Music" / "Sons").expanduser()


def dossier_real_sfx():
    """Real SFX, s'il est installé : celui de Dérush (DERUSH_REALSFX), sinon celui des skills de Claude Code."""
    for d in (os.environ.get("DERUSH_REALSFX"), Path.home() / ".claude" / "skills" / "real-sfx"):
        if d and (Path(d) / "scripts" / "build_index.py").exists():
            return Path(d)
    return None


# le nom sous lequel la commande est lancée (dans Dérush : « sons-openverse »)
COMMANDE = os.environ.get("SONS_COMMANDE") or "openverse.py"


def lire_json(chemin, defaut):
    try:
        return json.loads(Path(chemin).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defaut


def ecrire_json(chemin, donnees):
    chemin = Path(chemin)
    tmp = chemin.with_name(chemin.name + ".tmp")
    tmp.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, chemin)


def heure(t):
    return datetime.datetime.fromtimestamp(t).strftime("%H h %M")


def propre(texte):
    return re.sub(r"\s+", " ", str(texte or "")).strip()


def slug(texte, longueur=40):
    s = unicodedata.normalize("NFKD", str(texte or "")).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:longueur].rstrip("-") or "son"


def stop(message):
    print(message, file=sys.stderr)
    sys.exit(1)


# ------------------------------------------------------------------ les limites de l'API sans clé
def journal():
    j = lire_json(dossier_etat() / "journal.json", {})
    maintenant = time.time()
    j["appels"] = [t for t in j.get("appels", []) if maintenant - t < 86400]
    return j, maintenant


def reserver_appel():
    """Juste avant chaque appel à l'API : attend si la minute est pleine, refuse si le jour est plein."""
    j, maintenant = journal()
    if j.get("bloque_jusqua", 0) > maintenant:
        stop(f"Openverse a demandé d'attendre (réponse 429). Réessaie après {heure(j['bloque_jusqua'])}.")
    serveur = j.get("serveur") or {}
    if serveur.get("jour") == 0 and maintenant - serveur.get("vu", 0) < 3600:
        stop("Openverse indique qu'il ne reste plus d'appel pour aujourd'hui (200 par jour). Réessaie demain.")
    appels = j["appels"]
    if len(appels) >= LIMITE_JOUR:
        stop(f"Limite du jour atteinte : {LIMITE_JOUR} appels en 24 h. Prochaine place libre à "
             f"{heure(appels[0] + 86400)}.")
    minute = [t for t in appels if maintenant - t < 60]
    if len(minute) >= LIMITE_MINUTE:
        attente = 60 - (maintenant - minute[0]) + 1
        print(f"Limite de {LIMITE_MINUTE} appels par minute atteinte : j'attends {attente:.0f} s.", file=sys.stderr)
        time.sleep(attente)
        maintenant = time.time()
    appels.append(maintenant)
    ecrire_json(dossier_etat() / "journal.json", j)


def noter_serveur(entetes, code=200):
    """Ce que le serveur dit lui-même de ce qu'il reste (en-têtes x-ratelimit-available-*)."""
    j, maintenant = journal()

    def nombre(nom):
        try:
            return int(str(entetes.get(nom, "")).split("/")[0])
        except (ValueError, AttributeError):
            return None

    vu = {"minute": nombre("x-ratelimit-available-anon_burst"),
          "jour": nombre("x-ratelimit-available-anon_sustained"), "vu": maintenant}
    if vu["minute"] is not None or vu["jour"] is not None:
        j["serveur"] = vu
    if code == 429:
        try:
            attente = int(entetes.get("Retry-After", "60"))
        except (ValueError, TypeError, AttributeError):
            attente = 60
        j["bloque_jusqua"] = maintenant + max(attente, 60)
    ecrire_json(dossier_etat() / "journal.json", j)


def appel_api(chemin, parametres=None):
    url = f"{API}/{chemin.lstrip('/')}"
    if parametres:
        url += "?" + urllib.parse.urlencode(parametres)
    reserver_appel()
    requete = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            noter_serveur(reponse.headers)
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        noter_serveur(e.headers, e.code)
        if e.code == 429:
            stop("Openverse répond 429 : trop d'appels. Je m'arrête là, sans réessayer. Regarde « quota ».")
        detail = propre(e.read()[:300].decode("utf-8", "replace"))
        stop(f"Openverse a répondu {e.code} : {detail}")
    except urllib.error.URLError as e:
        stop(f"Connexion à Openverse impossible : {e.reason}")


# ------------------------------------------------------------------ les licences
def nom_licence(licence, version):
    l = str(licence or "").lower()
    if l == "cc0":
        return f"CC0 {version or '1.0'}"
    if l == "pdm":
        return f"Public Domain Mark {version or '1.0'}"
    return f"CC {l.upper()} {version or ''}".strip()


def verdict(licence, commercial=True):
    """('ok' | 'eviter' | 'non', raison, crédit obligatoire ?) pour un son posé sur une vidéo.

    Poser un son sur une image, c'est déjà une adaptation au sens des licences Creative Commons (code juridique 4.0,
    article 1.a : « synched in timed relation with a moving image »). Donc ND interdit la vidéo, et SA oblige à
    partager la vidéo sous la même licence. Sampling Plus interdit la publicité."""
    l = str(licence or "").lower()
    if l in ("cc0", "pdm"):
        return "ok", "domaine public, crédit facultatif", False
    if "sampling" in l:
        return "non", "Sampling Plus : interdit pour promouvoir autre chose que l'œuvre", True
    if "nd" in l:
        return "non", "ND : interdit de poser le son sur une vidéo", True
    if "nc" in l and commercial:
        return "non", "NC : usage commercial interdit", True
    if "sa" in l:
        return "eviter", "SA : la vidéo devrait être partagée sous la même licence", True
    if l in ("by", "by-nc"):
        return "ok", "crédit obligatoire", True
    return "non", "licence inconnue", True


# ------------------------------------------------------------------ chercher
def resume(r):
    return {
        "id": r.get("id"), "titre": propre(r.get("title")) or "(sans titre)", "auteur": propre(r.get("creator")),
        "page_auteur": r.get("creator_url"), "licence": str(r.get("license") or "").lower(),
        "version": r.get("license_version"), "url_licence": r.get("license_url"),
        "attribution": propre(r.get("attribution")), "page_source": r.get("foreign_landing_url"),
        "url": r.get("url"), "format": str(r.get("filetype") or "").lower(), "octets": r.get("filesize"),
        "duree_ms": r.get("duration"), "source": r.get("source") or r.get("provider"),
        "categorie": r.get("category"),
        "mots": [propre(t.get("name")) for t in (r.get("tags") or [])[:8] if isinstance(t, dict)],
    }


def cmd_chercher(a):
    commercial = not a.non_commercial
    parametres = {"q": a.requete[:200], "page_size": max(1, min(a.par_page, PAR_PAGE_MAX)), "page": a.page}
    if commercial:
        parametres["license_type"] = "commercial"
    for nom, valeur in (("length", a.duree), ("source", a.source), ("extension", a.extension),
                        ("category", a.categorie)):
        if valeur:
            parametres[nom] = valeur
    d = appel_api("audio/", parametres)
    resultats = [resume(r) for r in d.get("results") or []]
    ecrire_json(dossier_etat() / "derniere_recherche.json",
                {"requete": a.requete, "commercial": commercial, "date": time.time(), "resultats": resultats})
    # les résultats des recherches précédentes restent connus : on peut les télécharger par identifiant sans nouvel appel
    connus = lire_json(dossier_etat() / "connus.json", {})
    connus.update({r["id"]: r for r in resultats if r.get("id")})
    ecrire_json(dossier_etat() / "connus.json", dict(list(connus.items())[-600:]))
    if a.json:
        print(json.dumps({"total": d.get("result_count"), "pages": d.get("page_count"), "page": d.get("page"),
                          "resultats": resultats}, ensure_ascii=False, indent=1))
        return
    usage = "usage commercial" if commercial else "tous usages non commerciaux compris"
    print(f"« {a.requete} » : {d.get('result_count', 0)} résultats ({usage}), page {d.get('page', a.page)} sur "
          f"{d.get('page_count', '?')}")
    for i, r in enumerate(resultats, 1):
        etat, raison, _ = verdict(r["licence"], commercial)
        marque = {"ok": "OK ", "eviter": "~  ", "non": "NON"}[etat]
        duree = f"{r['duree_ms'] / 1000:.1f} s" if r.get("duree_ms") else "? s"
        poids = f"{r['octets'] / 1e6:.2f} Mo" if r.get("octets") else "? Mo"
        print(f"{i:2d}. {marque} {r['titre'][:46]:46s} {duree:>8s}  {nom_licence(r['licence'], r['version']):12s} "
              f"{r['format'] or '?':4s} {poids:>8s}  {r['source'] or '?'} / {r['auteur'][:24] or '?'}")
        print(f"        {r['id']}  {raison}" + (f"  [{', '.join(r['mots'][:6])}]" if r["mots"] else ""))
    if not resultats:
        print("Rien trouvé. Essaie un mot anglais plus simple, ou sans filtre de durée ni de catégorie.")
    else:
        print("\nOK = utilisable dans une vidéo commerciale ; ~ = à éviter ; NON = refusé.")
        print(f"Télécharger : {COMMANDE} telecharger N --type TYPE   (types : " + ", ".join(TYPES) + ")")
    quota_ligne()


# ------------------------------------------------------------------ télécharger
def preparer(lib):
    lib.mkdir(parents=True, exist_ok=True)
    credits = lib / "CREDITS.md"
    if not credits.exists():
        credits.write_text(ENTETE_CREDITS, encoding="utf-8")
    return lib


def lire_catalogue(lib):
    f = lib / "catalog.csv"
    if not f.exists():
        return []
    with open(f, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def ecrire_catalogue(lib, lignes):
    colonnes = list(COLONNES)
    for ligne in lignes:
        colonnes += [c for c in ligne if c and c not in colonnes]
    f = lib / "catalog.csv"
    tmp = f.with_name("catalog.csv.tmp")
    with open(tmp, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=colonnes, extrasaction="ignore")
        w.writeheader()
        w.writerows(lignes)
    os.replace(tmp, f)


def trouver(reference):
    dernier = lire_json(dossier_etat() / "derniere_recherche.json", {})
    resultats = dernier.get("resultats") or []
    if reference.isdigit():
        if 1 <= int(reference) <= len(resultats):
            return resultats[int(reference) - 1]
        stop(f"La dernière recherche a {len(resultats)} résultats : pas de n° {reference}.")
    connus = lire_json(dossier_etat() / "connus.json", {})
    for r in list(resultats) + list(connus.values()):
        if r["id"] == reference or (len(reference) >= 8 and str(r["id"]).startswith(reference)):
            return r
    if re.fullmatch(r"[0-9a-fA-F-]{36}", reference):
        return resume(appel_api(f"audio/{reference}/"))
    stop(f"« {reference} » n'est ni un n° de la dernière recherche ni un identifiant Openverse.")


def sonder(chemin):
    """Ce que ffprobe voit dans le fichier ; None sans ffprobe, False si ce n'est pas du son."""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    r = subprocess.run([ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries",
                        "stream=codec_name,sample_rate,channels:format=duration", "-of", "json", str(chemin)],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        d = {}
    flux = (d.get("streams") or [None])[0]
    if not flux:
        return False
    try:
        duree = float((d.get("format") or {}).get("duration") or 0)
    except ValueError:
        duree = 0.0
    return {"codec": flux.get("codec_name"), "hz": flux.get("sample_rate"), "canaux": flux.get("channels"),
            "duree": duree}


def recuperer(url, cible, max_octets):
    if not str(url).lower().startswith(("https://", "http://")):
        stop(f"Adresse de téléchargement refusée : {url}")
    tmp = cible.with_name(cible.name + ".partiel")
    requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
    recu = 0
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse, open(tmp, "wb") as f:
            while True:
                bloc = reponse.read(65536)
                if not bloc:
                    break
                recu += len(bloc)
                if recu > max_octets:
                    raise ValueError(f"fichier de plus de {max_octets / 1e6:.0f} Mo (--max-mo pour monter la limite)")
                f.write(bloc)
    except (urllib.error.URLError, OSError, ValueError) as e:
        tmp.unlink(missing_ok=True)
        stop(f"Téléchargement impossible ({url}) : {e}")
    os.replace(tmp, cible)
    return recu


def cmd_telecharger(a):
    if a.type not in TYPES:
        stop(f"Type inconnu : {a.type}. Types : " + ", ".join(f"{k} ({v})" for k, v in TYPES.items()))
    commercial = not a.non_commercial
    lib = preparer(bibliotheque(a.bibliotheque))
    lignes = lire_catalogue(lib)
    faits = 0
    for reference in a.references:
        r = trouver(reference)
        deja = next((l for l in lignes if l.get("openverse_id") == r["id"]), None)
        if deja and (lib / deja["file"]).exists():
            print(f"Déjà dans la bibliothèque : {deja['file']}")
            continue
        etat, raison, obligatoire = verdict(r["licence"], commercial)
        if etat == "non" or (etat == "eviter" and not a.accepter_sa):
            print(f"Refusé : « {r['titre']} » ({nom_licence(r['licence'], r['version'])}). {raison}."
                  + (" (--accepter-sa pour passer outre, en connaissance de cause)" if etat == "eviter" else ""),
                  file=sys.stderr)
            continue
        ext = r["format"] if r["format"] in EXTENSIONS else Path(urllib.parse.urlparse(r["url"] or "").path).suffix.lstrip(".").lower()
        if ext not in EXTENSIONS:
            print(f"Refusé : « {r['titre']} », format « {ext or '?'} » inconnu.", file=sys.stderr)
            continue
        # un titre comme « Whoosh 1.wav » : l'extension d'origine ne fait pas partie du nom
        titre_net = re.sub(r"\.(wav|mp3|flac|aiff?|ogg|m4a|aac|opus)$", "", r["titre"], flags=re.I).strip() or r["titre"]
        nom = f"{slug(a.nom or titre_net)}-{slug(r['source'], 16)}-{str(r['id'])[:8]}.{ext}"
        rel = f"{a.type}/{nom}"
        cible = lib / a.type / nom
        cible.parent.mkdir(parents=True, exist_ok=True)
        octets = recuperer(r["url"], cible, int(a.max_mo * 1e6))
        vu = sonder(cible)
        if vu is False:
            cible.unlink(missing_ok=True)
            print(f"Refusé : « {r['titre']} », le fichier reçu n'est pas un son lisible. Supprimé.", file=sys.stderr)
            continue
        licence = nom_licence(r["licence"], r["version"])
        attribution = r["attribution"] or f"\"{r['titre']}\" by {r['auteur'] or 'unknown'} is licensed under {licence}."
        credit = "obligatoire" if obligatoire else "facultatif"
        jour = datetime.date.today().isoformat()
        with open(lib / "CREDITS.md", "a", encoding="utf-8") as f:
            f.write(f"- `{rel}` — {attribution} Source : {r['page_source'] or '?'} · Openverse {r['id']} · "
                    f"téléchargé le {jour} · **crédit {credit}**\n")
        titre_source = re.sub(r"[\\/]+", "-", titre_net)
        lignes = [l for l in lignes if l.get("openverse_id") != r["id"]]
        lignes.append({"file": rel, "type": a.type, "source": f"openverse/{slug(r['source'], 16)}/{titre_source}.{ext}",
                       "hit": 1, "hits_in_source": 1, "titre": r["titre"], "auteur": r["auteur"], "licence": licence,
                       "url_licence": r["url_licence"] or "", "page_source": r["page_source"] or "",
                       "openverse_id": r["id"], "credit": credit, "attribution": attribution, "date": jour})
        ecrire_catalogue(lib, lignes)
        faits += 1
        mesure = (f"{vu['duree']:.2f} s, {vu['codec']}, {vu['hz']} Hz, {vu['canaux']} canal(aux)" if vu
                  else "non vérifié (ffprobe absent)")
        print(f"Téléchargé : {cible}  ({octets / 1e6:.2f} Mo ; {mesure})")
        print(f"  licence {licence}, crédit {credit} : ligne ajoutée à {lib / 'CREDITS.md'}")
    if faits and dossier_real_sfx():
        print(f"Real SFX est installé : lance « {COMMANDE} indexer » pour qu'il voie les nouveaux sons.")
    if not faits:
        sys.exit(1)


# ------------------------------------------------------------------ crédits, quota, index
def cmd_credits(a):
    lib = bibliotheque(a.bibliotheque)
    lignes = lire_catalogue(lib)
    if a.fichiers:
        voulus = set()
        for f in a.fichiers:
            p = Path(f).expanduser()
            try:
                voulus.add(str(p.resolve().relative_to(lib.resolve())).replace(os.sep, "/").lower())
            except ValueError:
                voulus.add(str(f).replace(os.sep, "/").lower())
        choisis = [l for l in lignes if l.get("file", "").lower() in voulus
                   or Path(l.get("file", "")).name.lower() in {Path(v).name for v in voulus}]
        manquants = voulus - {l["file"].lower() for l in choisis} - {Path(l["file"]).name.lower() for l in choisis}
        for m in sorted(manquants):
            print(f"Pas de crédit connu pour : {m} (son venu d'ailleurs ?)", file=sys.stderr)
    else:
        choisis = lignes
    if not a.tous:
        choisis = [l for l in choisis if l.get("credit") == "obligatoire"]
    if not choisis:
        print("Aucun crédit obligatoire pour ces sons." if not a.tous else "Aucun son dans le catalogue.")
        return
    print("Sons :")
    for l in choisis:
        auteur = l.get("auteur") or "auteur inconnu"
        print(f"- « {l.get('titre')} » de {auteur}, licence {l.get('licence')} ({l.get('url_licence')}) — "
              f"{l.get('page_source')}")


def cmd_retirer(a):
    """Retire un son de la bibliothèque : le fichier va à la corbeille, sa ligne de crédit et sa ligne de catalogue
    sont enlevées."""
    lib = bibliotheque(a.bibliotheque)
    lignes = lire_catalogue(lib)
    credits = lib / "CREDITS.md"
    for f in a.fichiers:
        p = Path(f).expanduser()
        try:
            rel = str(p.resolve().relative_to(lib.resolve())).replace(os.sep, "/")
        except ValueError:
            rel = str(f).replace(os.sep, "/")
        cible = lib / rel
        if not cible.is_file():
            print(f"Introuvable dans la bibliothèque : {rel}", file=sys.stderr)
            continue
        corbeille = Path.home() / ".Trash"
        if sys.platform == "darwin" and corbeille.is_dir():
            arrivee = corbeille / cible.name
            if arrivee.exists():
                arrivee = corbeille / f"{cible.stem}-{int(time.time())}{cible.suffix}"
            shutil.move(str(cible), str(arrivee))
            ou = "mis à la corbeille"
        else:
            cible.unlink()
            ou = "supprimé"
        lignes = [l for l in lignes if l.get("file", "").lower() != rel.lower()]
        if credits.exists():
            texte = credits.read_text(encoding="utf-8").splitlines(keepends=True)
            credits.write_text("".join(l for l in texte if f"`{rel}`" not in l), encoding="utf-8")
        print(f"Retiré : {rel} ({ou}, crédit et catalogue mis à jour)")
    ecrire_catalogue(lib, lignes)


def quota_ligne():
    j, maintenant = journal()
    appels = j["appels"]
    minute = sum(1 for t in appels if maintenant - t < 60)
    ligne = (f"Quota : {LIMITE_MINUTE - minute} appels restants cette minute, {LIMITE_JOUR - len(appels)} sur 24 h "
             f"(compte de cet ordinateur)")
    serveur = j.get("serveur") or {}
    if serveur.get("jour") is not None:
        ligne += f" ; Openverse disait {serveur['jour']} restants pour le jour à {heure(serveur['vu'])}"
    print(ligne + ".")


def cmd_quota(a):
    quota_ligne()
    j, maintenant = journal()
    if j.get("bloque_jusqua", 0) > maintenant:
        print(f"Bloqué par Openverse jusqu'à {heure(j['bloque_jusqua'])}.")


def cmd_indexer(a):
    dossier = dossier_real_sfx()
    if not dossier:
        stop("Real SFX n'est pas installé : rien à indexer.")
    sys.exit(subprocess.call([sys.executable, str(dossier / "scripts" / "build_index.py")], cwd=str(dossier)))


def cmd_preparer(a):
    lib = preparer(bibliotheque(a.bibliotheque))
    print(f"Bibliothèque prête : {lib}")
    print(f"Crédits : {lib / 'CREDITS.md'}")


def main():
    ap = argparse.ArgumentParser(prog=COMMANDE, description="Chercher et télécharger des sons libres avec Openverse.")
    ap.add_argument("--bibliotheque", help="dossier de la bibliothèque de sons (défaut : ~/Music/Sons)")
    sous = ap.add_subparsers(dest="commande", required=True)

    c = sous.add_parser("chercher", help="chercher des sons")
    c.add_argument("requete", help="mots de la recherche, plutôt en anglais (200 caractères au plus)")
    c.add_argument("--duree", help="shortest, short, medium ou long (plusieurs avec des virgules)")
    c.add_argument("--source", help="une source, par exemple freesound (liste : /v1/audio/stats/)")
    c.add_argument("--extension", help="mp3, wav, flac... (plusieurs avec des virgules)")
    c.add_argument("--categorie", help="sound_effect, music... (attention : très restrictif)")
    c.add_argument("--par-page", type=int, default=PAR_PAGE_MAX)
    c.add_argument("--page", type=int, default=1)
    c.add_argument("--non-commercial", action="store_true",
                   help="enlève le filtre commercial : seulement pour une vidéo sans aucun usage commercial")
    c.add_argument("--json", action="store_true", help="les résultats en JSON")
    c.set_defaults(fonction=cmd_chercher)

    t = sous.add_parser("telecharger", help="télécharger un son dans la bibliothèque et noter son crédit")
    t.add_argument("references", nargs="+", help="n° dans la dernière recherche, ou identifiant Openverse")
    t.add_argument("--type", required=True, help="type du son : " + ", ".join(TYPES))
    t.add_argument("--nom", help="nom lisible pour le fichier (défaut : le titre du son)")
    t.add_argument("--max-mo", type=float, default=50.0)
    t.add_argument("--non-commercial", action="store_true")
    t.add_argument("--accepter-sa", action="store_true",
                   help="accepte une licence BY-SA : la vidéo devra être partagée sous la même licence")
    t.set_defaults(fonction=cmd_telecharger)

    k = sous.add_parser("credits", help="les crédits à coller sous une vidéo")
    k.add_argument("fichiers", nargs="*", help="les sons utilisés (défaut : toute la bibliothèque)")
    k.add_argument("--tous", action="store_true", help="aussi les sons dont le crédit est facultatif")
    k.set_defaults(fonction=cmd_credits)

    x = sous.add_parser("retirer", help="retire un son de la bibliothèque (fichier à la corbeille, crédit enlevé)")
    x.add_argument("fichiers", nargs="+", help="chemins dans la bibliothèque, par exemple pop/x.mp3")
    x.set_defaults(fonction=cmd_retirer)

    sous.add_parser("quota", help="ce qu'il reste d'appels").set_defaults(fonction=cmd_quota)
    sous.add_parser("indexer", help="met à jour l'index de Real SFX").set_defaults(fonction=cmd_indexer)
    sous.add_parser("preparer", help="crée la bibliothèque et son CREDITS.md").set_defaults(fonction=cmd_preparer)

    a = ap.parse_args()
    a.fonction(a)


if __name__ == "__main__":
    main()
