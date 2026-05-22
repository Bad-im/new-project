import type { SatelliteAnalysisSummary } from "../api/satelliteApi";
import { getSatelliteClassName, satelliteClassItems } from "./SatelliteLayer";

type SatelliteSummaryPanelProps = {
  summary: SatelliteAnalysisSummary | null;
  title?: string;
};

function formatClass(value: number | null) {
  return value ? getSatelliteClassName(value) : "нет данных";
}

export default function SatelliteSummaryPanel({
  summary,
  title = "Summary спутникового анализа",
}: SatelliteSummaryPanelProps) {
  if (!summary) {
    return (
      <section className="panel">
        <h2>Результат спутниковой оценки</h2>
        <p className="inline-status">
          Загрузите GeoTIFF и запустите анализ. Модель классифицирует снимок не целиком, а
          отдельными патчами 512x512.
        </p>
      </section>
    );
  }

  return (
    <section className="panel satellite-summary">
      <h2>{title}</h2>
      <div className="summary-lines">
        {typeof summary.analysis_count === "number" && (
          <>
            <span>Количество снимков</span>
            <strong>{summary.analysis_count}</strong>
          </>
        )}
        <span>Всего патчей</span>
        <strong>{summary.total_patches}</strong>
        <span>Обработано</span>
        <strong>{summary.processed_patches}</strong>
        <span>Пропущено</span>
        <strong>{summary.skipped_patches}</strong>
        <span>Преобладающий класс</span>
        <strong>{formatClass(summary.dominant_class)}</strong>
        <span>Максимальный обнаруженный класс</span>
        <strong>{formatClass(summary.max_class)}</strong>
      </div>
      <div className="class-distribution">
        {satelliteClassItems.map((item) => {
          const classKey = String(item.classValue);
          return (
            <div key={item.classValue} className="distribution-row">
              <span className="legend-swatch" style={{ backgroundColor: item.color }} />
              <span>{item.className}</span>
              <strong>{summary.class_counts[classKey] ?? 0}</strong>
              <small>{summary.class_percentages[classKey] ?? 0}%</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
