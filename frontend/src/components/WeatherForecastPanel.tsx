import { WeatherDistrict } from "../api/weatherApi";

export type ForecastDateOption = {
  value: string;
  label: string;
};

type WeatherForecastPanelProps = {
  dateOptions: ForecastDateOption[];
  selectedDate: string;
  selectedDistrict: string;
  districts: WeatherDistrict[];
  isLoading: boolean;
  source: string;
  warning: string;
  usingMockData: boolean;
  onDateChange: (date: string) => void;
  onDistrictChange: (districtId: string) => void;
  onRefresh: () => void;
};

export default function WeatherForecastPanel({
  dateOptions,
  selectedDate,
  selectedDistrict,
  districts,
  isLoading,
  source,
  warning,
  usingMockData,
  onDateChange,
  onDistrictChange,
  onRefresh,
}: WeatherForecastPanelProps) {
  return (
    <section className="panel">
      <h2>Метеопрогноз</h2>
      <label className="field">
        <span>Дата прогноза</span>
        <select value={selectedDate} onChange={(event) => onDateChange(event.target.value)}>
          {dateOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Район</span>
        <select
          value={selectedDistrict}
          onChange={(event) => onDistrictChange(event.target.value)}
        >
          <option value="all">Все районы</option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </label>
      <button className="secondary-button full-width" type="button" onClick={onRefresh}>
        Обновить метеопрогноз
      </button>
      <div className="source-box">
        <span>Источник данных</span>
        <strong>{source || "Open-Meteo"}</strong>
      </div>
      {isLoading && <p className="inline-status">Загрузка метеопрогноза</p>}
      {usingMockData && <p className="inline-status warning">Используются тестовые данные</p>}
      {warning && <p className="inline-status warning">{warning}</p>}
    </section>
  );
}
