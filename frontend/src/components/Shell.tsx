import { useEffect, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { memoryLabel, preferredPullRequestId } from "../text";
import { useWorkspace } from "../workspace";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function RepoScope() {
  const { repoId } = useParams();
  const { setRepoId } = useWorkspace();
  useEffect(() => {
    if (repoId) setRepoId(repoId);
  }, [repoId, setRepoId]);
  return <Outlet />;
}

export function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { repositories, repoId, setRepoId, prs, hindsight, loadingRepos, repoError } = useWorkspace();
  const routeRepo = pathname.match(/\/repos\/([^/]+)/)?.[1];
  const currentRepoId = routeRepo || repoId;
  const repo = repositories.find((item) => item.id === currentRepoId);
  const prsForRepo = repoId === currentRepoId ? prs : [];
  const preferred = preferredPullRequestId(prsForRepo, currentRepoId);
  const inPr = pathname.includes("/prs/");
  const inDna = pathname.includes("/dna");
  const inLab = pathname.includes("/lab");

  function selectRepository(nextId: string) {
    setRepoId(nextId);
    if (pathname === "/" || nextId === currentRepoId) return;
    if (pathname.includes("/lab")) {
      navigate(`/repos/${nextId}/lab`);
      return;
    }
    if (pathname.includes("/dna")) {
      navigate(`/repos/${nextId}/dna`);
      return;
    }
    if (pathname.includes("/prs/")) {
      void api.prs(nextId).then((rows) => {
        const id = preferredPullRequestId(rows, nextId);
        navigate(id ? `/repos/${nextId}/prs/${id}` : "/");
      }).catch(() => navigate("/"));
    }
  }

  const crumbs = [repo?.slug || "Repository"];
  if (inLab) crumbs.push("Memory Lab");
  else if (/\/dna\/[^/]+/.test(pathname)) crumbs.push("Team DNA", "Decision evolution");
  else if (inDna) crumbs.push("Team DNA");
  else if (inPr) crumbs.push("Pull request");
  else crumbs.push("Overview");

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <svg viewBox="0 0 32 32" className="mark" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#1f6b52" />
            <path d="M8 21c4-9 12-9 16 0" fill="none" stroke="#e7fff6" strokeWidth="2" />
            <path d="M8 11c4 9 12 9 16 0" fill="none" stroke="#9be7c8" strokeWidth="2" />
            <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
          </svg>
          <span>
            <strong>CodeDNA</strong>
            <small>Engineering memory for better code.</small>
          </span>
        </Link>
        <div className="sidebar-scroll">
          <nav className="nav" aria-label="Primary">
            <Link to="/" className={pathname === "/" ? "nav-link active" : "nav-link"} aria-current={pathname === "/" ? "page" : undefined}>
              <Glyph><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Glyph>
              Overview
            </Link>
            <Link
              to={preferred ? `/repos/${currentRepoId}/prs/${preferred}` : "/"}
              className={inPr ? "nav-link active" : "nav-link"}
              aria-current={inPr ? "page" : undefined}
            >
              <Glyph><circle cx="6" cy="7" r="2" /><circle cx="6" cy="17" r="2" /><circle cx="17" cy="12" r="2" /><path d="M8 7h4a3 3 0 0 1 3 3v0M8 17h5a4 4 0 0 0 4-4" /></Glyph>
              Pull Requests
              {prsForRepo.length > 0 ? <span className="nav-count">{prsForRepo.length}</span> : null}
            </Link>
            <Link to={`/repos/${currentRepoId}/dna`} className={inDna ? "nav-link active" : "nav-link"} aria-current={inDna ? "page" : undefined}>
              <Glyph><circle cx="12" cy="12" r="2" /><circle cx="6" cy="7" r="1.4" /><circle cx="18" cy="7" r="1.4" /><circle cx="7" cy="17" r="1.4" /><circle cx="17" cy="17" r="1.4" /><path d="M8 8l2.5 2.5M16 8l-2.2 2.2M8.2 16l2.2-2.2M16 16l-2.2-2.2" /></Glyph>
              Team DNA
            </Link>
            <Link to={`/repos/${currentRepoId}/lab`} className={inLab ? "nav-link active" : "nav-link"} aria-current={inLab ? "page" : undefined}>
              <Glyph><path d="M9 3h6M10 3v5L5.5 18a3.5 3.5 0 0 0 3.2 5h6.6a3.5 3.5 0 0 0 3.2-5L14 8V3" /></Glyph>
              Memory Lab
            </Link>
          </nav>
          <section className="repo-block" aria-label="Repositories">
            <h2>Repositories</h2>
            {loadingRepos ? <p className="sidebar-note">Loading repositories…</p> : null}
            {repoError ? <p className="sidebar-note">{repoError}</p> : null}
            {!loadingRepos && !repoError && repositories.length === 0 ? <p className="sidebar-note">No repositories yet.</p> : null}
            <div className="repo-list">
              {repositories.map((item) => {
                const active = item.id === currentRepoId;
                return (
                  <button type="button" key={item.id} className={active ? "repo active" : "repo"} aria-pressed={active} onClick={() => selectRepository(item.id)}>
                    <span className="repo-mark" aria-hidden="true" />
                    <span>
                      <strong>{item.display_name}</strong>
                      {item.slug && item.slug !== item.display_name ? <small>{item.slug}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        <p className={`memory-pill ${hindsight}`} role="status">
          <span className="memory-dot" aria-hidden="true" />
          <span>
            <strong>{memoryLabel(hindsight)}</strong>
            <small>Hindsight</small>
          </span>
        </p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <p className="crumbs">
            {crumbs.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? <span aria-hidden="true"> / </span> : null}
                {index === crumbs.length - 1 ? <strong>{part}</strong> : part}
              </span>
            ))}
          </p>
        </header>
        <main id="main" className="workspace-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
