# Makoto Shinkai (Makoto Shinkai)

> Des ciels immenses, des rayons, des reflets et des contre-jours très détaillés.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/35_shinkai.js` (dans une page : `/tableaux/scenes/35_shinkai.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 35_shinkai · 2016 新海诚光影

> 来源：迁移测试 D（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/35_shinkai.js`。

实验时的文件名：`scenes/r4_shinkai.js`，每帧约 71ms。

**管线**：写实室内（墙面冷暖渐变、木地板透视缝、铝框窗、挂历、书桌，缓存）→ 天空＋积雨云＋电线杆电线＋远处屋顶＋飞机拉线＋鸟 → 玻璃水珠 → 白纱窗帘 → 地板和墙面的窗形光斑（墙面光斑里有窗帘的影子在摆）→ 盆栽 → 猫、少女（赛璐珞）→ 热气 → 丁达尔光柱＋光尘 → 镜头光晕 → 泛光 → soft-light 冷暖分离。

**关键参数**
- 赛璐珞函数 `cel(c, p, base, shade, rim, {sd, rw, lx, ly})`：
  - 阴影 = clip(p) ∩ ¬(p 平移 (lx·sd, ly·sd))。用 evenodd 实现：一个大矩形 + 平移后的 p，作为 clip。
  - 亮边 = clip(p) ∩ ¬(p 反向平移 rw)。
  - 光从窗来，lx=−1、ly=−0.55，所以阴影落在右下侧。sd：大部件 22–30，脸 10，小件 8；rw 3–9。
  - 线色 #6a4632，线宽 2.2。按部件顺序"填 → 影 → 亮边 → 描线"，遮挡自然正确，不需要 visibleLines。
- 猫在窗下是逆光：lx=0.5、ly=1，暗部在下侧，头顶和背上再加一圈 lighter 的暖色亮边 rgba(255,220,160,.55)。
- 颜色：肤 #ffe8dc/#f2b6a8；金发 #f8d681/#d8a050；白校服 #fbfbfe/#b9c3dc；藏青 #2c3a66/#1b2446。天使环：后脑一道 9px 亮弧 rgba(255,250,226,.85)。
- 动画眼：白 8×12、虹膜纵向渐变 #1f3f7a → #3f7fd0 → #9fd4ff、两颗高光、上眼睑 3.4px 加一根眼角睫毛。
- 积雨云：70+12 团。①所有团块画蓝灰剪影（线性渐变 #b7c6e6 → #8297c6）②每团在偏向太阳 (+0.22r, −0.3r) 处画一个 0.82r 的白色径向亮球 ③整层 blur 3px，再叠 55% 清晰层。每团半径以 0.05·sin(1.3t) 呼吸，整体以 10px/s 漂移。
- 光晕：
  - 太阳核：r130。
  - 10 根星芒：长 90/170，以 0.25rad/s 旋转。
  - 横丝：840×4。
  - 5 个六边形光斑：落在太阳 → 画心连线上 0.45/0.75/1.25/1.6/2.0 倍处，α 0.04–0.12。
- 丁达尔：3 个楔形，模糊 18px 后缓存，screen，α 0.75 + 0.25·sin(3.4t)。光尘 60 颗，径向渐变，闪烁。
- 泛光：整帧画进 480×270 的小画布 → blur 6px、brightness 1.1 → screen α0.28 放大回叠。

**母题动画**：云团翻涌和漂移、飞机拉线、鸟群扇翅、一颗水珠沿玻璃滑下（带水痕）、白纱窗帘和它投在墙上的影子在摆、盆栽叶子摆、发丝被风吹、星芒旋转、光柱明灭、光尘。运动面积 3.0%。

**坑**
- 太阳放在窗框角上时，光晕会溢到墙上，像墙上挂了一盏灯。太阳必须放在玻璃里面，光晕半径 ≤130。
- 云第一版每团一个径向渐变，再描一圈"受光弧线"，结果读成一堆肥皂泡。要"剪影 + 偏移亮球 + 糊/清两层"。
- 全画面横向光丝第一版有 1800px 长，看起来像一条 bug 线。收到太阳附近 840px，α0.35。
- 水珠画成实心圆像气泡飘在天上。只画下缘弧线、α0.22 的透明体和一个高光点。
- 变量名冲突（两个 `const cg`）导致整段场景加载失败，且被静默替换成占位画面（见 ② 第 1 条）。

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/35_shinkai.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
