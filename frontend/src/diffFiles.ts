export type DiffFile = {
  path: string;
  added: number;
  removed: number;
  text: string;
};

const MAX_FILES = 30;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/;

function normalizedPath(header: string): string | null {
  const value = header.trim().split("\t", 1)[0] ?? "";
  if (value === "/dev/null") return "";
  if (!value) return null;
  const path = value.replace(/^[ab]\//, "").replaceAll("\\", "/");
  const parts = path.split("/");
  return path.startsWith("/") || path.startsWith("~") || parts.includes("..") ? null : path;
}

function validFileSection(section: string): boolean {
  const lines = section.replace(/\n$/, "").split("\n");
  const oldHeader = lines.findIndex((line) => line.startsWith("--- "));
  const newHeader = lines.findIndex((line, index) => index > oldHeader && line.startsWith("+++ "));
  if (oldHeader < 0 || newHeader < 0) return false;
  const oldPath = normalizedPath(lines[oldHeader]!.slice(4));
  const newPath = normalizedPath(lines[newHeader]!.slice(4));
  if (oldPath === null || newPath === null || (!oldPath && !newPath)) return false;

  const hunkIndexes = lines.flatMap((line, index) => line.startsWith("@@ ") ? [index] : []);
  if (hunkIndexes.length === 0 || hunkIndexes[0]! <= newHeader) return false;
  for (let hunk = 0; hunk < hunkIndexes.length; hunk += 1) {
    const start = hunkIndexes[hunk]!;
    const match = HUNK_HEADER.exec(lines[start]!);
    if (!match) return false;
    const expectedSource = match[2] === undefined ? 1 : Number(match[2]);
    const expectedTarget = match[4] === undefined ? 1 : Number(match[4]);
    let source = 0;
    let target = 0;
    const end = hunkIndexes[hunk + 1] ?? lines.length;
    for (const line of lines.slice(start + 1, end)) {
      if (line === "\\ No newline at end of file") continue;
      if (line.startsWith(" ")) {
        source += 1;
        target += 1;
      } else if (line.startsWith("-")) {
        source += 1;
      } else if (line.startsWith("+")) {
        target += 1;
      } else {
        return false;
      }
    }
    if (source !== expectedSource || target !== expectedTarget) return false;
  }
  return true;
}

export function isValidUnifiedDiff(diff: string): boolean {
  const normalized = diff.replaceAll("\r\n", "\n");
  if (!normalized.trim() || normalized.includes("GIT binary patch") || normalized.includes("Binary files ")) return false;
  const matches = [...normalized.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)];
  const sections = matches.length === 0
    ? [normalized]
    : matches.map((match, index) => normalized.slice(match.index ?? 0, matches[index + 1]?.index ?? normalized.length));
  return sections.length <= MAX_FILES && sections.every(validFileSection)
    && sections.some((section) => section.split("\n").some((line) => line.startsWith("+") && !line.startsWith("+++")));
}

function countEdits(text: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) removed += 1;
  }
  return { added, removed };
}

export function splitDiff(diff: string): DiffFile[] {
  const normalized = diff.replaceAll("\r\n", "\n");
  if (!normalized.trim()) return [];
  const matches = [...normalized.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)];
  if (matches.length === 0) {
    const plus = normalized.match(/^\+\+\+ (?:b\/)?(.+)$/m);
    const counts = countEdits(normalized);
    return [{ path: plus?.[1]?.trim() || "diff", ...counts, text: normalized }];
  }
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? normalized.length;
    const text = normalized.slice(start, end).replace(/\n$/, "");
    return { path: match[2].trim(), ...countEdits(text), text };
  });
}
