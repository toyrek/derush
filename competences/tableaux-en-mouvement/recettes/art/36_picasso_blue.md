# Picasso, période bleue (Picasso, Blue Period)

> Tout en bleus froids, des figures allongées et mélancoliques.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/36_picasso_blue.js` (dans une page : `/tableaux/scenes/36_picasso_blue.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 36_picasso_blue · 1903 毕加索蓝色时期

> 来源：迁移测试 D（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/36_picasso_blue.js`。

实验时的文件名：`scenes/r5_bluepicasso.js`，每帧约 24ms。

**管线**：蓝单色平涂底稿（墙、地、窗外夜海和月亮）→ 宽而干的笔触重画，再糊 7px 叠 80% → 极淡的干刷细丝 → 窗框原样拷回，加小笔触 → 桌单独一层 → 环境粗轮廓（不抖）→ 海浪、月光碎影、云 → 角色（整体拉长）→ 角色小笔触＋冷光渐变 → visibleLines 粗轮廓 → 披肩褶线 → 慢热气 → 画布纹＋冷暗角。

**关键参数**
- 色板：#132240 / #1d3866 / #2d5a94 / #6b8fb6 / #b6c8d8 / 青灰 #3b6878，严格单色。
- 橘白猫用明度区分：橘 = 中蓝 #4f719a，虎斑 #273f66，白 = 浅蓝 #b6c8d8。金发 = 最亮的蓝灰 #cbd8e0，肤色 #90a9be，发色要比肤色亮一档才读得出"金"。
- 墙笔触：cell34、len110、w34，jitter 4，竖向 ±0.5·noise(0.003)；色板 mixBase 0.8；之后 blur 7px 叠 α0.8。地面笔触同参，横向。
- 干刷细丝：900 条，α0.07，长 30–90。
- 拉长：少女 `DOMMatrix().translate(1240,932).scale(0.84,1.12)`，以脚底为轴；猫 scale(0.82,1.14)，以 (540,905) 为轴。同一个矩阵用在三处：Path2D.addPath、离屏 setTransform、visibleLines 回调里的 setTransform。
- 披肩：从 forehead/headTop 罩下，经 nape、back，落到 waist+70，色 #6b8fb6，褶线 rgba(20,40,80,.6) 4px。长指：3 个细长椭圆 22×4.5 绕杯。
- 轮廓：普鲁士蓝 #0c1830，5px，不沸腾。蓝色时期的轮廓线是笃定的，不该抖。
- 慢：呼吸 sin(1.8t)·0.026（幅度约为共享编舞的 2 倍、频率约 0.45 倍）；端杯用 1.25s 举起（共享编舞是 0.9s）；热气按 0.5 倍时间升。

**母题动画**：窗外海浪横移（越近越快，速度 20 + 0.25·(y − 400)）、月光碎影 14 条闪烁、一条苍白长云横过月亮、缓慢呼吸（人和猫）、端杯、热气。运动面积 3.2%。

**坑**
- 第一版给猫和头发留了一点赭色（想参考《老吉他手》），独立审片判定破坏单色。蓝色时期就该全蓝，用明度区分。
- cell16、len40、w14 满墙竖刷读成"下雨/毛毯"，是印象派，不是蓝色时期。要宽、长、低对比，再糊一层。
- 宽笔的圆头密排成"人头阵"（见 ② 第 11 条）。用糊 7px 压住了，根治要给 strokes 加 cap 参数。
- 桌子区域如果用矩形 mask 排除在大笔触之外，地面上会留下一块平涂矩形补丁。桌子要单独成层画在笔触之后，不要在笔触里挖洞。

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/36_picasso_blue.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
