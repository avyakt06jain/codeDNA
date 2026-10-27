import type { Finding } from "../api";

export function DiffView({ diff, findings = [] }: { diff: string; findings?: Finding[] }) {
  let newLine = 0;
  const findingLines = new Set(findings.map((finding) => finding.new_line).filter(Boolean));
  return (
    <div className="diff" role="region" aria-label="Pull request diff">
      {diff.split("\n").map((line, index) => {
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
        if (hunk) newLine = Number(hunk[1]) - 1;
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        if (added || (!removed && !line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++"))) newLine += 1;
        const shownLine = added || (!removed && !line.startsWith("@@")) ? newLine : null;
        const hasFinding = shownLine !== null && findingLines.has(shownLine);
        return (
          <div className={`diff-line ${added ? "added" : ""} ${removed ? "removed" : ""} ${hasFinding ? "flagged" : ""}`} key={`${index}-${line}`}>
            <span className="line-number">{shownLine ?? ""}</span>
            <code>{line || " "}</code>
            {hasFinding && <span className="line-flag" aria-label="Finding on this line">●</span>}
          </div>
        );
      })}
    </div>
  );
}
