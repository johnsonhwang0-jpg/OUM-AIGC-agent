import { BookModule, DirectoryItem } from "../types";

/**
 * High-fidelity, scholarly textbook paragraphs in Markdown for default curriculum templates
 * to serve as perfect high-fidelity examples if no custom PDF has been uploaded yet.
 */
const ASTRO_PHYSICS_MD_SECTIONS: Record<string, string> = {
  "1.1": `### 📄 —— 第 2 页 ——

#### § 1.1 星际介质与星云塌缩 (Nebulae Collapse)

星际空间并不是完全虚无的。在银河系盘面，填充着由稀薄的气体与微小尘埃组成的**星际介质 (ISM, Interstellar Medium)**。其中，气体约占 99%（主要是单原子氢、双原子氢分子与少量氦），尘埃仅占 1%。这些物质在引力和湍流的复杂作用下，会聚集形成巨大的**巨分子云 (GMC, Giant Molecular Clouds)**。

巨分子云的典型温度极低，通常在 **10K 至 30K** 之间。这种极低的温度具有关键的物理意义：
1. **热压抑制**：根据理想气体状态方程（$P = n k_B T$），极低的温度意味着分子的热运动动能极低，分子向外的辐射热压力处于极小值。
2. **引力占优**：在热压力极其微弱的情况下，星云自身的万有引力开始占据主导。当外力扰动（如邻近超新星爆发的激波、银河系旋臂的穿过等）打破初始平衡时，分子云将不可避免地发生局部引力失稳，拉开恒星诞生的序幕。

### 📄 —— 第 3 页 ——

##### 1.1.1 温度与状态方程的偶联机制
当热动能无法抵御自引力聚集时，分子云开始发生非同寻常的收缩。在塌缩初始阶段，由于介质对于红外及微波辐射是**光学薄 (Optically Thin)**的，收缩释放的引力势能能够以电磁波形式无阻碍地辐射到外部空间。这维持了塌缩过程中的**等温收缩 (Isothermal Collapse)**状态，使分子云温度始终锁死在 10K 左右。然而，随着中心密度持续跃升，核心区域逐渐转变为**光学厚 (Optically Thick)**，热量累积导致温度骤然上升，从而在核心处初步建立起阻止引力进一步自由落体的第一屏障。`,

  "1.2": `### 📄 —— 第 5 页 ——

#### § 1.2 金斯不稳定性与恒星胚胎 (Jeans Instability)

要使一个质量为 $M$、半径为 $R$ 的均质自引力气体球发生自发塌缩，其质量必须超过一个临界阈值。这一物理判据由英国物理学家詹姆斯·金斯 (James Jeans) 提出，被称为**金斯质量 (Jeans Mass, $M_J$)**。

其严格的物理解析式衍生为：
$$M_J \\propto \\left(\\frac{T}{\\rho_0}\\right)^{3/2}$$

其中 $T$ 为气体绝对温度，$\\rho_0$ 为初始质量密度。

##### 金斯临界判据的物理本质：
* **若 $M > M_J$**：自引力势能的绝对值超过了星云内部气体的总热动能。星云在物理层面上是**不稳定的 (Jeans Unstable)**，必须发生向内的灾难性重力塌缩。
* **若 $M < M_J$**：气体的内能和热压力足以支撑其重力，星云能够自激振荡并维持动力学平衡。

### 📄 —— 第 6 页 ——

根据上述公式，当温度 $T$ 越低、密度 $\\rho_0$ 越高时，临界金斯质量 $M_J$ 就越小，意味着越容易发生局部塌缩。在一片典型的巨分子云中，初始质量可能高达 $10^5 M_\\odot$，远超局部的金斯质量。因此，随着塌缩的进行，局部密度升高导致各个区域的金斯质量不断缩减，整片庞大的星云将发生**碎裂化 (Fragmentation)**，分裂成数以千计的小型低质量超密核心 (Pre-stellar Cores)，每个核心都将独立孕育为一颗单一的恒星或双星系统。`,

  "1.3": `### 📄 —— 第 8 页 ——

#### § 1.3 原恒星阶段与引力势能 (Protostellar Physics)

当一个分子云碎块塌缩到核心区域变得由于高密度而对辐射不透明时，等温收缩阶段结束。由于热量无法逸出，核心温度与内部压力飙升，从而形成**第一流体静力学平衡核心**。这个阶段收缩的气体球被称为**原恒星 (Protostar)**。

原恒星阶段最核心的能量代谢方程由**维里定理 (Virial Theorem)** 支配：
$$2K + U = 0$$

其中 $K$ 是系统总热动能（气体分子的随机热运动能量），$U$ 是系统的总重力势能（负值，随收缩而绝对值增大）。

### 📄 —— 第 9 页 ——

##### 维里定理的深刻推论：
1. 原恒星在持续自重收缩过程中，释放出的重力势能变化量 $\\Delta U$：其中正好有 **50% (一半)** 会转化为恒星内部的热动能 $K$，导致原恒星中心温度越来越炽热。
2. 另外的 **50%** 则转化为电磁热辐射释放到太空中，这就是为什么原恒星虽然还没有发生热核聚变，但已经拥有惊人红外辐射光度物理根源。

在这一漫长收缩期中，原恒星在赫罗图上将沿着著名的**林轨迹 (Hayashi Track)** 物理垂直向下移动，其表面温度基本恒定（通常在 3000K-4000K 左右，由对流和电离氢控制），但由于体积急剧收缩，其发光总光度会不断下降，直至核心温度达到约一千万度（$10^7$ K），开启真正的氢核聚变大门。`,

  "2.1": `### 📄 —— 第 19 页 ——

#### § 2.1 氢核聚变（质子-质子链反应，p-p Chain）

对于像我们的太阳或质量更低的恒星（$M \\le 1.3 M_\\odot$），核心能量生成的绝对主导机制是**质子-质子链反应 (p-p Sequence)**。该反应依靠将四个自由质子（最简单的氢原子核 $^{1}\\text{H}$）熔合炼制成一个惰性的氦核 $^{4}\\text{He}$。

整个反应的总输入-输出能量平衡方程为：
$$4\\,^{1}\\text{H} \\rightarrow \\,^{4}\\text{He} + 2e^+ + 2\\nu_e + 2\\gamma$$

其释放的总能量极其巨大。具体遵循爱因斯坦著名的质能等价公式：
$$E = \\Delta m c^2$$

由于一个氦-4原子核的静止质量（$4.0015\\text{u}$）比起四个孤立质子的质量之和（$4 \\times 1.007276\\text{u} = 4.0291\\text{u}$）存在约 **0.7% 的质量亏损 (Mass Defect)**。这亏损掉的 0.7% 的微观物质质量全部升华转化成了刺眼的伽马射线光子、正电子的动能以及近乎无阻挡穿透恒星的微中子 (Neutrino)。

### 📄 —— 第 20 页 ——

##### 库仑势垒与量子隧道效应：
两个带正电的质子碰撞时由于同电极而存在极强的**库仑排斥力**。在恒星一至两千万度的核心温度下，质子的平均热运动动能其实远低于克服库仑势垒所需的临界能量。然而，依靠极其微弱但非零的**量子隧道效应 (Quantum Tunneling)**，质子能够以一定概率穿过能量壁垒。一旦结合，弱相互作用便发挥威力，将其中一个质子衰变转化为中子并释放正电子，打通聚变的第一道最难关卡。`,

  "2.2": `### 📄 —— 第 22 页 ——

#### § 2.2 碳氮氧循环核心反应 (CNO Cycle)

在质量大于 **1.3 $M_\\odot$** 的较重恒星内部，核心温度往往突破 **一千七百万度 ($1.7 \\times 10^7$ K)**。此时，质子-质子链反应虽然仍在发生，但更高效的热核反应——**碳氮氧循环 (CNO Cycle)** 升级为主导。

CNO 循环作为催化循环链，并不消耗碳、氮、氧核本身，而是利用它们将自由质子转化为氦：
1. $^{12}\\text{C}$ 捕获一个质子生成 $^{13}\\text{N}$（放出 $\\gamma$ 射线）。
2. $^{13}\\text{N}$ 发生正 $\\beta$ 衰变，形成稳定的 $^{13}\\text{C}$（释放正电子与中微子）。
3. $^{13}\\text{C}$ 进一步捕获质子升华成 $^{14}\\text{N}$。
4. $^{14}\\text{N}$ 捕获第三个质子释放出 $^{15}\\text{O}$，其经历 $\\beta$ 衰变成 $^{15}\\text{N}$。
5. $^{15}\\text{N}$ 遭受第四个质子轰击后，碎裂生成主体的 $^{12}\\text{C}$ 催化核心和释放出一个新生的氦核 $^{4}\\text{He}$。

### 📄 —— 第 23 页 ——

##### 温度敏感度极高的 CNO 反应率
CNO 循环最显著的物理特征是其反应速率对核心温度呈现出**极端的超指数敏感度**：
$$\\epsilon_{\\text{CNO}} \\propto T^{16} \\text{ 到 } T^{20}$$

相比指数只有 $T^4$ 的 p-p 链，一旦核心温度轻微浮动，CNO 循环的产能速率就会爆发式攀升，这也是大质量恒星亮度惊人的物理源泉。`
};

const GREEK_MYTHS_MD_SECTIONS: Record<string, string> = {
  "1.1": `### 📄 —— 第 2 页 ——

#### § 1.1 卡俄斯与原始神祇的产生 (The Primordial Chaos)

在一切物质和神圣秩序产生之前，宇宙处于一片名为**卡俄斯 (Chaos, 混沌)** 的无垠虚无之中。卡俄斯并非特定的神祇，而是一种无序、无定形且无限广阔的原始空间。

自混沌中，最初的**原始神 (Primordial Deities)** 伴随自然法则不约而同地诞生：
1. **盖亚 (Gaia, 大地之母)**：代表坚固的物质基础，是一切生命与奥林匹斯谱系的终极根源。
2. **塔尔塔罗斯 (Tartarus, 深渊)**：代表大地下最幽暗的极渊，同时属于囚禁堕落神祇的不可触及监狱。
3. **厄洛斯 (Eros, 爱欲之神)**：最关键的繁衍推动力，驱动神祇之间彼此相爱并诞下后代。
4. **厄瑞玻斯 (Erebus, 黑暗)** 与 **尼克斯 (Nyx, 黑夜)**：自卡俄斯中孕育，随后两神结合，诞下了璀璨的**埃忒尔 (Aether, 太空)** 和 **赫墨拉 (Hemera, 白昼)**，实现了天地间初次光影与昼夜的平衡。

### 📄 —— 第 3 页 ——

##### 神话符号背后的自然隐喻：
赫西俄德在《神谱》中所谱写的混沌与原始自然力，实际上反映了古希腊先民将宇宙本源视为“从无序走向有序”的哲学思想。盖亚作为物质母体生命力的源泉，在没有任何外在结合的情况下独立孕育出了天空之神乌拉诺斯 (Uranus) 与海洋之神蓬托斯 (Pontus)，为随后的神话演化奠定了完整的物理边界。`,

  "1.2": `### 📄 —— 第 5 页 ——

#### § 1.2 克洛诺斯的逆反与泰坦神战 (The Titanomachy)

天空之神乌拉诺斯与大地之神盖亚结合，生下了十二位力量惊人的**泰坦巨神 (Titans)**，以及三个独眼巨人与三个百臂巨人。然而，乌拉诺斯厌恶巨人们的丑陋，将他们深锁在大地下深邃的塔尔塔罗斯。此举招致盖亚的无上愤怒。

盖亚密谋复仇，锻造了一把坚硬的灰色镰刀。十二泰坦中最年轻的**克洛诺斯 (Cronus)** 挺身而出，伏击并阉割了父亲乌拉诺斯，夺取了宇宙的统治权。

### 📄 —— 第 6 页 ——

##### 吞噬亲子的宿命与第二代神权的动摇：
夺权后的克洛诺斯同样陷入了“被亲子推翻”的终极限制。为打破宿命，他的妻子瑞亚 (Rhea) 诞下每一个婴儿（赫斯提亚、德墨忒尔、赫拉、哈迪斯、波塞冬）时，克洛诺斯都会毫不留情地将其一口吞入腹中。当第六个孩子**宙斯 (Zeus)** 降临时，瑞亚用布包裹了一块石头替代婴儿献给克洛诺斯。宙斯被秘密送往克里特岛抚养长大，最终展开大反攻。`
};

/**
 * Automatically calculates the physical-to-printed page offset.
 * Traverses first few directory items, searches their titles inside the pdfPagesText array,
 * and detects the median offset (physical page index - printed page number).
 */
export function calculateAutoPageOffset(
  directoryItems: DirectoryItem[],
  pdfPagesText: string[]
): number {
  if (!directoryItems || directoryItems.length === 0 || !pdfPagesText || pdfPagesText.length === 0) {
    return 0;
  }

  const offsets: number[] = [];
  
  // Get first 10 items with a valid page, ensuring robustness
  const testItems = directoryItems
    .filter(item => {
      const p = parseInt(item.page || "", 10);
      return !isNaN(p) && p > 0;
    })
    .slice(0, 10);

  testItems.forEach(item => {
    const printedPage = parseInt(item.page, 10);
    // Sanitize search string (ignore punctuation, lower-cased and space-stripped)
    const cleanTitle = item.title.replace(/[\s\.\-\:：、，。§§]+/g, "").trim().toLowerCase();
    if (cleanTitle.length < 3) return;

    // 跳过前 5 页（封面、版权页、目录等），从第 6 页开始搜索正文中的章节标题
    const searchStart = 5;
    const searchLimit = Math.min(40, pdfPagesText.length);
    for (let pIdx = searchStart; pIdx < searchLimit; pIdx++) {
      const pageTextClean = pdfPagesText[pIdx].replace(/[\s\.\-\:：、，。§§]+/g, "").trim().toLowerCase();
      if (pageTextClean.includes(cleanTitle)) {
        const physicalPage = pIdx + 1; // 1-indexed page
        offsets.push(physicalPage - printedPage);
        break; // break page loop, found matching occurrence
      }
    }
  });

  if (offsets.length === 0) {
    return 0; // fallback to 0
  }

  // Find the most frequent offset (mode)
  const counts: Record<number, number> = {};
  let bestOffset = 0;
  let maxCount = 0;

  offsets.forEach(off => {
    counts[off] = (counts[off] || 0) + 1;
    if (counts[off] > maxCount) {
      maxCount = counts[off];
      bestOffset = off;
    }
  });

  return bestOffset;
}

/**
 * Helper text-cleaning algorithm to filter out:
 * - Headers, footers, page numbers
 * - Repetitive metadata and textbook title repetition.
 * - Restructures clean, double-spaced paragraphs in neat Markdown formatting.
 * - Detects section headings and formats them as Markdown headings.
 */
export function cleanAndFormatPageText(rawContent: string, absolutePage: number): string {
  const lines = rawContent.split(/\r?\n/);
  const cleanedLines: string[] = [];

  // 标题模式：匹配 "1.1 xxx"、"Topic 1"、"Chapter 1"、"Summary"、"Key Terms" 等
  const headingPatterns = [
    /^\d+\.\d+(?:\.\d+)?\s+.+/,           // "1.1 Introduction"
    /^(Topic|Chapter|Unit|Section)\s+\d+.*/i, // "Topic 1 xxx"
    /^(Summary|Key Terms|References|Further Reading|Self-Test)$/i,
    /^第\s*[\d一二三四五六七八九十百]+\s*[章节单元].+/, // "第一章 xxx"
    /^\d+\.\s+.+/,                          // "1. xxx"
  ];

  // 页脚模式：版权信息、出版社、URL 等
  const footerPatterns = [
    /(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i,
    /(?:www\.|http:\/\/|https:\/\/)/i,
    /(?:ISBN|ISSN)\s*[\d\-]+/i,
    /^(?:Printed\s+in|Published\s+by|©\s*\d{4})/i,
  ];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. Skip single page numbers (e.g. "45", "• 45 •", "- 45 -")
    if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) return;
    
    // 2. Skip full written page markings (e.g. "第 45 页", "Page 45", "第 45 页/共 200 页")
    if (/^(?:第\s*\d+\s*页|page\s*\d+|\b\d+\s*[-—]\s*页\b)(?:\/共\s*\d+\s*页)?$/i.test(trimmed)) return;

    // 3. Skip footers: copyright, publisher, URL, etc.
    if (footerPatterns.some(pat => pat.test(trimmed)) && trimmed.length < 80) {
      return;
    }

    // 4. Skip headers: short text + page number at end (e.g. "Topic 1 xxx 185")
    // 页眉通常是短行（< 60 字符），且以数字结尾
    if (trimmed.length < 60 && /\d{1,3}\s*$/.test(trimmed)) {
      // 检查是否包含 Topic/Chapter 等关键词
      if (/^(Topic|Chapter|Unit|Section|Requirements)/i.test(trimmed)) {
        return;
      }
    }

    // 5. Skip typical header repetition (e.g. "Chapter 1", "课程大纲", textbook title) - only short ones
    if (/^(?:第\s*\d+\s*[章节单元]|\bTopic\s+\d+|\bChapter\s+\d+|[A-Za-z\u4e00-\u9fa5\s\(\)《》]+教材)$/i.test(trimmed) && trimmed.length < 35) {
      return;
    }

    // 6. Detect headings and format as Markdown
    let isHeading = false;
    for (const pattern of headingPatterns) {
      if (pattern.test(trimmed)) {
        // 判断层级：带小数点的（如 1.1.1）是三级标题，否则是二级
        const level = /\d+\.\d+\.\d+/.test(trimmed) ? 3 : 2;
        cleanedLines.push(`${'#'.repeat(level)} ${trimmed}`);
        isHeading = true;
        break;
      }
    }

    if (!isHeading) {
      cleanedLines.push(trimmed);
    }
  });

  const parsedMerged = cleanedLines.join('\n');
  // Clean spacing and formatting for Chinese text output
  let processed = parsedMerged
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([。？！；])\s*\n/g, '$1\n\n')
    .replace(/([。？！；])\s+/g, '$1\n\n')
    .trim();

  return processed;
}

/**
 * 根据目录结构和章节切分信息计算页码范围
 * 输入：1) 目录（章节 → 页码映射） 2) coveredChapters（如 "1.1-1.3"）
 * 逻辑：起始页码 = 起始章节在目录中的页码
 *       结束页码 = 结束章节下一个非子章节节点的页码
 */
function calculatePageRange(
  covered: string,
  directoryItems: DirectoryItem[]
): { startPage: string; endPage: string; found: boolean } {
  const parseSectionNumbers = (str: string): number[] | null => {
    const match = str.trim().match(/(\d+(?:\.\d+)*)/);
    if (!match) return null;
    return match[1].split('.').map(x => parseInt(x, 10));
  };

  const isDescendant = (target: number[], item: number[]): boolean => {
    if (item.length < target.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (item[i] !== target[i]) return false;
    }
    return true;
  };

  const findIndex = (nums: number[]): number => {
    for (let i = 0; i < directoryItems.length; i++) {
      const itemNums = parseSectionNumbers(directoryItems[i].title);
      if (!itemNums) continue;
      if (itemNums.length === nums.length && itemNums.every((n, j) => n === nums[j])) {
        return i;
      }
    }
    return -1;
  };

  const coveredTrimmed = covered.trim();
  const rangeMatch = coveredTrimmed.match(/(\d+(?:\.\d+)*)\s*[-~—至]\s*(\d+(?:\.\d+)*)/);
  
  let startNums: number[] | null;
  let endNums: number[] | null;

  if (rangeMatch) {
    startNums = parseSectionNumbers(rangeMatch[1]);
    endNums = parseSectionNumbers(rangeMatch[2]);
  } else {
    startNums = parseSectionNumbers(coveredTrimmed);
    endNums = startNums;
  }

  if (!startNums || !endNums) {
    return { startPage: "", endPage: "", found: false };
  }

  const startIndex = findIndex(startNums);
  if (startIndex === -1) {
    return { startPage: "", endPage: "", found: false };
  }

  const endIndex = findIndex(endNums);
  if (endIndex === -1) {
    return { startPage: "", endPage: "", found: false };
  }

  const startPage = directoryItems[startIndex].page || "";

  let endPage = "";
  for (let k = endIndex + 1; k < directoryItems.length; k++) {
    const nextNums = parseSectionNumbers(directoryItems[k].title);
    if (!nextNums) continue;
    if (isDescendant(endNums, nextNums)) continue;
    endPage = directoryItems[k].page || "";
    break;
  }

  if (!endPage && directoryItems[endIndex].page) {
    endPage = directoryItems[endIndex].page;
  }

  return { startPage, endPage, found: true };
}

/**
 * Clean & accurate textbook extraction module matching.
 * Uses directory structure + coveredChapters to calculate page range.
 * If PDF is available, extracts verbatim page content.
 */
export function getExtractedTextForModule(
  mod: BookModule,
  directoryItems: DirectoryItem[],
  fullText: string,
  pdfPagesText?: string[],
  pdfPageOffset: number = 0
): { mappedPages: string; extractedOriginalText: string } {
  const covered = (mod.coveredChapters || "").trim();
  if (!covered) {
    return { mappedPages: "暂未关联到页码", extractedOriginalText: "### 📑 章节覆盖信息缺失\n\n请先在第二阶段配置该单元对应的教材章节覆盖范围（例如：`1.1` 或 `2.1-2.2`）。" };
  }

  // 1. 优先使用手动设置的页码范围
  let mappedPages = mod.pageRange || "暂未关联到页码";
  let startPrinted: number;
  let endPrinted: number;

  if (mod.pageRange) {
    // 解析手动设置的页码，如 "P.2-16" 或 "P.5"
    const match = mod.pageRange.match(/P\.(\d+)(?:-(\d+))?/);
    if (match) {
      startPrinted = parseInt(match[1], 10);
      endPrinted = match[2] ? parseInt(match[2], 10) : startPrinted;
    } else {
      // 解析失败，回退到自动计算
      const pageRange = calculatePageRange(covered, directoryItems);
      startPrinted = parseInt(pageRange.startPage, 10) || 1;
      endPrinted = pageRange.endPage ? (parseInt(pageRange.endPage, 10) || startPrinted) : startPrinted;
      mappedPages = pageRange.found && pageRange.startPage
        ? (pageRange.endPage && pageRange.endPage !== pageRange.startPage ? `P.${pageRange.startPage}-${pageRange.endPage}` : `P.${pageRange.startPage}`)
        : "暂未关联到页码";
    }
  } else {
    // 2. 基于目录结构计算页码范围
    const pageRange = calculatePageRange(covered, directoryItems);
    if (pageRange.found && pageRange.startPage) {
      mappedPages = pageRange.endPage && pageRange.endPage !== pageRange.startPage
        ? `P.${pageRange.startPage}-${pageRange.endPage}`
        : `P.${pageRange.startPage}`;
    }
    startPrinted = parseInt(pageRange.startPage, 10) || 1;
    endPrinted = pageRange.endPage ? (parseInt(pageRange.endPage, 10) || startPrinted) : startPrinted;
  }

  // 2. 如果有 PDF，提取原文内容
  if (pdfPagesText && pdfPagesText.length > 0 && startPrinted > 0) {
    const activeStartPhysical = Math.max(1, startPrinted + pdfPageOffset);
    const activeEndPhysical = Math.max(activeStartPhysical, Math.min(pdfPagesText.length, endPrinted + pdfPageOffset));

    let mdOutput = `### 📑 PDF 教材原文块同步对齐 (Verbatim Page Extract)\n\n`;
    mdOutput += `> 💡 **真实物理定位**: PDF 物理页 [第 **${activeStartPhysical}** 页 - 第 **${activeEndPhysical}** 页]\n`;
    mdOutput += `> 📖 **校准课本印刷页**: 印刷页码范围 [P.${startPrinted} - P.${endPrinted}] | 偏差偏移值 (Offset): \`${pdfPageOffset >= 0 ? "+" : ""}${pdfPageOffset}\` 页\n\n`;

    let textRetrieved = false;
    for (let pageNum = activeStartPhysical; pageNum <= activeEndPhysical; pageNum++) {
      const rawContent = pdfPagesText[pageNum - 1];
      if (rawContent && rawContent.trim()) {
        textRetrieved = true;
        const cleanedText = cleanAndFormatPageText(rawContent, pageNum);
        mdOutput += `#### 📄 —— 第 ${pageNum} 页 原文 (PDF 物理页) ——\n\n${cleanedText || "*(经过智能降噪过滤，未包含非考点核心文本)*"}\n\n---\n\n`;
      }
    }

    if (textRetrieved) {
      return { mappedPages, extractedOriginalText: mdOutput };
    }
  }

  // 3. 没有 PDF 时，返回页码范围 + 提示
  if (mappedPages !== "暂未关联到页码") {
    return {
      mappedPages,
      extractedOriginalText: `### 📑 教材章节页码映射\n\n> 🎯 **覆盖章节**: ${covered}\n> 📖 **对应页码**: ${mappedPages}\n\n> 💡 提示：请在第一步上传 PDF 教材以查看原文内容。`
    };
  }

  // 4. 完全无法匹配
  return { mappedPages: "暂无绑定页码", extractedOriginalText: "### ⚠️ 暂未提取教材原文\n\n请在第一步中上传您的 PDF 教材文档，系统将以此建立点对点的页码与原文章节文本索引。" };
}
