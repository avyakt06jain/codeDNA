import { Route, Routes } from "react-router-dom";
import { RepoScope, Shell } from "./components/Shell";
import { EvolutionPage } from "./pages/EvolutionPage";
import { MemoryLabPage } from "./pages/MemoryLabPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReviewPage } from "./pages/ReviewPage";
import { TeamDnaPage } from "./pages/TeamDnaPage";
import { WorkspaceProvider } from "./workspace";
import "./styles.css";

export { DiffView } from "./components/DiffView";

export default function App() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/repos/:repoId" element={<RepoScope />}>
            <Route path="prs/:prId" element={<ReviewPage />} />
            <Route path="dna" element={<TeamDnaPage />} />
            <Route path="dna/:decisionId" element={<EvolutionPage />} />
            <Route path="lab" element={<MemoryLabPage />} />
          </Route>
          <Route path="*" element={<p className="page">That page is not part of this workspace.</p>} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
