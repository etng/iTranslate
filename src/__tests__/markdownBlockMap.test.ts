import { describe, expect, it } from "vitest";
import {
  buildMarkdownBlocks,
  getBlockIndexByLine,
  getBlockRangeByIndex,
} from "../services/markdownBlockMap";

const SAMPLE = [
  "# 标题",
  "",
  "第一段第一行",
  "第一段第二行",
  "",
  "- 列表一",
  "- 列表二",
  "",
  "```ts",
  "const a = 1;",
  "console.log(a);",
  "```",
  "",
  "末段",
].join("\n");

describe("markdownBlockMap", () => {
  it("按空行与代码块生成块范围", () => {
    expect(buildMarkdownBlocks(SAMPLE)).toEqual([
      { startLine: 1, endLine: 1 },
      { startLine: 3, endLine: 4 },
      { startLine: 6, endLine: 7 },
      { startLine: 9, endLine: 12 },
      { startLine: 14, endLine: 14 },
    ]);
  });

  it("按行号定位块索引", () => {
    expect(getBlockIndexByLine(SAMPLE, 3)).toBe(1);
    expect(getBlockIndexByLine(SAMPLE, 10)).toBe(3);
    expect(getBlockIndexByLine(SAMPLE, 13)).toBeNull();
  });

  it("按块索引取行范围", () => {
    expect(getBlockRangeByIndex(SAMPLE, 2)).toEqual({ startLine: 6, endLine: 7 });
    expect(getBlockRangeByIndex(SAMPLE, 99)).toBeNull();
  });
});
