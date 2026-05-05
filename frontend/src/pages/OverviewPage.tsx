import { Page } from "../App";
import InfoCard from "../components/InfoCard";
import StatCard from "../components/StatCard";

type OverviewPageProps = {
  onNavigate: (page: Page) => void;
  onLogin: () => void;
};

export default function OverviewPage({ onNavigate, onLogin }: OverviewPageProps) {
  return (
    <div className="page-stack">
      <section className="overview-hero">
        <div>
          <p className="eyebrow">Информационно-аналитический модуль</p>
          <h1>Мониторинг пожароопасности лесного покрова</h1>
          <p>
            Система предназначена для просмотра и анализа уровней пожарной опасности
            лесных территорий на основе спутниковых данных и результатов классификации.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate("map")}>
            Открыть карту
          </button>
          <button className="secondary-button light" type="button" onClick={onLogin}>
            Войти как администратор
          </button>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="Районов в системе" value="4" hint="тестовый набор" />
        <StatCard label="Классов пожароопасности" value="5" hint="от низкой до чрезвычайной" />
        <StatCard label="Тестовых зон на карте" value="5" hint="GeoJSON-слой" />
        <StatCard label="Обработанных снимков" value="12" hint="демонстрационные записи" />
      </section>

      <section className="content-grid">
        <InfoCard title="Для чего используется система">
          <ul className="clean-list">
            <li>просмотр зон пожароопасности;</li>
            <li>фильтрация по районам и классам;</li>
            <li>загрузка спутниковых снимков администратором;</li>
            <li>запуск классификации;</li>
            <li>просмотр результатов анализа.</li>
          </ul>
        </InfoCard>
        <InfoCard title="Доступ для пользователей">
          <p>
            Гости могут просматривать карту пожароопасности. Администратор может
            загружать спутниковые снимки, запускать анализ и просматривать результаты.
          </p>
        </InfoCard>
        <InfoCard title="Используемые данные">
          <ul className="clean-list">
            <li>GeoTIFF;</li>
            <li>многоканальные снимки Sentinel-2;</li>
            <li>базовые каналы B2, B3, B4, B8;</li>
            <li>дополнительные каналы B11 и B12 при наличии.</li>
          </ul>
        </InfoCard>
      </section>
    </div>
  );
}
