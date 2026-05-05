import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout";
import AboutPage from "./pages/AboutPage";
import AnalysisPage from "./pages/AnalysisPage";
import OverviewPage from "./pages/OverviewPage";
import MapPage from "./pages/MapPage";
import ResultsPage from "./pages/ResultsPage";

export type Page = "overview" | "map" | "analysis" | "results" | "about";

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("mockRole") === "admin");

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem("mockRole", "admin");
    } else {
      localStorage.removeItem("mockRole");
      if (page === "results") {
        setPage("overview");
      }
    }
  }, [isAdmin, page]);

  return (
    <AppLayout
      activePage={page}
      isAdmin={isAdmin}
      onNavigate={setPage}
      onLogin={() => setIsAdmin(true)}
      onLogout={() => setIsAdmin(false)}
    >
      {page === "overview" && (
        <OverviewPage onNavigate={setPage} onLogin={() => setIsAdmin(true)} />
      )}
      {page === "map" && <MapPage />}
      {page === "analysis" && (
        <AnalysisPage
          isAdmin={isAdmin}
          onLogin={() => setIsAdmin(true)}
          onOpenMap={() => setPage("map")}
        />
      )}
      {page === "results" && (
        <ResultsPage
          isAdmin={isAdmin}
          onLogin={() => setIsAdmin(true)}
          onOpenMap={() => setPage("map")}
        />
      )}
      {page === "about" && <AboutPage />}
    </AppLayout>
  );
}
