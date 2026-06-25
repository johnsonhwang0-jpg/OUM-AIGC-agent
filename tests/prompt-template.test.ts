import assert from "node:assert/strict";
import test from "node:test";
import { applyPromptTemplate } from "../prompt-template.ts";

test("applyPromptTemplate replaces double and single brace variables without leftovers", () => {
  const result = applyPromptTemplate(
    "Book={{bookTitle}}\nDirectory={{directoryText}}\nLegacy={chapterTitle}",
    {
      bookTitle: "Real Book",
      directoryText: "Topic 1",
      chapterTitle: "Chapter A"
    }
  );

  assert.equal(result, "Book=Real Book\nDirectory=Topic 1\nLegacy=Chapter A");
  assert.equal(result.includes("{{"), false);
});
