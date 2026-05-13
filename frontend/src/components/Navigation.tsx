import { Page } from "../App";

const navItems: Array<{ page: Page; label: string }> = [
  { page: "overview", label: "Обзор" },
  { page: "map", label: "Карта" },
  { page: "work", label: "Работа со снимками" },
];

type NavigationProps = {
  activePage: Page;
  onNavigate: (page: Page) => void;
};

export default function Navigation({ activePage, onNavigate }: NavigationProps) {
  return (
    <nav className="navigation" aria-label="Разделы системы">
      {navItems.map((item) => (
        <button
          className={activePage === item.page ? "nav-link active" : "nav-link"}
          key={item.page}
          type="button"
          onClick={() => onNavigate(item.page)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
