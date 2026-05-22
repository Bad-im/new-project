import { useEffect, useMemo, useState } from "react";
import {
  SatelliteAnalysisListItem,
  getSatelliteAnalyses,
  getSatelliteAnalysisDetail,
} from "../api/satelliteApi";
import SatelliteAnalysesTable from "../components/SatelliteAnalysesTable";
import { hazardClassFilters } from "../data/options";

type ResultsPageProps = {
  onOpenMap: (analysisId?: string) => void;
};

export default function ResultsPage({ onOpenMap }: ResultsPageProps) {
  const [hazardClass, setHazardClass] = useState("all");
  const [analyses, setAnalyses] = useState<SatelliteAnalysisListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredResults = useMemo(
    () =>
      analyses.filter((analysis) => (
        hazardClass === "all" || String(analysis.max_class) === hazardClass
      )),
    [analyses, hazardClass],
  );

  const loadAnalyses = async () => {
    setIsLoading(true);
    setError("");

    try {
      setAnalyses(await getSatelliteAnalyses());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить результаты");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalyses();
  }, []);

  const handleOpenMap = async (analysisId: string) => {
    try {
      await getSatelliteAnalysisDetail(analysisId);
      onOpenMap(analysisId);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Не удалось открыть анализ");
    }
  };

  return (
    <div className="page-stack">
      <section className="section-header">
        <p className="eyebrow">Журнал обработок</p>
        <h1>Результаты</h1>
        <p>Список сохранённых спутниковых анализов из файлового хранилища.</p>
      </section>

      <section className="info-card">
        <h2>Фильтры результатов</h2>
        <div className="form-grid">
          <label className="field">
            <span>Класс пожароопасности</span>
            <select value={hazardClass} onChange={(event) => setHazardClass(event.target.value)}>
              {hazardClassFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="secondary-button" type="button" onClick={loadAnalyses}>
          Обновить журнал
        </button>
      </section>

      {error && <p className="error-message">{error}</p>}
      <SatelliteAnalysesTable
        analyses={filteredResults}
        isLoading={isLoading}
        onOpenMap={handleOpenMap}
      />
    </div>
  );
}
