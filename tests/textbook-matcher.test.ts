import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePageRange,
  trimExtractedContent,
  filterAndFormatLines,
  calculateAutoPageOffset,
  findNextSibling,
  buildHeadingPattern,
} from "../shared/textbookMatcher.ts";

// 目录样本：模拟教材目录结构（Topic → 子章节 → 页码）
const DIRECTORY = [
  { title: "Topic 1 Introduction", page: "1" },
  { title: "1.1 Overview", page: "3" },
  { title: "1.2 History", page: "8" },
  { title: "1.3 Methods", page: "15" },
  { title: "1.4 Summary", page: "22" },
  { title: "Topic 2 Advanced", page: "30" },
  { title: "2.1 Concepts", page: "32" },
  { title: "2.2 Practice", page: "40" },
  { title: "2.3 Review", page: "48" },
];

// ==================== calculatePageRange ====================

test("calculatePageRange: 单章节返回该页为 startPage，endPage 为下一个非子节点", () => {
  const r = calculatePageRange("1.2", DIRECTORY);
  assert.equal(r.found, true);
  assert.equal(r.startPage, "8");
  // 1.2 的下一个非子节点是 1.3（同级），endPage 应为 1.3 的页码 15
  assert.equal(r.endPage, "15");
});

test("calculatePageRange: 范围 1.1-1.3 返回 startPage=3，endPage=1.4 的页码", () => {
  const r = calculatePageRange("1.1-1.3", DIRECTORY);
  assert.equal(r.found, true);
  assert.equal(r.startPage, "3");
  // 1.3 的下一个非子节点是 1.4，endPage=22
  assert.equal(r.endPage, "22");
});

test("calculatePageRange: 范围结尾为某 Topic 最后子章节时，endPage 取下一 Topic 页码", () => {
  // 1.4 是 Topic 1 最后子章节，下一个非子节点是 Topic 2
  const r = calculatePageRange("1.1-1.4", DIRECTORY);
  assert.equal(r.found, true);
  assert.equal(r.startPage, "3");
  assert.equal(r.endPage, "30");
});

test("calculatePageRange: 章节不存在时 found=false 且页码为空", () => {
  const r = calculatePageRange("9.9", DIRECTORY);
  assert.equal(r.found, false);
  assert.equal(r.startPage, "");
  assert.equal(r.endPage, "");
});

test("calculatePageRange: 支持 ~ 和 至 作为范围分隔符", () => {
  const r1 = calculatePageRange("1.1~1.2", DIRECTORY);
  assert.equal(r1.found, true);
  assert.equal(r1.startPage, "3");
  const r2 = calculatePageRange("1.1至1.2", DIRECTORY);
  assert.equal(r2.found, true);
  assert.equal(r2.startPage, "3");
});

test("calculatePageRange: 空目录返回 found=false", () => {
  const r = calculatePageRange("1.1", []);
  assert.equal(r.found, false);
});

// ==================== findNextSibling ====================

test("findNextSibling: 1.3 的下一个同级是 1.4", () => {
  assert.equal(findNextSibling("1.3", DIRECTORY), "1.4");
});

test("findNextSibling: 1.4 无同级下一个时回退到下一 Topic 的第一节 2.1", () => {
  assert.equal(findNextSibling("1.4", DIRECTORY), "2.1");
});

test("findNextSibling: 2.3 是最后一节，返回 null", () => {
  assert.equal(findNextSibling("2.3", DIRECTORY), null);
});

// ==================== trimExtractedContent ====================

test("trimExtractedContent: 范围 1.1-1.2 裁剪掉 1.1 之前和 1.3 之后的内容", () => {
  const md = [
    "# Topic 1 Introduction",
    "intro text",
    "## 1.1 Overview",
    "overview content",
    "## 1.2 History",
    "history content",
    "## 1.3 Methods",
    "methods content",
    "## 1.4 Summary",
    "summary content",
  ].join("\n");

  const trimmed = trimExtractedContent(md, "1.1-1.2", DIRECTORY);
  // 应包含 1.1 和 1.2 内容，不包含 1.3 及之后
  assert.ok(trimmed.includes("## 1.1 Overview"), "应保留 1.1 标题");
  assert.ok(trimmed.includes("## 1.2 History"), "应保留 1.2 标题");
  assert.ok(trimmed.includes("overview content"));
  assert.ok(trimmed.includes("history content"));
  assert.ok(!trimmed.includes("## 1.3 Methods"), "不应包含 1.3");
  assert.ok(!trimmed.includes("## 1.4 Summary"), "不应包含 1.4");
  assert.ok(!trimmed.includes("# Topic 1 Introduction"), "不应包含范围前的 Topic 标题");
});

test("trimExtractedContent: 空 coveredChapters 原样返回", () => {
  const md = "## 1.1 Overview\ncontent";
  assert.equal(trimExtractedContent(md, "", DIRECTORY), md);
});

test("trimExtractedContent: 单章节 1.2 裁剪到该章节到下一同级之前", () => {
  const md = "## 1.1 Overview\nold\n## 1.2 History\nkeep\n## 1.3 Methods\nnext";
  const trimmed = trimExtractedContent(md, "1.2", DIRECTORY);
  assert.ok(trimmed.includes("## 1.2 History"));
  assert.ok(trimmed.includes("keep"));
  assert.ok(!trimmed.includes("## 1.1 Overview"));
  assert.ok(!trimmed.includes("## 1.3 Methods"));
});

// ==================== filterAndFormatLines ====================

test("filterAndFormatLines: markdown 模式保留标题与正文，过滤纯页码行", () => {
  const lines = [
    "## 1.1 Overview",
    "This is content.",
    "15",          // 纯页码，应过滤
    "## 1.2 History",
    "More content.",
  ];
  const result = filterAndFormatLines(lines);
  assert.ok(result.includes("## 1.1 Overview"));
  assert.ok(result.includes("This is content."));
  assert.ok(result.includes("## 1.2 History"));
  // 纯页码 "15" 应被过滤
  const resultLines = result.split("\n");
  assert.ok(!resultLines.includes("15"), "纯页码行应被过滤");
});

test("filterAndFormatLines: 过滤 ISBN 和版权信息", () => {
  const lines = [
    "## 1.1 Overview",
    "ISBN 978-3-16-148410-0",
    "Copyright © 2024 Publisher",
    "real content here",
  ];
  const result = filterAndFormatLines(lines);
  assert.ok(!result.includes("ISBN"), "ISBN 行应被过滤");
  assert.ok(!result.includes("Copyright"), "版权行应被过滤");
  assert.ok(result.includes("real content here"));
});

test("filterAndFormatLines: 纯文本模式过滤 'Topic 名 + 页码' 格式页眉", () => {
  const lines = [
    "Some body text",
    "Topic 1 Introduction 3",   // 页眉：Topic 名 + 页码，应被过滤
    "more body text",
  ];
  const result = filterAndFormatLines(lines, DIRECTORY);
  assert.ok(result.includes("Some body text"));
  assert.ok(result.includes("more body text"));
  // "Topic 名 + 页码" 格式页眉应被过滤
  assert.ok(!result.includes("Topic 1 Introduction 3"), "Topic 名+页码 页眉应被过滤");
});

test("filterAndFormatLines: 全部被过滤时返回降级提示文案", () => {
  const lines = ["15", "ISBN 123", "Copyright © X"];
  const result = filterAndFormatLines(lines);
  assert.ok(result.includes("智能降噪过滤"), "全部过滤时应返回降级提示");
});

// ==================== calculateAutoPageOffset ====================

test("calculateAutoPageOffset: 目录标题在物理页找到时返回正确偏移", () => {
  // 目录写 printed page=3 的 "1.1 Overview"，实际在 PDF 第 8 页（索引7）
  const pdfPages = [
    "cover", "copyright", "toc", "blank", "intro",
    "filler", "filler2",
    "1.1 Overview starts here",  // 索引 7 = 物理页 8
    "more",
  ];
  const offset = calculateAutoPageOffset(
    [{ title: "1.1 Overview", page: "3" }],
    pdfPages
  );
  // physical 8 - printed 3 = 5
  assert.equal(offset, 5);
});

test("calculateAutoPageOffset: 空输入返回 0", () => {
  assert.equal(calculateAutoPageOffset([], []), 0);
  assert.equal(calculateAutoPageOffset([{ title: "x", page: "1" }], []), 0);
  assert.equal(calculateAutoPageOffset([], ["page"]), 0);
});

test("calculateAutoPageOffset: 标题在 PDF 中找不到时返回 0", () => {
  const offset = calculateAutoPageOffset(
    [{ title: "Nonexistent Section", page: "5" }],
    ["cover", "toc", "blank", "intro", "other"]
  );
  assert.equal(offset, 0);
});

// ==================== buildHeadingPattern ====================

test("buildHeadingPattern: 匹配 markdown 标题行", () => {
  const pat = buildHeadingPattern("1.2");
  assert.ok(pat.test("## 1.2 History"));
  assert.ok(pat.test("### 1.2"));
  assert.ok(!pat.test("## 1.23 Other"));  // 不应误匹配 1.23
  assert.ok(!pat.test("text 1.2 inline"));
});
