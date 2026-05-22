import { ReactNode } from "react";
import { Page } from "../App";
import Header from "./Header";

type AppLayoutProps = {
  activePage: Page;
  isAdmin: boolean;
  loginError?: string;
  children: ReactNode;
  onNavigate: (page: Page) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
};

export default function AppLayout({
  activePage,
  isAdmin,
  loginError = "",
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
        loginError={loginError}
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
