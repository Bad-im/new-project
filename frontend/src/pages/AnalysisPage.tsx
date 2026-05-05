import { useMemo, useState } from "react";
import { HazardFeatureCollection, runPrediction } from "../api/predictionApi";
import InfoCard from "../components/InfoCard";
import ProtectedPage from "../components/ProtectedPage";
import StatCard from "../components/StatCard";
import UploadPanel from "../components/UploadPanel";
import { getMaxHazardClass } from "../components/HazardStats";
import { districts } from "../data/options";

type AnalysisPageProps = {
  isAdmin: boolean;
  onLogin: () => void;
  onOpenMap: () => void;
};

export default function AnalysisPage({ isAdmin, onLogin, onOpenMap }: AnalysisPageProps) {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [district, setDistrict] = useState("Баргузинский район");
  const [imageDate, setImageDate] = useState("2026-04-20");
  const [channels, setChannels] = useState("B2, B3, B4, B8");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<HazardFeatureCollection | null>(null);
  const [error, setError] = useState("");

  const zoneCount = result?.features.length ?? 0;
  const maxClass = useMemo(() => getMaxHazardClass(result), [result]);

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

  return (
    <ProtectedPage
      isAdmin={isAdmin}
      onLogin={onLogin}
      message="Для загрузки спутниковых снимков и запуска анализа необходимо войти как администратор."
    >
      <div className="page-stack">
        <section className="section-header">
          <p className="eyebrow">Администрирование обработки</p>
          <h1>Анализ спутниковых снимков</h1>
          <p>Запуск тестового сценария классификации через существующий endpoint backend.</p>
        </section>

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
                <option value="test">Тестовый режим</option>
                <option value="ml" disabled>
                  Нейросетевой режим - будет подключен позже
                </option>
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={isRunning}
            onClick={handleRun}
          >
            {isRunning ? "Анализ выполняется" : "Запустить анализ"}
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>

        {result && (
          <section className="result-summary">
            <div>
              <p className="eyebrow">Результат получен</p>
              <h2>Тестовая классификация завершена</h2>
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
      </div>
    </ProtectedPage>
  );
}
