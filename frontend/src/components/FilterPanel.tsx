import { District } from "../api/districtApi";

export type MapFilters = {
  districtId: string;
};

type FilterPanelProps = {
  filters: MapFilters;
  districts: District[];
  onChange: (filters: MapFilters) => void;
};

export default function FilterPanel({ filters, districts, onChange }: FilterPanelProps) {
  return (
    <section className="panel">
      <h2>Фильтры</h2>
      <label className="field">
        <span>Район</span>
        <select
          value={filters.districtId}
          onChange={(event) => onChange({ districtId: event.target.value })}
        >
          <option value="all">Все районы</option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </label>
      <p className="inline-status">
        Фильтрация по классам будет доступна после подключения нейросетевой модели.
      </p>
    </section>
  );
}
