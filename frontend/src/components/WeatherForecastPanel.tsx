import { WeatherDistrict } from "../api/weatherApi";
import { weatherClassItems } from "./WeatherLayer";

export type ForecastDateOption = {
  value: string;
  label: string;
};

type WeatherForecastPanelProps = {
  dateOptions: ForecastDateOption[];
  selectedDate: string;
  selectedDistrict: string;
  selectedHazardClass: string;
  districts: WeatherDistrict[];
  isLoading: boolean;
  onDateChange: (date: string) => void;
  onDistrictChange: (districtId: string) => void;
  onHazardClassChange: (hazardClass: string) => void;
  onRefresh: () => void;
};

export default function WeatherForecastPanel({
  dateOptions,
  selectedDate,
  selectedDistrict,
  selectedHazardClass,
  districts,
  isLoading,
  onDateChange,
  onDistrictChange,
  onHazardClassChange,
  onRefresh,
}: WeatherForecastPanelProps) {
  return (
    <section className="panel">
      <h2>Фильтры</h2>
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
      <label className="field">
        <span>Класс пожароопасности</span>
        <select
          value={selectedHazardClass}
          onChange={(event) => onHazardClassChange(event.target.value)}
        >
          <option value="all">Все классы</option>
          {weatherClassItems.map((item) => (
            <option key={item.classValue} value={item.classValue}>
              {item.classValue} - {item.className}
            </option>
          ))}
        </select>
      </label>
      <button className="secondary-button full-width" type="button" onClick={onRefresh}>
        Обновить метеопрогноз
      </button>
      {isLoading && <p className="inline-status">Загрузка метеопрогноза</p>}
    </section>
  );
}
