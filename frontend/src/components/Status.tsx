import type { ReactNode } from "react";

export function LiveStatus({ children }: { children?: ReactNode }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

export function LoadingNote({ children, announce = true }: { children: ReactNode; announce?: boolean }) {
  return (
    <div className="note" role={announce ? "status" : undefined}>
      <span className="spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="note error" role="alert">{children}</div>;
}

export function EmptyNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
