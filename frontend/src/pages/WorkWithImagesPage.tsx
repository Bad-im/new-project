import { useMemo, useState } from "react";
import { HazardFeatureCollection, runPrediction } from "../api/predictionApi";
import InfoCard from "../components/InfoCard";
import ResultsTable, { ProcessingResult } from "../components/ResultsTable";
import StatCard from "../components/StatCard";
import UploadPanel from "../components/UploadPanel";
import { getMaxHazardClass } from "../components/HazardStats";
import { districts, hazardClassFilters, statusFilters } from "../data/options";

type WorkWithImagesPageProps = {
  isAdmin: boolean;
  onLogin: () => void;
  onOpenMap: () => void;
};

type WorkTab = "analysis" | "journal";

const demoResults: ProcessingResult[] = [
  {
    id: "RUN-001",
    district: "Баргузинский район",
    imageDate: "2026-04-20",
    channels: "B2, B3, B4, B8",
    zoneCount: 5,
    maxClass: 5,
    status: "Результат получен",
  },
  {
    id: "RUN-002",
    district: "Кабанский район",
    imageDate: "2026-04-18",
    channels: "B2, B3, B4, B8, B11, B12",
    zoneCount: 3,
    maxClass: 4,
    status: "Результат получен",
  },
  {
    id: "RUN-003",
    district: "Иволгинский район",
    imageDate: "2026-04-15",
    channels: "B2, B3, B4, B8",
    zoneCount: 0,
    maxClass: 2,
    status: "В обработке",
  },
];

export default function WorkWithImagesPage({
  isAdmin,
  onLogin,
  onOpenMap,
}: WorkWithImagesPageProps) {
  const [activeTab, setActiveTab] = useState<WorkTab>("analysis");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [district, setDistrict] = useState("Баргузинский район");
  const [imageDate, setImageDate] = useState("2026-04-20");
  const [channels, setChannels] = useState("B2, B3, B4, B8");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<HazardFeatureCollection | null>(null);
  const [error, setError] = useState("");
  const [resultDistrict, setResultDistrict] = useState("Все районы");
  const [hazardClass, setHazardClass] = useState("all");
  const [status, setStatus] = useState("Все статусы");

  const zoneCount = result?.features.length ?? 0;
  const maxClass = useMemo(() => getMaxHazardClass(result), [result]);
  const filteredResults = useMemo(
    () =>
      demoResults.filter((item) => {
        const districtMatches =
          resultDistrict === "Все районы" || item.district === resultDistrict;
        const classMatches = hazardClass === "all" || String(item.maxClass) === hazardClass;
        const statusMatches = status === "Все статусы" || item.status === status;
        return districtMatches && classMatches && statusMatches;
      }),
    [hazardClass, resultDistrict, status],
  );

  const handleRun = async () => {
    setIsRunning(true);
    setError("");
    setResult(null);

    try {
      const data = await runPrediction();
      setResult(data);
    } catch {
      setError("Не удалось выполнить тестовый анализ");
    } finally {
      setIsRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="protected-state">
        <div className="protected-card">
          <p className="eyebrow">Требуется вход администратора</p>
          <h1>Работа со спутниковыми снимками доступна только администратору.</h1>
          <p>
            Войдите в режим администратора, чтобы загружать GeoTIFF, запускать анализ и
            просматривать результаты обработки.
          </p>
          <button className="primary-button" type="button" onClick={onLogin}>
            Войти как администратор
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="page-stack work-page">
      <section className="section-header">
        <p className="eyebrow">Администрирование обработки</p>
        <h1>Работа со снимками</h1>
        <p>
          Загрузка GeoTIFF, запуск демонстрационного анализа и просмотр журнала результатов
          собраны в одном административном разделе.
        </p>
      </section>

      <div className="page-tabs" role="tablist" aria-label="Работа со снимками">
        <button
          className={activeTab === "analysis" ? "page-tab active" : "page-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "analysis"}
          onClick={() => setActiveTab("analysis")}
        >
          Загрузка и анализ
        </button>
        <button
          className={activeTab === "journal" ? "page-tab active" : "page-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "journal"}
          onClick={() => setActiveTab("journal")}
        >
          Журнал результатов
        </button>
      </div>

      {activeTab === "analysis" && (
        <>
          <section className="analysis-grid">
            <UploadPanel selectedFileName={selectedFileName} onFileSelect={setSelectedFileName} />
            <InfoCard title="Поддерживаемые данные">
              <ul className="clean-list">
                <li>GeoTIFF;</li>
                <li>многоканальные снимки Sentinel-2;</li>
                <li>B2, B3, B4, B8;</li>
                <li>опционально B11, B12.</li>
              </ul>
            </InfoCard>
          </section>

          <section className="info-card">
            <h2>Параметры анализа</h2>
            <div className="form-grid">
              <label className="field">
                <span>Район</span>
                <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                  {districts
                    .filter((item) => item !== "Все районы")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span>Дата снимка</span>
                <input
                  type="date"
                  value={imageDate}
                  onChange={(event) => setImageDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Набор каналов</span>
                <select value={channels} onChange={(event) => setChannels(event.target.value)}>
                  <option>B2, B3, B4, B8</option>
                  <option>B2, B3, B4, B8, B11, B12</option>
                </select>
              </label>
              <label className="field">
                <span>Режим анализа</span>
                <select defaultValue="test">
                  <option value="test">Демонстрационный режим</option>
                  <option value="ml" disabled>
                    Нейросетевая модель будет подключена после дообучения
                  </option>
                </select>
              </label>
            </div>
            <p className="inline-status">
              Нейросетевая модель будет подключена после дообучения.
            </p>
            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                disabled={isRunning}
                onClick={handleRun}
              >
                {isRunning ? "Анализ выполняется" : "Запустить анализ"}
              </button>
            </div>
            {error && <p className="error-message">{error}</p>}
          </section>

          {result && (
            <section className="result-summary">
              <div>
                <p className="eyebrow">Результат получен</p>
                <h2>Демонстрационная классификация завершена</h2>
              </div>
              <div className="stat-grid narrow">
                <StatCard label="Количество зон" value={zoneCount} />
                <StatCard label="Максимальный класс" value={maxClass} />
              </div>
              <button className="secondary-button" type="button" onClick={onOpenMap}>
                Открыть на карте
              </button>
            </section>
          )}
        </>
      )}

      {activeTab === "journal" && (
        <>
          <section className="info-card">
            <h2>Фильтры результатов</h2>
            <p className="inline-status">
              В текущем прототипе журнал содержит демонстрационные записи.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Район</span>
                <select
                  value={resultDistrict}
                  onChange={(event) => setResultDistrict(event.target.value)}
                >
                  {districts.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Класс пожароопасности</span>
                <select
                  value={hazardClass}
                  onChange={(event) => setHazardClass(event.target.value)}
                >
                  {hazardClassFilters.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Статус</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statusFilters.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <ResultsTable results={filteredResults} onOpenMap={onOpenMap} />
        </>
      )}
    </div>
  );
}
