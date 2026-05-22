import { useEffect, useMemo, useState } from "react";
import {
  SatelliteAnalysisDetailResponse,
  SatelliteAnalysisListItem,
  SatelliteAnalysisSuccessResponse,
  analyzeSatelliteImage,
  deleteAllSatelliteAnalyses,
  deleteSatelliteAnalysis,
  getSatelliteAnalyses,
  getSatelliteAnalysisDetail,
} from "../api/satelliteApi";
import InfoCard from "../components/InfoCard";
import SatelliteAnalysesTable from "../components/SatelliteAnalysesTable";
import { getSatelliteClassName } from "../components/SatelliteLayer";
import StatCard from "../components/StatCard";
import UploadPanel from "../components/UploadPanel";
import { hazardClassFilters } from "../data/options";

type WorkWithImagesPageProps = {
  isAdmin: boolean;
  satelliteAnalysis: SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null;
  onSatelliteAnalysis: (
    analysis: SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null,
  ) => void;
  onLogin: () => void;
  onOpenMap: (analysisId?: string) => void;
};

type WorkTab = "analysis" | "journal";

export default function WorkWithImagesPage({
  isAdmin,
  satelliteAnalysis,
  onSatelliteAnalysis,
  onLogin,
  onOpenMap,
}: WorkWithImagesPageProps) {
  const [activeTab, setActiveTab] = useState<WorkTab>("analysis");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageDate, setImageDate] = useState("2026-04-20");
  const [channels, setChannels] = useState("B2, B3, B4, B5, B8, B11, B12");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [hazardClass, setHazardClass] = useState("all");
  const [analyses, setAnalyses] = useState<SatelliteAnalysisListItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [openError, setOpenError] = useState("");

  const zoneCount = satelliteAnalysis?.summary.processed_patches ?? 0;
  const maxClass = satelliteAnalysis?.summary.max_class
    ? getSatelliteClassName(satelliteAnalysis.summary.max_class)
    : "-";
  const filteredResults = useMemo(
    () =>
      analyses.filter((item) => {
        return hazardClass === "all" || String(item.max_class) === hazardClass;
      }),
    [analyses, hazardClass],
  );

  const loadHistory = async () => {
    setIsHistoryLoading(true);
    setHistoryError("");

    try {
      setAnalyses(await getSatelliteAnalyses());
    } catch (historyLoadError) {
      setHistoryError(
        historyLoadError instanceof Error
          ? historyLoadError.message
          : "Не удалось загрузить историю анализов",
      );
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "journal") {
      void loadHistory();
    }
  }, [activeTab]);

  const handleRun = async () => {
    if (!selectedFile) {
      setError("Выберите GeoTIFF-файл перед запуском анализа.");
      return;
    }

    setIsRunning(true);
    setError("");
    setWarning("");

    try {
      const data = await analyzeSatelliteImage(selectedFile, imageDate);
      onSatelliteAnalysis(data);
      void loadHistory();

      if (data.geojson.features.length === 0) {
        setWarning("GeoJSON пустой: все патчи были пропущены или снимок меньше 512x512.");
      }
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Не удалось выполнить спутниковую оценку",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpenSavedAnalysis = async (analysisId: string) => {
    setOpenError("");
    try {
      const analysis = await getSatelliteAnalysisDetail(analysisId);
      onSatelliteAnalysis(analysis);
      onOpenMap(analysis.analysis_id);
    } catch (analysisOpenError) {
      setOpenError(
        analysisOpenError instanceof Error
          ? analysisOpenError.message
          : "Не удалось открыть сохранённый анализ",
      );
    }
  };

  const handleDeleteSavedAnalysis = async (analysis: SatelliteAnalysisListItem) => {
    const label = analysis.original_filename || analysis.analysis_id;
    const confirmed = window.confirm(
      `Удалить сохранённый анализ "${label}"${analysis.image_date ? ` от ${analysis.image_date}` : ""}? Это удалит исходный GeoTIFF, summary, GeoJSON и metadata.`,
    );

    if (!confirmed) {
      return;
    }

    setOpenError("");
    try {
      await deleteSatelliteAnalysis(analysis.analysis_id);
      if (satelliteAnalysis?.analysis_id === analysis.analysis_id) {
        onSatelliteAnalysis(null);
      }
      await loadHistory();
    } catch (deleteError) {
      setOpenError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить анализ");
    }
  };

  const handleDeleteAllSavedAnalyses = async () => {
    const confirmed = window.confirm(
      "Удалить все сохранённые спутниковые анализы? Это удалит все исходные GeoTIFF, summary, GeoJSON и metadata из файлового хранилища.",
    );

    if (!confirmed) {
      return;
    }

    setOpenError("");
    try {
      await deleteAllSatelliteAnalyses();
      onSatelliteAnalysis(null);
      await loadHistory();
    } catch (deleteError) {
      setOpenError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить анализы");
    }
  };

  return (
    <div className="page-stack work-page">
      <section className="section-header">
        <p className="eyebrow">Администрирование обработки</p>
        <h1>Работа со снимками</h1>
        <p>
          Загрузка GeoTIFF, запуск спутникового анализа и просмотр журнала результатов
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

      {activeTab === "analysis" && !isAdmin && (
        <section className="protected-state">
          <div className="protected-card">
            <p className="eyebrow">Требуется вход администратора</p>
            <h1>Загрузка GeoTIFF и запуск анализа доступны только администратору.</h1>
            <p>
              Без входа можно открыть вкладку журнала и просматривать уже сохранённые результаты
              спутникового анализа.
            </p>
            <button className="primary-button" type="button" onClick={onLogin}>
              Войти как администратор
            </button>
          </div>
        </section>
      )}

      {activeTab === "analysis" && isAdmin && (
        <>
          <section className="analysis-grid">
            <UploadPanel
              selectedFileName={selectedFileName}
              onFileChange={setSelectedFile}
              onFileSelect={setSelectedFileName}
            />
            <InfoCard title="Поддерживаемые данные">
              <ul className="clean-list">
                <li>GeoTIFF;</li>
                <li>многоканальные снимки Sentinel-2;</li>
                <li>ровно 7 каналов: B2, B3, B4, B5, B8, B11, B12;</li>
                <li>CRS и геопривязка обязательны.</li>
              </ul>
            </InfoCard>
          </section>

          <section className="info-card">
            <h2>Параметры анализа</h2>
            <div className="form-grid">
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
                  <option>B2, B3, B4, B5, B8, B11, B12</option>
                </select>
              </label>
              <label className="field">
                <span>Режим анализа</span>
                <select defaultValue="ml">
                  <option value="ml">Fine-tuned ResNet18 inference</option>
                </select>
              </label>
            </div>
            <p className="inline-status">
              Модель классифицирует снимок неперекрывающимися патчами 512x512. Итоговая оценка
              снимка складывается из распределения классов по патчам.
            </p>
            <p className="inline-status">
              Район определяется по географическому положению загруженного GeoTIFF. Один снимок
              может пересекать несколько муниципальных районов.
            </p>
            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                disabled={isRunning}
                onClick={handleRun}
              >
                {isRunning ? "Спутниковая оценка выполняется" : "Выполнить спутниковую оценку"}
              </button>
            </div>
            {error && <p className="error-message">{error}</p>}
            {warning && <p className="inline-status warning">{warning}</p>}
          </section>

          {satelliteAnalysis && (
            <section className="result-summary">
              <div>
                <p className="eyebrow">Результат получен</p>
                <h2>Спутниковая классификация по патчам завершена</h2>
              </div>
              <div className="stat-grid narrow">
                <StatCard label="Обработано патчей" value={zoneCount} />
                <StatCard label="Максимальный класс" value={maxClass} />
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onOpenMap(satelliteAnalysis.analysis_id)}
              >
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
              Журнал показывает реальные сохранённые спутниковые анализы из файлового хранилища.
            </p>
            <div className="form-grid">
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
            </div>
            <button className="secondary-button" type="button" onClick={loadHistory}>
              Обновить журнал
            </button>
            {isAdmin && analyses.length > 0 && (
              <button
                className="secondary-button danger"
                type="button"
                onClick={handleDeleteAllSavedAnalyses}
              >
                Удалить все
              </button>
            )}
          </section>

          {historyError && <p className="error-message">{historyError}</p>}
          {openError && <p className="error-message">{openError}</p>}
          <SatelliteAnalysesTable
            analyses={filteredResults}
            canDelete={isAdmin}
            isLoading={isHistoryLoading}
            onDelete={handleDeleteSavedAnalysis}
            onOpenMap={handleOpenSavedAnalysis}
          />
        </>
      )}
    </div>
  );
}
