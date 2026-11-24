# Keith Haring (Keith Haring)

> Des bonshommes au gros trait noir, des traits de mouvement autour d'eux, des couleurs franches.

**Dans Dérush.** C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement, puis cette fiche en entier). La fiche est en chinois, telle que son auteur l'a écrite : elle donne la matière, les couleurs, les gestes du peintre, ce qui bouge dans l'image, la transition qui lui va et les pièges. Ses chemins se lisent ainsi : `scripts/engine/…` est le dossier `moteur/` de cette compétence ; `render.py`, `qa.py` et les commandes `uv run …` n'existent pas ici, c'est `derush-toile images`, `verifier` et `rendre` ; les dossiers `拆解/`, `生图/` et `原片/` (le film que l'auteur a étudié) ne sont pas livrés. Un exemple qui tourne, à lire avant d'écrire : `moteur/scenes/31_haring.js` (dans une page : `/tableaux/scenes/31_haring.js`). Le décor des exemples (une jeune fille, un chat, une fenêtre, une table) n'est qu'une démonstration : garde la manière de peindre et compose la scène de la personne, avec ses mots et son sujet. Ce style donne une manière (le trait, les couleurs, la lumière, la façon de bouger), jamais un personnage, un logo ou une œuvre à recopier : n'en reproduis aucun.

---

# 31_haring · 1982 凯斯·哈林

> 来源：迁移测试 C（只读 skill 的独立 agent 实做，2026-10-04）。场景代码由整合后移植到 `scripts/engine/scenes/31_haring.js`。

实验时的文件名：`scenes/k5_haring.js`（109 行）。每帧约 4ms，帧差 11.5%。

**手法**
- 纯色底：黄墙 `#ffd51c`、绿地 `#16a54a`、14px 黑地平线。
- 一切都是 13px 圆头黑线＋平涂，用 `X.girl / X.cat` 逐部件「填→描」。
- **跳舞小人**：用修正版 `X.limb` 的胶囊做 7 段肢体＋圆头，**先全部描 2×LW 黑，再统一填色**，得到并集轮廓。4 个姿势（局部关键点，原点在脚底）**8fps 硬切、不插值**，这才是哈林的跳法；手旁加动作弧。
- **放射动作线**：物体外围椭圆上的 n 根短直线（长 22–34、线宽 7–9），8fps 换角度。用在猫、少女头、杯、茶壶、红心、右侧小人上。
- **一切跟拍**：`bounce=|sin(t·128/60·π)|^0.6`。少女 dy=−12·bb，猫错半拍。桌子以脚底为轴挤压拉伸（sy 1−0.07(1−bb)、sx 1+0.05(1−bb)），桌腿弯；茶壶跳 26px；窗框摇 ±0.025rad；地上的「跳起」横线长度随拍变。

**母题动画**：
- 窗里的光芒宝宝：白色并集剪影，两帧交替爬；14 根光芒，长短 8fps 交替。
- 墙上 3 个跳舞小人（红/蓝/粉，相位不同，有一个镜像）。
- 桌上方的红心，跳动并带放射线。

**角色**：80 年代纽约少女。宽大红毛衣（下摆一道罗纹线）、牛仔蓝长裙、白高帮球鞋。脸上只留一个眼点和一道红唇（哈林的人物本来没有五官，留这一点是为了认人）。耳朵的粗黑圈看起来像随身听耳机，正好合年代。
**坑**：`RIG.limb` 的反向端帽在粗描边下会在关节处留洞（见②-1）。窗户横档要画在宝宝下面。RIG 的 hairLines 是细线，在哈林里违背「等粗线」，而且喝茶仰头时会穿过脸，所以去掉了。

---

---
_Repris pour Dérush le 24 novembre 2026 depuis huashu-art-motion (https://github.com/alchaincyf/huashu-art-motion, commit a97c450, `references/风格配方/31_haring.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Licence MIT : voir `LICENSE`, à côté de SKILL.md._
