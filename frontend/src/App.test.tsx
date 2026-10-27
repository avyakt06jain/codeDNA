import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffView } from "./App";

describe("DiffView", () => {
  it("renders added new-side lines and marks a linked finding", () => {
    render(<DiffView diff={"--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,0 +2,1 @@\n+changed();"} findings={[{ id: "f1", category: "general", file_path: "src/a.ts", new_line: 2, severity: "warning", title: "Changed behavior", explanation: "The changed behavior needs careful review.", suggested_change: null, confidence: "medium", evidence_ids: [] }]} />);
    expect(screen.getByText("+changed();")).toBeTruthy();
    expect(screen.getByLabelText("Finding on this line")).toBeTruthy();
  });
});
