# Fresque de Dunhuang (Tang) (Dunhuang mural, High Tang)

> Des apsaras qui volent, des rubans, des couleurs minérales et un mur qui s'écaille, comme dans les grottes de Mogao.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/20_dunhuang.js` (dans une page : `/tableaux/scenes/20_dunhuang.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 20_dunhuang · 敦煌壁画（莫高窟·盛唐）

> 来源：迁移测试 A（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/20_dunhuang.js`。

实验时的文件名 `scenes/04_dunhuang.js`（215 行）。0.45↔0.9s 为 6.6%，相邻帧中位 1.98%。

**管线**
土红地仗（缓存）：`P.texture #a5452f`、dark `#7a3020`，加稀疏褪色团花，顶部卷草边＋三角垂幔（青绿白红交替＋金珠）→ 窗＝石青天：祥云、飞天 → 卷草纹窗框 → 莲花砖地（缓存）→ 壸门低案、油灯 → 猫 → 少女（唐代供养人）→ 热气卷云 → 天花 → 罩层。

**线与色**
- 铁线描：等宽 2.6px，色 `#5a2414`。脸用更红的 `#8a3a24`。
- 矿物色：土红 `#a5452f`、石绿 `#3f8f6e / #6ab08e`、石青 `#2f5f8f / #5a86b0`、白 `#ecdfc4`、金 `#d8b05a`。

**唐装**
- 间色裙：红底，斜梯形绿条，每 44px 一条，向下随 x 发散。
- 石青短襦、白交领、高腰红带。
- 高髻：在 headTop 上方叠两个椭圆，加金钗和三朵簪花。
- 面妆：花钿（额头四瓣红花）、斜红（太阳穴一道红弧）、点唇、蛾眉。
- 茶盏是越窑青瓷。

**披帛 `shawl(pts,w)`**
- 行波点列 → ribbon，加白色虚线描花和红点。
- 背后一段：`x = back + 230q + 64q·sin(4.2q − 5.5t)`，末端 30% 向上扬。
- 前段绕臂垂下。
- 坑：第一版横向摆幅只有 18–34px，又几乎竖直，看起来像椅子的竖杆。横向位移要到 200px 以上，加上末端上扬，才读得出是飘起来的帛。

**飞天**
- 横卧朝左，1.35 倍，以 300px/s 飞过窗。
- 三条飘带做行波，其中一条从肩起弧过头顶再甩到身后，这条大弧是飞天最有辨识度的形。
- 头光、发髻、托花盘。
- 祥云是圆团＋渐细云尾，以 40–76px/s 漂。

**罩层（做旧）**
- 整体 `saturation` 混合 α.3 褪色，再 multiply 一层浅土纹理 α.5。
- 逐像素剥落：`fbm(x·.0032)+0.12·noise(x·.03) > 0.3` 处露出白灰地仗 `#d8c6a2`，0.28–0.3 是剥落边缘的暗线。
- 两张脸附近设为保护区，不剥落。
- 500 条龟裂随机游走，顶部 380px 烟熏渐变。
- 坑：
  - 剥落噪声频率用 .006 时，出来的是满屏芝麻斑，像污渍。降到 .0032 并提高阈值后，才是一块块的剥落。
  - 终版把猫 (380–720, 530–920) 和少女 (1070–1530, 240–950) 都设成保护区，只剥背景。
  - 斜红 α 降到 .32，否则像伤疤。
  - 飞天的头光第一版是实心绿圆，读成「游泳圈」，改成 α.28 半透明加细线。
  - 猫用 `#c8843a` 时，叠上褪色就成了褐黄色，改成 `#e08a3a`；再加 `look: sin(2.6t)` 转头，呼吸加大 2.5 倍，不然整段只有尾巴在动。

**母题动画**
- 天花：30 片四瓣花，旋转并翻面下落。
- 油灯：火苗 `1+0.12sin(17t)+0.08sin(29t)` 跳动，加光晕。
- 颜料片：10 片从剥落边缘脱开，翻转、抛物线下落。
- 猫的项圈小铃摆动。

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/20_dunhuang.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
