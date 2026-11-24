# Comics façon Jack Kirby (Jack Kirby comics)

> De l'énergie cosmique, des crépitements de points noirs, une impression en quatre couleurs un peu décalée.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/27_kirby.js` (dans une page : `/tableaux/scenes/27_kirby.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 27_kirby · 1966 漫威银河时代（Jack Kirby ＋ 四色胶印）

> 来源：迁移测试 C（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/27_kirby.js`。

实验时的文件名：`scenes/k1_kirby.js`（255 行）。每帧约 20ms，帧差 7.5%。

**管线：同一份几何画两遍**
1. **色版层**：纸 `#f4ecd6` ＋ 平涂 ＋ 本戴网点。墙浅蓝底上铺 C 网点（pitch 9、r 2.7、15°），地板深蓝底上铺紫网点（pitch 9、r 3.2、75°），皮肤是红点（pitch 7、r 1.5、75°）。**整层 `drawImage(color, 4, 3)`＝套色不准**。
2. **墨线层**：白底，每个部件「白填 → 阴影 → 黑描边 6px」。合成时 `multiply` 叠在色版上，白色＝透明。逐部件填白会盖掉前面部件的线，所以只剩看得见的线，不需要 visibleLines。
3. **Kirby 的黑块阴影＋羽化排线（spotted blacks＋feathering）**：光从窗来（LIGHT=(-0.86,-0.5)）。
   - 黑月牙：`path ∩ ¬translate(path, LIGHT·d1)`，d1=14。做法是先 `clip(path)`，再用「全屏矩形＋平移后的 path」做 `clip(…,'evenodd')`，最后 fillRect 黑。
   - 羽化带：同样的取法，用 d2=30 得到一条带，带里画沿光方向的平行线（间距 9px、线宽 2.6）。
   - 参数（d1/d2）：裙 16/34、躯干 14/30、袖 10/22、头发 12/26、猫身 16/34、桌面 10/18。
   - 一个函数就能给任意 Path2D 打 Kirby 式阴影。

**母题动画**
- **Kirby krackle**：一簇 16–26 个黑圆。距离按 `R·rnd^0.7` 分布，越靠中心越大（`R·(0.05+0.2·(1-d/R))`），12fps 换种子，半径按 `sin(18t+i)` 脉动。6 簇沿窗外 S 形能量流移动（`(k/6+0.42t)%1`），能量流是橙边黄芯带＋锯齿墨边。热气也用 krackle（4 簇小的往上飘）。
- **速度线**：端杯速度 `|sin(min(1,lt/0.9)π)|`，在杯底往下拖 9 根黑线，长 70–180·v，12fps 抖；肘后两道动作弧。
- **拟声大字 SLURRP!**：lt 0.52 起 `outBack` 弹出，用 `Bangers-400` 132px（×0.82）；黑色挤出 7 层（每层偏移 (0.8d,d)）做出 Kirby 的立体积木字；红字上面 46px 带 clip 成黄（双色字）；底是 26 尖黄爆炸框；12fps ±3px 抖。
- **分格**：主格 24..1534，右侧一格是猫脸特写，瞳孔随 `cup` 上移（`lerp(14,-18,cup)`）、往左看。背景是品红底＋黄网点＋44 根聚焦黑三角（12fps 换）＋头周围 6 簇 krackle。底部旁白框「BUT THE CAT IS WATCHING!」，左上旁白框「MEANWHILE, AT TEA TIME...」。计数器做成黄底黑框、带黑色错位投影的旁白框，放在右上格缝里。

**角色**：60 年代红色 A 字长裙、白色彼得潘领（两个椭圆）、前襟三颗黑纽扣、黑发箍（头部旋转坐标系里的椭圆弧，线宽 11）、外翻发尾（在 `skirt` 钩子里画，位于躯干后面）。椅子是 Saarinen 郁金香椅。

**坑**
- 拟声字一开始放在 (1000,300) 满尺寸，压住了窗和少女的脸。挪到 (990,318) 并缩到 0.82。
- 猫特写右侧的大黑椭圆让猫像玳瑁猫，改成贴边的窄月牙。
- 行星环要拆成后半弧（先画）和前半弧（后画），不然环会穿过星球。
- **仍可改进**：画面偏「干净的波普漫画」，还缺 Kirby 那种方块化的手指、更夸张的透视和肌肉张力。

---

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/27_kirby.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
