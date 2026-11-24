# Dessin animé des années 1930 (Rubber hose)

> Du noir et blanc, des bras en tuyau de caoutchouc, des yeux en part de tarte et une image qui sautille.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/33_rubberhose.js` (dans une page : `/tableaux/scenes/33_rubberhose.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 33_rubberhose · 1930 橡皮管卡通

> 来源：迁移测试 D（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/33_rubberhose.js`。

实验时的文件名：`scenes/r2_rubberhose.js`，每帧约 20ms。

**管线**：纸色单色底（墙纸竖条＋菱点、地板砖缝、角落水彩压暗，缓存）→ 窗外天空（太阳脸、云、树）→ 窗框和圆点窗帘 → 椅 → 桌（弯腿＋跳舞花）→ 少女 → 猫 → `saturation` 灰去色＋multiply #f2e8d2 做褪色 → 胶片层。

**关键参数**
- 节拍弹跳：`bnc(tq, ph) = |sin(π(tq/BEAT + ph))|`，BEAT = 60/128。每个物体绕自己的着地点上弹 amp 像素：落地时压扁 sx=1+0.09k、sy=1−0.09k，腾空时拉长约 5%。各物体相位错开 0.25 拍：桌 0.5、少女 0.25、猫 0.75、太阳 0；蝴蝶结 0.05，比身体晚一点，算作跟随。
- 步进：所有角色和母题用 `tq = floor(t·12)/12`（一拍二）；端杯也按 12fps 步进；胶片层用 floor(t·24)。
- 角色画法：骨架只取锚点。
  - 头：围绕 headC 画半径 82 的大圆脸。
  - 派切眼：白眼眶＋黑瞳，黑瞳上用 arc(−1.45..−0.85) 切掉一块楔形；上方 3 根睫毛。
  - 手臂：橡皮管 = 肩到手的一根二次贝塞尔，粗细恒定，黑边 +10px。
  - 白手套：4 指、外翻袖口、手背 3 道线。
  - 波点裙长到脚踝（端庄款）。
- 猫：身体用 `RIG.smooth(K.bodyPts)`，中灰 #a39a84（=橘），虎斑 #5e574b，白胸白爪 #fbf7ec；尾巴是波浪橡皮管 `sin(7q − 9tq)·26q`。
- 胶片层：
  - 抖片 ±1.5/±2px。
  - 闪烁：每格叠 α0.02–0.09 白，再叠 0–0.06 黑。
  - 划痕：3 条竖线，按 floor(t·6) 换位置，所以一条划痕能活好几格。
  - 每格 14 个灰尘点＋偶尔一根毛发。
  - 颗粒层每格随机平移 ±20px。
  - 圆角片门：roundRect r60，加暗角。

**母题动画**：所有物体随拍弹、太阳脸光芒旋转 1.6rad/s 且脸随拍点头、跳舞的花（茎左右 ±0.35rad，叶子当手挥，花瓣转）、烟圈一拍冒一个、窗帘下摆随拍甩、胶片闪烁和划痕。运动面积 40%，但大部分是胶片噪声（见 ② 第 5 条）。

**坑**
- 骨架的猫身体是折线，卡通里一眼看出直边，必须 smooth。
- 整片要压成单色，必须在角色画完之后统一做一次 saturation 去色，不然手套、杯子会残留暖色。

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/33_rubberhose.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
