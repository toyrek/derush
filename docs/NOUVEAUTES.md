# Dérush — ce qui est nouveau, version après version

**10.2 — L'installation s'adapte à ta machine.** Le bilan (`node derush.mjs installer --bilan`) commence par décrire l'ordinateur (système, puce, mémoire, place libre) et conseille la formule d'installation qui lui va : l'IA qui installe Dérush pour toi n'a plus qu'à la suivre. La page d'accueil du dépôt est refaite, avec des visuels et le message à coller à ton IA. Dérush s'appelle maintenant « bêta test ».

**Nouveau dans la version 10.**
- **Le mode Voix off.** Tu as filmé ton voyage, ta journée, ton événement : tu racontes, et ta voix devient le fil du film. Ton IA la garde entière, peut la nettoyer, la sous-titrer, et remonte les images sur ce que tu dis. Ou tu fais ton montage toi-même : ta voix est un clip vert posé sur tes images, que tu glisses et que tu coupes.
- **Enregistrer, sans quitter Dérush.** Un bouton sous *Importer* : *Ma voix* (tu parles pendant que ton montage défile ; son son est coupé pour que le micro ne l'entende pas) ou *Me filmer* (ta webcam et ton micro, pour un podcast ou un face caméra). L'enregistrement arrive tout de suite dans ton projet. Rien ne sort de ton ordinateur.
- La première fois, ton système demande son accord pour le micro (et la caméra) : c'est normal.

**10.1 — La voix off se voit et se lit.** Dans la timeline, le clip de ta voix montre la forme de son son, pour la couper au bon endroit. Ce que tu dis est écrit tout seul après la prise (Whisper, sur ton ordinateur) : un clic sur *Sous-titres* les affiche sur l'aperçu, sans rien demander à l'IA. Et un sous-titre ne commence plus au milieu d'une élision (« d' | un coup »).

**Nouveau dans la version 9.**
- **Quatre façons de créer** : *Montage* (tu déposes tes vidéos), *Motion design* (rien à déposer : tu décris, ton IA cherche, écrit et anime tout), *Extraits courts* (une longue vidéo devient plusieurs clips), *Sur un son* (une musique ou une voix devient une vidéo).
- **La table de montage se remplit en direct.** Tout ce que ton IA pose sur la vidéo (plans, titres, effets, sons) apparaît en blocs dans la timeline. Tu cliques un bloc, tu dis ce qui doit changer, et seul ce bloc est retouché.
- **Ton profil de créateur.** Avec Treg, ton IA lit tes vidéos déjà publiées et leurs chiffres (en lecture seule), repère ce qui a vraiment marché, ton style, ta direction artistique, ce que dit ton public. Elle relit ce profil avant chaque montage, chaque titre, chaque conseil.
- **Une mise en route** qui explique à quoi sert Treg et ce qui te protège ; **les sons tendance** proposés dans le plan de partage (à ajouter dans l'app, jamais dans le fichier).
- **Gemini** s'ajoute à Claude et Codex (avec la commande `agy` d'Antigravity et ton compte Google : Gemini 4 Argon, Gemini 3.8 Flash, et Carbon si ton compte le propose).
- 24 compétences de plus (Instagram et YouTube, de Jake Schincariol), et les vrais logos partout.

**9.1 — Gemini, essayé pour de vrai.** Le moteur Gemini a été réglé sur la vraie commande `agy` de Google (version 1.5.6). Gemini travaille toujours dans le bac à sable de Google, avec des permissions données pour chaque demande seulement : écrire dans son dossier de travail, lire les outils de Dérush et ce que tu lui as donné, rien d'autre de ton ordinateur. Ce bac à sable coupe le réseau local : le rendu des images passe par un relais en fichiers, et Dérush rend la vidéo pour lui. Les modèles sont ceux de ton compte Google : *Rapide* = Gemini 3.8 Flash, *Soigné* et *Maximum* = Gemini 4 Argon (ou Carbon s'il est proposé).

**9.2 — Gemini 4 Argon essayé, les blocs ne se cachent plus.** Gemini a été essayé aussi au niveau *Maximum* (Gemini 4 Argon) : la même animation, plus soignée et sans rien d'inventé. Dans la timeline, deux blocs de l'IA qui se chevauchent (un titre et sa date, un fond sous des transitions) se rangent maintenant sur plusieurs lignes : aucun ne cache l'autre, chacun se clique.

**9.3 — Le modèle de Claude, et les longs briefs.** Dans « Qui monte ta vidéo ? » (et dans Connexions), tu choisis maintenant le modèle de Claude : *Auto* (Opus 5.5, ou Sonnet 5.5 au niveau Rapide), Opus 5.5, **Fable 5.2** ou Sonnet 5.5. Un long brief collé dans la zone d'écriture part en entier (jusqu'à 24 000 caractères) : avant, Dérush le coupait à 8 000 sans prévenir. Au-delà, il le dit et propose de joindre le texte en fichier. Pendant que ton IA travaille, Dérush empêche maintenant le Mac de s'endormir.

**9.4 — Les fichiers remis avec la vidéo, des rôles mieux devinés.** Une image fixe, un storyboard, un master de haute qualité, la liste des polices et des sons : ce que ton IA remet en plus de la vidéo est maintenant rangé à côté d'elle et compté sous sa carte (« fichiers joints », bouton « Ouvrir »). Quand tu joins tout un dossier, Dérush devine mieux le rôle de chaque fichier : une référence reste une référence même si elle montre un logo, un texte n'est plus pris pour un logo, une image d'un dossier de logos est un logo.

**Nouveau dans la version 8.** Sur Mac, Dérush est une vraie application : son icône dans le Dock, ses menus, sa fenêtre (plus de Chrome). Une vidéo déposée s'affiche en moins d'une seconde et se monte tout de suite ; la timeline reste fluide à tous les zooms. À la première ouverture, un tutoriel animé montre les gestes. Et avant de publier : une **analyse de viralité** (ce qui retient les gens, ce qui les fait partir, quoi changer) puis un **plan de partage** (légendes, hashtags, bon moment) pour chaque réseau.

**8.1 — YouTube.** L'envoi sur YouTube passe maintenant par une commande de Dérush (`derush-youtube`), avec ta clé Treg : la première méthode, par les outils Treg de l'IA, ne pouvait pas marcher (YouTube rend l'adresse d'envoi dans un en-tête que ces outils ne montrent pas). Dérush reprend l'envoi s'il est coupé, n'envoie jamais deux fois la même vidéo, et te dit la visibilité réelle de la vidéo une fois en ligne.
