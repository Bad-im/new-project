import { districts, hazardClassFilters } from "../data/options";

export type MapFilters = {
  district: string;
  hazardClass: string;
  showHazards: boolean;
  showDistricts: boolean;
  showSatellite: boolean;
};

type FilterPanelProps = {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
};

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  return (
    <section className="panel">
      <h2>Фильтры карты</h2>
      <label className="field">
        <span>Район</span>
        <select
          value={filters.district}
          onChange={(event) => onChange({ ...filters, district: event.target.value })}
        >
          {districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Класс пожароопасности</span>
        <select
          value={filters.hazardClass}
          onChange={(event) => onChange({ ...filters, hazardClass: event.target.value })}
        >
          {hazardClassFilters.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={filters.showHazards}
            onChange={(event) => onChange({ ...filters, showHazards: event.target.checked })}
          />
          Зоны пожароопасности
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.showDistricts}
            onChange={(event) => onChange({ ...filters, showDistricts: event.target.checked })}
          />
          Границы районов
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.showSatellite}
            onChange={(event) => onChange({ ...filters, showSatellite: event.target.checked })}
          />
          Спутниковая подложка
        </label>
      </div>
    </section>
  );
}
