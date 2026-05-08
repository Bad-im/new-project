import { districts, hazardClassFilters } from "../data/options";

export type MapFilters = {
  district: string;
  hazardClass: string;
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
    </section>
  );
}
