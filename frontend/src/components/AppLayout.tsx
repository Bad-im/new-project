import { ReactNode } from "react";
import { Page } from "../App";
import Header from "./Header";

type AppLayoutProps = {
  activePage: Page;
  isAdmin: boolean;
  children: ReactNode;
  onNavigate: (page: Page) => void;
  onLogin: () => void;
  onLogout: () => void;
};

export default function AppLayout({
  activePage,
  isAdmin,
  children,
  onNavigate,
  onLogin,
  onLogout,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Header
        activePage={activePage}
        isAdmin={isAdmin}
        onNavigate={onNavigate}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      <main className={activePage === "map" ? "app-main map-main" : "app-main"}>
        {children}
      </main>
    </div>
  );
}
