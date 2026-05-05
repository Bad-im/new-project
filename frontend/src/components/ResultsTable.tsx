export type ProcessingResult = {
  id: string;
  district: string;
  imageDate: string;
  channels: string;
  zoneCount: number;
  maxClass: number;
  status: string;
};

type ResultsTableProps = {
  results: ProcessingResult[];
  onOpenMap: () => void;
};

export default function ResultsTable({ results, onOpenMap }: ResultsTableProps) {
  return (
    <div className="table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Район</th>
            <th>Дата снимка</th>
            <th>Каналы</th>
            <th>Количество зон</th>
            <th>Максимальный класс</th>
            <th>Статус</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id}>
              <td>{result.id}</td>
              <td>{result.district}</td>
              <td>{result.imageDate}</td>
              <td>{result.channels}</td>
              <td>{result.zoneCount}</td>
              <td>{result.maxClass}</td>
              <td>
                <span className="status-pill">{result.status}</span>
              </td>
              <td>
                <button className="table-action" type="button" onClick={onOpenMap}>
                  Открыть на карте
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
