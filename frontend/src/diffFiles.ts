export type DiffFile = {
  path: string;
  added: number;
  removed: number;
  text: string;
};

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
