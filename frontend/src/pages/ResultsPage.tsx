import { useMemo, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import ResultsTable, { ProcessingResult } from "../components/ResultsTable";
import { districts, hazardClassFilters, statusFilters } from "../data/options";

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

type ResultsPageProps = {
  isAdmin: boolean;
  onLogin: () => void;
  onOpenMap: () => void;
};

export default function ResultsPage({ isAdmin, onLogin, onOpenMap }: ResultsPageProps) {
  const [district, setDistrict] = useState("Все районы");
  const [hazardClass, setHazardClass] = useState("all");
  const [status, setStatus] = useState("Все статусы");

  const filteredResults = useMemo(
    () =>
      demoResults.filter((result) => {
        const districtMatches = district === "Все районы" || result.district === district;
        const classMatches = hazardClass === "all" || String(result.maxClass) === hazardClass;
        const statusMatches = status === "Все статусы" || result.status === status;
        return districtMatches && classMatches && statusMatches;
      }),
    [district, hazardClass, status],
  );

  return (
    <ProtectedPage
      isAdmin={isAdmin}
      onLogin={onLogin}
      message="Для просмотра результатов обработки необходимо войти как администратор."
    >
      <div className="page-stack">
        <section className="section-header">
          <p className="eyebrow">Журнал обработок</p>
          <h1>Результаты</h1>
          <p>Тестовая таблица запусков анализа для административного режима.</p>
        </section>

        <section className="info-card">
          <h2>Фильтры результатов</h2>
          <div className="form-grid">
            <label className="field">
              <span>Район</span>
              <select value={district} onChange={(event) => setDistrict(event.target.value)}>
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
      </div>
    </ProtectedPage>
  );
}
