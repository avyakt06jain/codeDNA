import type { ReactNode } from "react";

export function LoadingNote({ children }: { children: ReactNode }) {
  return (
    <div className="note" role="status">
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
