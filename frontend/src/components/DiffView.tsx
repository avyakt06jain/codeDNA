import { useEffect, useRef } from "react";
import type { Finding } from "../api";

export function DiffView({
  diff,
  findings = [],
  focusLine = null,
  focusRequest = 0,
}: {
  diff: string;
  findings?: Finding[];
  focusLine?: number | null;
  focusRequest?: number;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest > 0) (targetRef.current ?? regionRef.current)?.focus();
  }, [focusRequest]);

  let newLine = 0;
  const findingLines = new Set(findings.map((finding) => finding.new_line).filter(Boolean));
  return (
    <div className="diff" role="region" aria-label="Pull request diff" ref={regionRef} tabIndex={-1}>
      {diff.split("\n").map((line, index) => {
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
        if (hunk) newLine = Number(hunk[1]) - 1;
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        if (added || (!removed && !line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++"))) newLine += 1;
        const shownLine = added || (!removed && !line.startsWith("@@")) ? newLine : null;
        const hasFinding = shownLine !== null && findingLines.has(shownLine);
        const focusTarget = focusRequest > 0 && focusLine !== null && shownLine === focusLine;
        return (
          <div
            className={`diff-line ${added ? "added" : ""} ${removed ? "removed" : ""} ${hasFinding ? "flagged" : ""} ${focusTarget ? "focus-target" : ""}`}
            key={`${index}-${line}`}
            ref={focusTarget ? targetRef : undefined}
            tabIndex={focusTarget ? -1 : undefined}
            aria-label={focusTarget ? `Changed line ${shownLine}` : undefined}
          >
            <span className="line-number">{shownLine ?? ""}</span>
            <code>{line || " "}</code>
            {hasFinding && <span className="line-flag" aria-label="Finding on this line">●</span>}
          </div>
        );
      })}
    </div>
  );
}
