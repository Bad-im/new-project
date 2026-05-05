import { Page } from "../App";
import LoginButton from "./LoginButton";
import Navigation from "./Navigation";

type HeaderProps = {
  activePage: Page;
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
  onLogin: () => void;
  onLogout: () => void;
};

export default function Header({
  activePage,
  isAdmin,
  onNavigate,
  onLogin,
  onLogout,
}: HeaderProps) {
  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={() => onNavigate("overview")}>
        <span className="brand-mark">FF</span>
        <span>
          <strong>FireForest Monitor</strong>
          <small>лесной покров и пожарная опасность</small>
        </span>
      </button>
      <Navigation activePage={activePage} onNavigate={onNavigate} />
      <LoginButton isAdmin={isAdmin} onLogin={onLogin} onLogout={onLogout} />
    </header>
  );
}
