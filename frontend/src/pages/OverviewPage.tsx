import { Page } from "../App";
import InfoCard from "../components/InfoCard";
import StatCard from "../components/StatCard";

type OverviewPageProps = {
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
  onLogin: () => void;
};

export default function OverviewPage({ isAdmin, onNavigate, onLogin }: OverviewPageProps) {
  return (
    <div className="page-stack">
      <section className="overview-hero">
        <div>
          <p className="eyebrow">Информационно-аналитический модуль</p>
          <h1>Мониторинг пожароопасности лесного покрова</h1>
          <p>
            Система объединяет спутниковую оценку лесного покрова и кратковременный
            метеопрогноз по индексу Нестерова. Спутниковая классификация выполняется
            по сетке GeoTIFF-патчей.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate("map")}>
            Открыть карту
          </button>
          {!isAdmin ? (
            <button className="secondary-button light" type="button" onClick={onLogin}>
              Войти как администратор
            </button>
          ) : (
            <span className="status-pill">Вы вошли как администратор</span>
          )}
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="Районов в системе" value="23" hint="границы Республики Бурятия" />
        <StatCard label="Классов пожароопасности" value="5" hint="от низкой до чрезвычайной" />
        <StatCard label="Метеомодуль" value="Open-Meteo" hint="индекс Нестерова" />
        <StatCard label="Спутниковая модель" value="ResNet18" hint="7 каналов Sentinel-2" />
      </section>

      <section className="content-grid">
        <InfoCard title="Назначение системы">
          <p>
            FireForest Monitor объединяет карту пожароопасности, метеопрогноз,
            административную загрузку снимков и журнал результатов в едином интерфейсе.
          </p>
        </InfoCard>
        <InfoCard title="Входные данные">
          <ul className="clean-list">
            <li>GeoTIFF;</li>
            <li>многоканальные снимки Sentinel-2;</li>
            <li>каналы B2, B3, B4, B5, B8, B11, B12;</li>
            <li>векторные границы районов Республики Бурятия;</li>
            <li>метеоданные Open-Meteo для расчёта индекса Нестерова.</li>
          </ul>
        </InfoCard>
        <InfoCard title="Функциональные возможности">
          <ul className="clean-list">
            <li>просмотр карты пожароопасности;</li>
            <li>фильтрация по районам;</li>
            <li>расчёт метеоопасности по индексу Нестерова;</li>
            <li>нейросетевая классификация GeoTIFF по патчам;</li>
            <li>просмотр результатов обработки.</li>
          </ul>
        </InfoCard>
      </section>

      <section className="overview-band">
        <div className="section-header">
          <p className="eyebrow">Процесс</p>
          <h2>Как работает система</h2>
        </div>
        <div className="step-grid">
          {[
            "Получение спутниковых или метеорологических данных",
            "Расчёт или классификация пожарной опасности",
            "Формирование GeoJSON-слоя",
            "Отображение результата на карте",
            "Просмотр и анализ результатов",
          ].map((step, index) => (
            <article className="step-card" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid two">
        <InfoCard title="Два режима оценки">
          <ul className="clean-list">
            <li>Спутниковая оценка использует fine-tuned ResNet18.</li>
            <li>
              Метеопрогноз рассчитывается по индексу Нестерова на основе Open-Meteo.
            </li>
          </ul>
        </InfoCard>
        <InfoCard title="Метеомодуль и индекс Нестерова">
          <p>
            Метеокарта строится по прогнозным данным Open-Meteo для районов Бурятии.
            Индекс Нестерова помогает оценивать краткосрочный класс пожарной опасности.
          </p>
        </InfoCard>
        <InfoCard title="ML-модуль">
          <p>
            Нейросетевая модель классифицирует 7-канальный Sentinel-2 GeoTIFF по
            неперекрывающимся патчам 512x512 и сохраняет результат в историю.
          </p>
        </InfoCard>
        <InfoCard title="Формат результата">
          <p>
            Результаты пространственных расчётов передаются как GeoJSON FeatureCollection
            и отображаются на Leaflet-карте с popup и фильтрами.
          </p>
        </InfoCard>
      </section>

    </div>
  );
}
