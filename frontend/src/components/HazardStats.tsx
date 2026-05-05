import { HazardFeatureCollection } from "../api/predictionApi";
import StatCard from "./StatCard";

type HazardStatsProps = {
  data: HazardFeatureCollection | null;
  selectedDistrict: string;
};

function getDominantClass(data: HazardFeatureCollection | null): string {
  if (!data || data.features.length === 0) {
    return "-";
  }

  const counts = data.features.reduce<Record<number, number>>((acc, feature) => {
    const hazardClass = feature.properties.hazard_class;
    acc[hazardClass] = (acc[hazardClass] ?? 0) + 1;
    return acc;
  }, {});

  const [hazardClass] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return hazardClass;
}

export function getMaxHazardClass(data: HazardFeatureCollection | null): string {
  if (!data || data.features.length === 0) {
    return "-";
  }

  return String(Math.max(...data.features.map((feature) => feature.properties.hazard_class)));
}

export default function HazardStats({ data, selectedDistrict }: HazardStatsProps) {
  return (
    <section className="panel">
      <h2>Текущее отображение</h2>
      <div className="compact-stats">
        <StatCard label="Зон" value={data?.features.length ?? 0} />
        <StatCard label="Максимальный класс" value={getMaxHazardClass(data)} />
        <StatCard label="Преобладающий класс" value={getDominantClass(data)} />
        <StatCard label="Район" value={selectedDistrict} />
      </div>
    </section>
  );
}
