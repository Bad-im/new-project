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
            Система объединяет спутниковую оценку лесного покрова и кратковременный
            метеопрогноз по индексу Нестерова. Спутниковая классификация будет
            подключена после дообучения модели.
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
        <StatCard label="Районов в системе" value="23" hint="границы Республики Бурятия" />
        <StatCard label="Классов пожароопасности" value="5" hint="от низкой до чрезвычайной" />
        <StatCard label="Метеомодуль" value="Open-Meteo" hint="индекс Нестерова" />
        <StatCard label="Спутниковая модель" value="ожидает подключения" hint="после дообучения" />
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
            <li>каналы B2, B3, B4, B8, B11, B12;</li>
            <li>векторные границы районов Республики Бурятия;</li>
            <li>метеоданные Open-Meteo для расчёта индекса Нестерова.</li>
          </ul>
        </InfoCard>
        <InfoCard title="Функциональные возможности">
          <ul className="clean-list">
            <li>просмотр карты пожароопасности;</li>
            <li>фильтрация по районам;</li>
            <li>расчёт метеоопасности по индексу Нестерова;</li>
            <li>подготовка к подключению нейросетевой классификации;</li>
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
            <li>Спутниковая оценка будет использовать дообучаемую модель.</li>
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
        <InfoCard title="Будущее подключение ML-модуля">
          <p>
            Нейросетевая модель спутниковой классификации будет подключена после
            дообучения. Сейчас спутниковый режим показывает реальные границы районов.
          </p>
        </InfoCard>
        <InfoCard title="Формат результата">
          <p>
            Результаты пространственных расчётов передаются как GeoJSON FeatureCollection
            и отображаются на Leaflet-карте с popup и фильтрами.
          </p>
        </InfoCard>
      </section>

      <section className="content-grid two">
        <InfoCard title="Текущий статус прототипа">
          <ul className="clean-list">
            <li>метеомодуль подключён;</li>
            <li>реальные границы 23 районов подключены;</li>
            <li>спутниковая модель будет подключена после дообучения;</li>
            <li>авторизация пока mock.</li>
          </ul>
        </InfoCard>
        <InfoCard title="Ограничения текущего прототипа">
          <p>
            В прототипе нет промышленной авторизации, базы данных и полноценной обработки
            GeoTIFF нейросетевой моделью. Журнал обработок содержит демонстрационные записи.
          </p>
        </InfoCard>
      </section>
    </div>
  );
}
