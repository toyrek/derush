# Van Gogh (Post-Impressionism (Van Gogh))

> Des coups de pinceau épais qui tournent, un ciel en tourbillon, des jaunes et des bleus intenses.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/09_postimp.js` (dans une page : `/tableaux/scenes/09_postimp.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 09_postimp · 1889 梵高（标杆实现）

文件：`scripts/engine/scenes/09_postimp.js`，每帧约 110ms（全幅三遍笔触）。其他时代照它的结构写。

## 管线
平涂底稿（墙/地/窗/床大面积）→ 流场笔触重画（区域色板）→ 道具层（桌椅花瓶画框吊灯，单独小笔触 source-atop）→ 环境线稿（深蓝 4.5px，8fps 沸腾）→ 角色（平涂 → 细笔触 source-atop → 补线与五官）→ 会动的高光（灯晕虚线环外扩、星星闪、热气）。

## 关键参数
- 方向场：墙竖向 −π/2 ± 0.22·noise；地板沿透视线指向消失点 (960,330)；星空沿最近漩涡切线＋0.3t 旋转；灯晕沿圆周；床头竖、床单近水平。
- 三遍笔触：非墙非地 cell10 len22 w6.5；墙 cell14 len64 w8；地 cell12 len46 w8。描边 outline 0.8–0.9、混 40–45% 深蓝。8fps 换种子。
- 区域色板（P.swatch，mixBase 0.3–0.45）：墙 `#7f9be6 #5f7fd8 #a7bbf2 #6c6fd2 #8ad0e6 #c3cbf6 #4f6cc8 #9a8fe0`；星空 `#22339a #2f4fb8 #5c86dc #8fb6ee #1b2a78 #3c6bd0`；地板 `#c0573c #a8453a #d7774a #8e3b30 #5f8f6a #c96a52 #e08a5c`。
- 猫身上 7 圈橘/浅橘螺旋纹（clip 到身体，0.6rad/s 转）——原片的「漩涡猫」。

## 坑
- 同一参数跑全图会糊成地毯：墙、地、其余必须分三遍。
- 小物件被大笔触打碎：一律拆成道具层。
- 只靠颜色抖动出来的是「同一个蓝的噪点」，梵高的感觉来自区域色板里十几种色相。

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/09_postimp.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
