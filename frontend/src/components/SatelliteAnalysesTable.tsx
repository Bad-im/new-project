import type { SatelliteAnalysisListItem } from "../api/satelliteApi";
import { getSatelliteClassName } from "./SatelliteLayer";

type SatelliteAnalysesTableProps = {
  analyses: SatelliteAnalysisListItem[];
  isLoading?: boolean;
  canDelete?: boolean;
  onDelete?: (analysis: SatelliteAnalysisListItem) => void;
  onOpenMap: (analysisId: string) => void;
};

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

function formatClass(value: number | null) {
  return value ? getSatelliteClassName(value) : "-";
}

export default function SatelliteAnalysesTable({
  analyses,
  canDelete = false,
  isLoading = false,
  onDelete,
  onOpenMap,
}: SatelliteAnalysesTableProps) {
  if (isLoading) {
    return <p className="inline-status">Загрузка сохранённых анализов...</p>;
  }

  if (analyses.length === 0) {
    return <p className="inline-status warning">Сохранённых спутниковых анализов пока нет.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>Дата анализа</th>
            <th>Дата снимка</th>
            <th>Файл</th>
            <th>Всего патчей</th>
            <th>Обработано</th>
            <th>Пропущено</th>
            <th>Преобладающий класс</th>
            <th>Максимальный класс</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.analysis_id}>
              <td>{formatDate(analysis.created_at)}</td>
              <td>{analysis.image_date || "-"}</td>
              <td>{analysis.original_filename || analysis.analysis_id}</td>
              <td>{analysis.total_patches}</td>
              <td>{analysis.processed_patches}</td>
              <td>{analysis.skipped_patches}</td>
              <td>{formatClass(analysis.dominant_class)}</td>
              <td>{formatClass(analysis.max_class)}</td>
              <td>
                <div className="table-actions">
                  <button
                    className="table-action"
                    type="button"
                    onClick={() => onOpenMap(analysis.analysis_id)}
                  >
                    Открыть на карте
                  </button>
                  {canDelete && onDelete && (
                    <button
                      className="table-action danger"
                      type="button"
                      onClick={() => onDelete(analysis)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
