import { BookTemplate } from "./types";

export const TEMPLATE_BOOKS: BookTemplate[] = [
  {
    id: "astro-phys",
    title: "《宇宙起源与恒星物理》 (Astrophysics & Solar Physics)",
    subject: "天文物理学 (Astro Science)",
    description: "探索恒星诞生的热核聚变过程、超新星爆发以及黑洞引力红移的基本物理法则。",
    content: `目录 & 课本章节提要：
Topic 1：星云与恒星的诞生 (Nebulae & Stellar Birth) (P.1)
  1.1 星际介质与星云塌缩 (p.2)
  1.2 金斯不稳定性与恒星胚胎 (p.5)
  1.3 原恒星阶段与引力势能 (p.8)
  1.4 双星系统与星前盘演化 (p.11)
  Summary 星云篇章要点总结 (p.15)

Topic 2：热核聚变与静力学平衡 (Nuclear Fusion & Equilibrium) (P.18)
  2.1 氢核聚变（质子-质子链反应） (p.19)
  2.2 碳氮氧循环（CNO Cycle）核心反应 (p.22)
  2.3 静力学平衡的引力与压力对抗 (p.25)
  2.4 太阳中心温度与光压辐射屏障 (p.29)
  Summary 聚变动力学要点总结 (p.32)

Topic 3：主序星时期的能量漫游 (Main Sequence Life) (P.35)
  3.1 主序阶段的质量与寿命负相关 (p.36)
  3.2 恒星核内部的辐射层与对流层 (p.39)
  3.3 光子的万年能量逃逸之旅 (p.42)
  3.4 太阳风与磁层交互作用 (p.45)
  Summary 恒星主序黄金期备忘 (p.48)

Topic 4：红巨星膨胀与金属丰度 (Red Giants & Nucleosynthesis) (P.51)
  4.1 核心氢燃尽与氦闪爆发 (p.52)
  4.2 外壳膨胀及赫罗图渐近巨星分支 (p.55)
  4.3 恒星风散逸与行星状星云 (p.58)
  4.4 s-过程与重金属元素的宇宙喷洒 (p.62)
  Summary 演化末期与元素合成要点 (p.66)

Topic 5：白矮星、中子星与简并态 (Degeneracy & Critical States) (P.70)
  5.1 电子简并压与钱德拉塞卡极限 (p.72)
  5.2 超新星爆发与铁核坍缩 (p.75)
  5.3 中子态物质与强磁场脉冲星 (p.78)
  5.4 奥本海默-沃尔科夫极限解析 (p.81)
  Summary 致密矮星简并态指南 (p.85)

Topic 6：黑洞奇点与终极时空扭曲 (Singularities & Spacetime Physics) (P.88)
  6.1 事件视界与重力红移效应 (p.89)
  6.2 史瓦西黑洞时空物理方程简描 (p.92)
  6.3 霍金辐射与黑洞蒸发假说 (p.95)
  6.4 活跃星系核与引力波涟漪探测 (p.98)
  Summary 终极奇点物理备忘 (p.102)`
  },
  {
    id: "greek-myths",
    title: "《古希腊罗马神话探求》 (Ancient Greek & Roman Myths)",
    subject: "历史与文学 (History & Literature)",
    description: "揭开奥林匹斯主神职责、赫拉克勒斯十二试炼以及奥德赛海上漂流背后的历史象征寓意。",
    content: `目录 & 课本章节提要：
Topic 1：混沌初开与奥林匹斯起源 (The Beginning & Olympian Rise) (P.1)
  1.1 卡俄斯与原始神祇的产生 (p.2)
  1.2 克洛诺斯的逆反与泰坦神战 (p.5)
  1.3 宙斯登基与神圣秩序确立 (p.9)
  1.4 先知普罗米修斯与盗火惩罚 (p.12)
  Summary 宇宙纪元与神族谱系总览 (p.16)

Topic 2：奥林匹斯十二主神神权 (The Pantheon Power Matrix) (P.20)
  2.1 宙斯与波塞冬的海洋风暴契约 (p.21)
  2.2 雅典娜智慧神权与阿瑞斯战车 (p.24)
  2.3 阿波罗日光神殿与阿尔忒弥斯银弓 (p.28)
  2.4 赫菲斯托斯熔炉与阿芙洛狄忒爱之歌 (p.32)
  Summary 奥林匹斯神殿意志集锦 (p.36)

Topic 3：人类英雄的命运轨迹 (Heroic Destinies & Oracles) (P.40)
  3.1 德尔斐神谕与无法逃避的预言 (p.41)
  3.2 珀尔修斯斩杀美杜莎的魔镜计谋 (p.44)
  3.3 伊阿宋与阿尔戈号金羊毛历险 (p.48)
  3.4 忒修斯与米诺陶迷宫红线法 (p.51)
  Summary 命运神谕与不屈英雄意志 (p.55)

Topic 4：大力神赫拉克勒斯的试炼 (The Labors of Hercules) (P.60)
  4.1 扼杀涅墨亚巨狮与驯服九头蛇 (p.61)
  4.2 擒获刻律涅牝鹿与生擒野猪 (p.64)
  4.3 清理奥革阿斯牛圈的神巧法门 (p.67)
  4.4 盗取金苹果与降伏三头犬 (p.71)
  Summary 伟业试炼与不朽意志要诀 (p.75)

Topic 5：特洛伊之战与英雄挽歌 (The Trojan Epics) (P.80)
  5.1 金苹果事件与海伦的惊世美貌 (p.81)
  5.2 阿喀琉斯之踵与帕特罗克洛斯之死 (p.85)
  5.3 木马空城计的战术布局执行 (p.89)
  5.4 特洛伊古城沦陷的历史反思 (p.93)
  Summary 十年攻防战术史诗备忘 (p.97)

Topic 6：奥德赛的海上漂流史诗 (Odyssey's Homeward Voyages) (P.100)
  6.1 独眼巨人洞穴的智斗与脱险 (p.101)
  6.2 塞壬女妖诱惑与蜡封耳塞策略 (p.104)
  6.3 穿越怪兽海峡与风神袋之祸 (p.108)
  6.4 游子归乡清剿篡位求婚者 (p.112)
  Summary 十年归乡智慧与勇气总结 (p.116)`
  },
  {
    id: "python-wizard",
    title: "《Python魔法卡牌学院》 (Python Code Spellbook)",
    subject: "计算机编程 (Computer Programming)",
    description: "以魔法师法术构建视角，掌握变量存储能量、For循环阵法、Cond判断门闸及调试纠错法术。",
    content: `目录 & 课本章节提要：
Topic 1：变量熔炉与数据分类魔法 (Variables & Data Alchemy) (P.1)
  1.1 魔法宝箱：变量命名规范与内存占位 (p.2)
  1.2 整型与浮点数：魔力数值在寄存器中的配比 (p.5)
  1.3 字符串法阵：单双引号拼接与字符转义 (p.8)
  1.4 布尔符文：True 和 False 的逻辑能量守恒 (p.11)
  Summary 变量与初级炼金术总览 (p.15)

Topic 2：If-Else 圣光抉择门闸 (Conditional Logic Gates) (P.18)
  2.1 比较符文：两相权衡的大于小于等号咒语 (p.19)
  2.2 If 单向路径：唯有光耀法术下的选择性放行 (p.21)
  2.3 Else 与 Elif 的多重岔路暗黑守卫 (p.24)
  2.4 嵌套条件选择：魔爪下的双重魔法防线 (p.27)
  Summary 抉择罗盘布线法则 (p.31)

Topic 3：For/While 循环阵法构造 (The Iteration Magic Matrices) (P.35)
  3.1 For 循环执印：依步长自动行进的千重结界 (p.36)
  3.2 Range 范围魔药配制：精确约束自增变值 (p.39)
  3.3 While 循环深渊：必须小心防范的死循环漩涡 (p.42)
  3.4 Break 和 Continue：魔咒中途切断与跃迁 (p.45)
  Summary 循环能量场安全维护纲要 (p.49)

Topic 4：魔法容器：列表与元组封印 (Data Structures Capsule) (P.52)
  4.1 列表百宝箱：多重无序元素的索引与切片 (p.53)
  4.2 容器自增法：Append 注入与 Remove 剔除 (p.56)
  4.3 元组坚盾：不可变元素的永恒真红刻印 (p.59)
  4.4 列表推导式：行内飞沙走石的极速炼炉 (p.62)
  Summary 组合封印术操作指南 (p.66)

Topic 5：字典圣典与键值密语匹配 (The Key-Value Grimoires) (P.70)
  5.1 键值对照图腾：真理与假说的一一映射 (p.71)
  5.2 查阅天书：Get 获取密匙与兜底提示法 (p.74)
  5.3 遍历核心：Keys 与 Values 精灵全员出列 (p.77)
  5.4 集合魔印：消除完全相同的混淆杂质元素 (p.80)
  Summary 字典密钥全景大纲 (p.84)

Topic 6：魔法函谱：重用咒语召唤仪轨 (Function Scribes) (P.88)
  6.1 Def 结印咒文：命名空间与可重用魔法片段 (p.89)
  6.2 参数飞鸽传书：位置变参与默认魔药参数 (p.92)
  6.3 Return 功德圆满：将结果能量传回原法坛 (p.95)
  6.4 异常沙盒捕获：Try-Except 阻绝魔爆灾害 (p.98)
  Summary 高阶函谱召唤大典 (p.102)`
  }
];
