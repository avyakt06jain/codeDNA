import { useEffect, useId, useRef, useState } from "react";
import { api, type Finding } from "../api";
import { bindingCopy, FEEDBACK_CHOICES, feedbackPayload, type FeedbackChoice } from "../text";

export function FeedbackDialog({
  finding,
  onClose,
  onSaved,
}: {
  finding: Finding;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<FeedbackChoice | "">("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!choice) return;
    setPending(true);
    setError("");
    try {
      const payload = feedbackPayload(choice, note);
      const result = await api.feedback(finding.id, payload.action, payload.reason);
      onSaved(`${finding.title}: ${bindingCopy(result.binding)}`);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback failed");
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>Record review feedback</h2>
          <button type="button" className="icon-button" aria-label="Close feedback" onClick={onClose}>×</button>
        </div>
        <p>Your note is stored as review feedback. This does not change the active design.</p>
        <p className="finding-ref">{finding.title}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset>
            <legend>What best describes the issue?</legend>
            {FEEDBACK_CHOICES.map((item) => (
              <label className="choice" key={item.id}>
                <input
                  type="radio"
                  name="feedback-choice"
                  value={item.id}
                  checked={choice === item.id}
                  onChange={() => setChoice(item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="stack" htmlFor="feedback-note">Additional context</label>
          <textarea
            id="feedback-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Optional detail for this review"
          />
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={!choice || pending}>{pending ? "Saving…" : "Save feedback"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
