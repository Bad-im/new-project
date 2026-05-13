import { HazardFeatureCollection } from "../api/predictionApi";
import StatCard from "./StatCard";

type HazardStatsProps = {
  displayedDistrictCount: number;
  selectedDistrict: string;
};

export function getMaxHazardClass(data: HazardFeatureCollection | null): string {
  if (!data || data.features.length === 0) {
    return "-";
  }

  return String(Math.max(...data.features.map((feature) => feature.properties.hazard_class)));
}

export default function HazardStats({
  displayedDistrictCount,
  selectedDistrict,
}: HazardStatsProps) {
  return (
    <section className="panel">
      <h2>Статистика</h2>
      <div className="compact-stats">
        <StatCard label="Районов отображено" value={displayedDistrictCount} />
        <StatCard label="Выбранный район" value={selectedDistrict} />
        <StatCard label="Статус слоя" value="ожидает подключения модели" />
      </div>
    </section>
  );
}
