import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout";
import OverviewPage from "./pages/OverviewPage";
import MapPage from "./pages/MapPage";
import WorkWithImagesPage from "./pages/WorkWithImagesPage";

export type Page = "overview" | "map" | "work";

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("mockRole") === "admin");

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem("mockRole", "admin");
    } else {
      localStorage.removeItem("mockRole");
    }
  }, [isAdmin]);

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
      {page === "work" && (
        <WorkWithImagesPage
          isAdmin={isAdmin}
          onLogin={() => setIsAdmin(true)}
          onOpenMap={() => setPage("map")}
        />
      )}
    </AppLayout>
  );
}
