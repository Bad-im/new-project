import { useState } from "react";
import AppLayout from "./components/AppLayout";
import OverviewPage from "./pages/OverviewPage";
import MapPage from "./pages/MapPage";
import WorkWithImagesPage from "./pages/WorkWithImagesPage";
import { loginAdmin } from "./api/authApi";
import type {
  SatelliteAnalysisDetailResponse,
  SatelliteAnalysisSuccessResponse,
} from "./api/satelliteApi";

export type Page = "overview" | "map" | "work";

export default function App() {
  const [page, setPage] = useState<Page>(() =>
    new URLSearchParams(window.location.search).get("analysisId") ||
    new URLSearchParams(window.location.search).get("mode") === "satellite"
      ? "map"
      : "overview",
  );
  const [isAdmin, setIsAdmin] = useState(
    () =>
      localStorage.getItem("fireforestRole") === "admin" &&
      Boolean(localStorage.getItem("fireforestAuthToken")),
  );
  const [loginError, setLoginError] = useState("");
  const [satelliteAnalysis, setSatelliteAnalysis] =
    useState<SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null>(null);

  const handleLogin = async (username: string, password: string) => {
    setLoginError("");
    try {
      const data = await loginAdmin(username, password);
      localStorage.setItem("fireforestAuthToken", data.token);
      localStorage.setItem("fireforestRole", data.role);
      setIsAdmin(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось войти";
      setIsAdmin(false);
      localStorage.removeItem("fireforestAuthToken");
      localStorage.removeItem("fireforestRole");
      setLoginError(message);
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("fireforestAuthToken");
    localStorage.removeItem("fireforestRole");
    setLoginError("");
    setIsAdmin(false);
  };

  const openLoginForm = () => {
    window.dispatchEvent(new Event("fireforest-open-login"));
  };

  const openMap = (analysisId?: string) => {
    setPage("map");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "satellite");
    if (analysisId) {
      url.searchParams.set("analysisId", analysisId);
    } else if (satelliteAnalysis?.analysis_id) {
      url.searchParams.set("analysisId", satelliteAnalysis.analysis_id);
    } else {
      url.searchParams.delete("analysisId");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <AppLayout
      activePage={page}
      isAdmin={isAdmin}
      loginError={loginError}
      onNavigate={setPage}
      onLogin={handleLogin}
      onLogout={handleLogout}
    >
      {page === "overview" && (
        <OverviewPage isAdmin={isAdmin} onNavigate={setPage} onLogin={openLoginForm} />
      )}
      {page === "map" && (
        <MapPage
          satelliteAnalysis={satelliteAnalysis}
          onSatelliteAnalysis={setSatelliteAnalysis}
        />
      )}
      {page === "work" && (
        <WorkWithImagesPage
          isAdmin={isAdmin}
          satelliteAnalysis={satelliteAnalysis}
          onSatelliteAnalysis={setSatelliteAnalysis}
          onLogin={openLoginForm}
          onOpenMap={openMap}
        />
      )}
    </AppLayout>
  );
}
