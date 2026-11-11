import { describe, expect, it } from "vitest";
import { isValidUnifiedDiff, splitDiff } from "./diffFiles";

describe("splitDiff", () => {
  it("splits files and counts edits", () => {
    const files = splitDiff("diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\ndiff --git a/src/b.ts b/src/b.ts\n--- a/src/b.ts\n+++ b/src/b.ts\n@@ -1 +1 @@\n+only\n");
    expect(files.map((file) => file.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(files[0]?.added).toBe(1);
    expect(files[0]?.removed).toBe(1);
    expect(files[1]?.added).toBe(1);
    expect(files[1]?.removed).toBe(0);
  });

  it("reads a single file from the plus header", () => {
    const files = splitDiff("--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,0 +2,1 @@\n+changed();\n");
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("src/a.ts");
  });

  it("validates complete hunk counts", () => {
    expect(isValidUnifiedDiff("--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n")).toBe(true);
    expect(isValidUnifiedDiff("--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n+new\n")).toBe(false);
  });

  it("rejects unsafe, binary, and addition-free diffs", () => {
    expect(isValidUnifiedDiff("--- a/../../secret\n+++ b/../../secret\n@@ -0,0 +1 @@\n+x\n")).toBe(false);
    expect(isValidUnifiedDiff("--- a/../../secret\n+++ b/src/a.ts\n@@ -0,0 +1 @@\n+x\n")).toBe(false);
    expect(isValidUnifiedDiff("Binary files a/image.png and b/image.png differ\n")).toBe(false);
    expect(isValidUnifiedDiff("--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +0,0 @@\n-old\n")).toBe(false);
  });
});
