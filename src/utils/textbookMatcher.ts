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

    // Scan the first 35 pages of the PDF for this title
    const searchLimit = Math.min(35, pdfPagesText.length);
    for (let pIdx = 0; pIdx < searchLimit; pIdx++) {
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
 */
export function cleanAndFormatPageText(rawContent: string, absolutePage: number): string {
  const lines = rawContent.split(/\r?\n/);
  const cleanedLines: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. Skip single page numbers (e.g. "45", "• 45 •", "- 45 -")
    if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) return;
    
    // 2. Skip full written page markings (e.g. "第 45 页", "Page 45", "第 45 页/共 200 页")
    if (/^(?:第\s*\d+\s*页|page\s*\d+|\b\d+\s*[-—]\s*页\b)(?:\/共\s*\d+\s*页)?$/i.test(trimmed)) return;

    // 3. Skip typical publishing footers / stamps/ metadata (e.g. "XX大学出版社", "Copyright", "All Rights Reserved")
    if (/(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i.test(trimmed) && trimmed.length < 60) {
      return;
    }

    // 4. Skip typical header repetition (e.g. "Chapter 1", "课程大纲", textbook title)
    if (/^(?:第\s*\d+\s*[章节单元]|\bTopic\s+\d+|\bChapter\s+\d+|[A-Za-z\u4e00-\u9fa5\s\(\)《》]+教材)$/i.test(trimmed) && trimmed.length < 35) {
      return;
    }

    cleanedLines.push(trimmed);
  });

  const parsedMerged = cleanedLines.join(' ');
  // Clean spacing and formatting for Chinese text output
  let processed = parsedMerged
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([。？！；])\s*/g, '$1\n\n')
    .trim();

  return processed;
}

/**
 * Clean & accurate textbook extraction module matching.
 * Leverages structured Directory page indices & pdfPagesText dynamically extracted from PDF
 * to extract exactly matching pages. Falls back to pre-authored scholarly text if on template.
 */
export function getExtractedTextForModule(
  mod: BookModule,
  directoryItems: DirectoryItem[],
  fullText: string,
  pdfPagesText?: string[],
  pdfPageOffset: number = 0
): { mappedPages: string; extractedOriginalText: string } {
  // 1. Basic sanitization check
  const covered = (mod.coveredChapters || "").trim();
  if (!covered) {
    return { mappedPages: "暂未关联到页码", extractedOriginalText: "### 📑 章节覆盖信息缺失\n\n请先在第二阶段配置该单元对应的教材章节覆盖范围（例如：`1.1` 或 `2.1-2.2`）。" };
  }

  // Parse numeric parts or ranges from coveredChapters (e.g. "1.1-1.3" -> ["1.1", "1.2", "1.3"])
  const parseCoveredChapters = (coveredStr: string): string[] => {
    const cleanStr = coveredStr.trim();
    
    // Support section range like "1.1-1.3" -> ["1.1", "1.2", "1.3"]
    const rangeMatch = cleanStr.match(/(\d+\.\d+)\s*[-~—至]\s*(\d+\.\d+)/);
    if (rangeMatch) {
      const startNum = parseFloat(rangeMatch[1]);
      const endNum = parseFloat(rangeMatch[2]);
      const majorStart = Math.floor(startNum);
      const majorEnd = Math.floor(endNum);
      
      if (majorStart === majorEnd) {
        const startMinor = Math.round((startNum - majorStart) * 10);
        const endMinor = Math.round((endNum - majorStart) * 10);
        const results: string[] = [];
        for (let m = startMinor; m <= endMinor; m++) {
          results.push(`${majorStart}.${m}`);
        }
        return results;
      }
    }
    
    // Support integer chapter range like "1-3" or "第1-3章" -> ["1", "2", "3"]
    const chRangeMatch = cleanStr.match(/第?\s*(\d+)\s*[-~—至]\s*第?\s*(\d+)\s*(?:章|单元)?/i);
    if (chRangeMatch) {
      const start = parseInt(chRangeMatch[1], 10);
      const end = parseInt(chRangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        const results: string[] = [];
        for (let c = start; c <= end; c++) {
          results.push(`${c}`);
        }
        return results;
      }
    }

    // Split by comma, separator, or spaces
    return cleanStr.split(/[,;\s、+至\-—~]+/).filter(Boolean);
  };

  const parts = parseCoveredChapters(covered);

  // Helper matcher comparing book headings to our parsed section parts
  const checkIfMatch = (title: string, part: string): boolean => {
    const cleanTitle = title.toLowerCase();
    const cleanPart = part.toLowerCase().trim();
    if (!cleanPart) return false;

    // Pattern matching e.g., "1.1" (needs boundaries so "11.1" or "1.11" doesn't falsely match)
    if (/^\d+\.\d+$/.test(cleanPart)) {
      const escaped = cleanPart.replace('.', '\\.');
      const r = new RegExp(`(?:\\b|[^\\d])${escaped}(?:\\b|[^\\d])`);
      return r.test(cleanTitle);
    }
    // Pattern matching e.g., integer "1" (must not match "11" or "21")
    if (/^\d+$/.test(cleanPart)) {
      const r = new RegExp(`(?:\\b|[^\\d])${cleanPart}(?:\\b|[^\\d])`);
      return r.test(cleanTitle);
    }
    return cleanTitle.includes(cleanPart);
  };

  // Helper to parse chapter/section numbers from a title (e.g. "1.1 Introduction" -> [1, 1])
  const getTitleSectionNumbers = (title: string): number[] => {
    const temp = title.trim();
    // Match "Topic 1", "Chapter 3.4.1", "1.1" etc.
    const match = temp.match(/(?:Topic|Chapter|Unit|Section|第)?\s*(\d+(?:\.\d+)*)/i);
    if (match) {
      return match[1].split('.').map(x => parseInt(x, 10));
    }
    const simpleMatch = temp.match(/^(\d+(?:\.\d+)*)/);
    if (simpleMatch) {
      return simpleMatch[1].split('.').map(x => parseInt(x, 10));
    }
    return [];
  };

  // Helper to extract digit sequence from a raw segment part input (e.g. "1.1" -> [1, 1])
  const parsePartToNumbers = (part: string): number[] => {
    const clean = part.trim();
    const matches = clean.match(/\d+/g);
    if (!matches) return [];
    return matches.map(m => parseInt(m, 10));
  };

  // Check if item's section numbers match target's numbers exactly
  const isMatchNums = (target: number[], item: number[]): boolean => {
    if (target.length === 0 || item.length === 0) return false;
    if (item.length < target.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (item[i] !== target[i]) return false;
    }
    return true;
  };

  // Check if child is same or descendant of parent
  const isSameOrDescendantArray = (parent: number[], child: number[]): boolean => {
    if (parent.length === 0 || child.length === 0) return false;
    if (child.length < parent.length) return false;
    for (let i = 0; i < parent.length; i++) {
      if (child[i] !== parent[i]) return false;
    }
    return true;
  };

  // 2. High-precision dynamic PDF textbook page range matching
  if (pdfPagesText && pdfPagesText.length > 0) {
    const startPart = parts[0] || "";
    const endPart = parts[parts.length - 1] || "";

    const startNums = parsePartToNumbers(startPart);
    const endNums = parsePartToNumbers(endPart);

    let startIndex = -1;

    // Find first precise start index match based on section numbers
    if (startNums.length > 0) {
      for (let i = 0; i < directoryItems.length; i++) {
        const itemNums = getTitleSectionNumbers(directoryItems[i].title);
        if (isMatchNums(startNums, itemNums)) {
          startIndex = i;
          break;
        }
      }
    }

    // Fallbacks for start index if strictly no precise TOC match hit
    if (startIndex === -1 && startPart) {
      startIndex = directoryItems.findIndex(item => checkIfMatch(item.title, startPart));
    }
    if (startIndex === -1 && mod.chapterIndex) {
      startIndex = directoryItems.findIndex(item => checkIfMatch(item.title, mod.chapterIndex));
    }
    if (startIndex === -1 && mod.title) {
      startIndex = directoryItems.findIndex(item => item.title.toLowerCase().includes(mod.title.toLowerCase()));
    }

    if (startIndex !== -1) {
      // Find end match index (first match of endPart AFTER startIndex)
      let endMatchIndex = startIndex; 
      if (endPart && endPart !== startPart) {
        if (endNums.length > 0) {
          for (let k = startIndex; k < directoryItems.length; k++) {
            const itemNums = getTitleSectionNumbers(directoryItems[k].title);
            if (isMatchNums(endNums, itemNums)) {
              endMatchIndex = k;
              break; // CRITICAL: Stop at the first logical match of endPart!
            }
          }
        }
        if (endMatchIndex === startIndex) {
          // Fallback string matching after startIndex
          for (let k = startIndex; k < directoryItems.length; k++) {
            if (checkIfMatch(directoryItems[k].title, endPart)) {
              endMatchIndex = k;
              break;
            }
          }
        }
      }

      const matchedStartItem = directoryItems[startIndex];
      const matchedEndItem = directoryItems[endMatchIndex];

      const activeStartPrinted = parseInt(matchedStartItem.page || "", 10) || 1;
      
      // Calculate activeEndPrinted based on the first section after endMatchIndex that is NOT a descendant of the target end chapter.
      const boundNums = endNums.length > 0 ? endNums : startNums;
      let nextPagePrinted = -1;

      for (let k = endMatchIndex + 1; k < directoryItems.length; k++) {
        const nextItem = directoryItems[k];
        const nextItemNums = getTitleSectionNumbers(nextItem.title);
        
        const isDesc = boundNums.length > 0 && isSameOrDescendantArray(boundNums, nextItemNums);
        
        if (!isDesc) {
          const pVal = parseInt(nextItem.page || "", 10);
          if (!isNaN(pVal) && pVal > 0) {
            nextPagePrinted = pVal;
            break;
          }
        }
      }

      let activeEndPrinted = -1;
      if (nextPagePrinted !== -1) {
        activeEndPrinted = Math.max(activeStartPrinted, nextPagePrinted - 1);
      } else {
        // Fallback: read until the end of the PDF
        activeEndPrinted = Math.max(activeStartPrinted, pdfPagesText.length - pdfPageOffset);
      }

      // Compute physical bounds using offset calibration safely
      const activeStartPhysical = Math.max(1, activeStartPrinted + pdfPageOffset);
      const activeEndPhysical = Math.max(activeStartPhysical, Math.min(pdfPagesText.length, activeEndPrinted + pdfPageOffset));

      let mdOutput = `### 📑 PDF 教材原文块同步对齐 (Verbatim Page Extract)\n\n`;
      mdOutput += `> 💡 **真实物理定位**: PDF 物理页 [第 **${activeStartPhysical}** 页 - 第 **${activeEndPhysical}** 页]\n`;
      mdOutput += `> 📖 **校准课本印刷页**: 印刷页码范围 [P.${activeStartPrinted} - P.${activeEndPrinted}] | 偏差偏移值 (Offset): \`${pdfPageOffset >= 0 ? "+" : ""}${pdfPageOffset}\` 页\n`;
      mdOutput += `> 🎯 **核对对应大纲节点**: 从 \`${matchedStartItem.title} (P.${matchedStartItem.page})\` 至 \`${matchedEndItem.title} (P.${matchedEndItem.page})\`\n\n`;

      let textRetrieved = false;
      for (let pageNum = activeStartPhysical; pageNum <= activeEndPhysical; pageNum++) {
        const rawContent = pdfPagesText[pageNum - 1];
        if (rawContent && rawContent.trim()) {
          textRetrieved = true;
          // Apply line-by-line cleaner filters
          const cleanedText = cleanAndFormatPageText(rawContent, pageNum);

          mdOutput += `#### 📄 —— 第 ${pageNum} 页 原文 (PDF 物理页) ——\n\n${cleanedText || "*(经过智能降噪过滤，未包含非考点核心文本)*"}\n\n---\n\n`;
        }
      }

      if (textRetrieved) {
        return {
          mappedPages: `P.${activeStartPrinted}-${activeEndPrinted}`,
          extractedOriginalText: mdOutput
        };
      }
    }
  }

  // 3. Fallback high-fidelity curriculum templates (scholarly structured sections)
  let templateCombinedText = "";
  let templateMappedPagesList: string[] = [];
  
  parts.forEach(part => {
    if (ASTRO_PHYSICS_MD_SECTIONS[part]) {
      const pageInfo = part === "1.1" ? "P.2-3" : part === "1.2" ? "P.5-6" : part === "1.3" ? "P.8-9" : part === "2.1" ? "P.19-20" : part === "2.2" ? "P.22-23" : "P.25-26";
      templateMappedPagesList.push(pageInfo);
      templateCombinedText += ASTRO_PHYSICS_MD_SECTIONS[part] + "\n\n---\n\n";
    } else if (GREEK_MYTHS_MD_SECTIONS[part]) {
      const pageInfo = part === "1.1" ? "P.2-3" : "P.5-6";
      templateMappedPagesList.push(pageInfo);
      templateCombinedText += GREEK_MYTHS_MD_SECTIONS[part] + "\n\n---\n\n";
    }
  });

  if (templateCombinedText) {
    const pagesLabel = templateMappedPagesList.length > 0 ? templateMappedPagesList.join(", ") : "P.2-4";
    return {
      mappedPages: pagesLabel,
      extractedOriginalText: `### 🪐 预置教材原物对齐映射 (Built-in Courseware Alignment)\n\n> 🎯 **核对关卡章节**: ${covered} | 对应页码: ${pagesLabel}\n\n${templateCombinedText.trim()}`
    };
  }

  // 4. Default Heuristic extraction fallback (based on text-split parsing searching)
  if (!fullText) {
    return { mappedPages: "暂无绑定页码", extractedOriginalText: "### ⚠️ 暂未提取教材原文\n\n请在第一步中上传您的 PDF 教材文档，系统将以此建立点对点的页码与原文章节文本索引。" };
  }

  const matchedItemsFallback: DirectoryItem[] = [];
  parts.forEach(part => {
    directoryItems.forEach(item => {
      if (checkIfMatch(item.title, part)) {
        matchedItemsFallback.push(item);
      }
    });
  });

  let pageRangeStr = "";
  let textBlock = "";

  const indices = matchedItemsFallback
    .map(m => directoryItems.findIndex(item => item.id === m.id))
    .filter(idx => idx !== -1);

  if (indices.length > 0) {
    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);

    const firstItem = directoryItems[minIndex];
    const lastItem = directoryItems[maxIndex];

    const pageStart = firstItem.page || "";
    const pageEnd = lastItem.page || "";

    if (pageStart && pageEnd) {
      pageRangeStr = pageStart === pageEnd ? `P.${pageStart}` : `P.${pageStart}-${pageEnd}`;
    } else if (pageStart || pageEnd) {
      pageRangeStr = `P.${pageStart || pageEnd}`;
    }

    const headingStart = firstItem.title;
    const nextItem = directoryItems[maxIndex + 1];
    const headingEnd = nextItem ? nextItem.title : null;

    const findHeadingIndex = (text: string, heading: string) => {
      let idx = text.indexOf(heading);
      if (idx !== -1) return idx;

      const prefix = heading.substring(0, Math.min(25, heading.length));
      idx = text.indexOf(prefix);
      if (idx !== -1) return idx;

      const numMatch = heading.match(/\d+(?:\.\d+)?/);
      if (numMatch) {
        idx = text.indexOf(numMatch[0]);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const startPos = findHeadingIndex(fullText, headingStart);
    let endPos = -1;
    if (headingEnd) {
      endPos = findHeadingIndex(fullText, headingEnd);
    }

    if (startPos !== -1) {
      if (endPos !== -1 && endPos > startPos) {
        textBlock = fullText.substring(startPos, endPos).trim();
      } else {
        textBlock = fullText.substring(startPos, startPos + 3000).trim();
      }
    }
  }

  if (textBlock.length < 50) {
    const targetPart = parts[0] || covered;
    const cleanSearch = targetPart.replace('.', '\\.');
    const regex = new RegExp(`(?:\\b|\\s|第)${cleanSearch}(?:\\b|\\s|章|节|单元)`);
    const matchPos = fullText.search(regex);

    if (matchPos !== -1) {
      textBlock = fullText.substring(matchPos, matchPos + 2500).trim();
    } else {
      const indexInList = directoryItems.length > 0 ? parts[0] ? parseInt(parts[0], 10) || 1 : 1 : 1;
      const pieceSize = Math.floor(fullText.length / 8);
      const calculatedStart = Math.max(0, Math.min((indexInList - 1) * pieceSize, fullText.length - 1800));
      textBlock = fullText.substring(calculatedStart, calculatedStart + 2200).trim();
    }
  }

  let cleanedText = textBlock
    .replace(/\s+/g, ' ')
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([。？！；])\s*/g, '$1\n\n')
    .trim();

  return {
    mappedPages: pageRangeStr || "暂未关联到页码",
    extractedOriginalText: `### 📝 智能切片原文提取 (Heuristic Segment Export)\n\n> 🔍 **检测覆盖章节**: ${covered}\n\n${cleanedText || "暂未在大纲库中定位到高热度匹配段落，请切换至第二阶段进行章节索引校准。"}`
  };
}
