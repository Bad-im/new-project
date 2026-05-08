import { WeatherFeatureCollection } from "../api/weatherApi";
import { weatherClassItems } from "./WeatherLayer";
import StatCard from "./StatCard";

type WeatherStatsProps = {
  data: WeatherFeatureCollection | null;
  selectedDate: string;
  source: string;
};

const classOrder = ["I", "II", "III", "IV", "V"];

function getMaxWeatherFeature(data: WeatherFeatureCollection | null) {
  if (!data || data.features.length === 0) {
    return null;
  }

  return data.features.reduce((maxFeature, feature) => {
    const currentIndex = classOrder.indexOf(feature.properties.weather_hazard_class ?? "I");
    const maxIndex = classOrder.indexOf(maxFeature.properties.weather_hazard_class ?? "I");
    return currentIndex > maxIndex ? feature : maxFeature;
  }, data.features[0]);
}

export default function WeatherStats({ data, selectedDate, source }: WeatherStatsProps) {
  const maxFeature = getMaxWeatherFeature(data);
  const maxClass = maxFeature?.properties.weather_hazard_class ?? "-";
  const maxClassName =
    weatherClassItems.find((item) => item.classValue === maxClass)?.className ?? "";

  return (
    <section className="panel">
      <h2>Статистика метеопрогноза</h2>
      <div className="compact-stats">
        <StatCard label="Районов в прогнозе" value={data?.features.length ?? 0} />
        <StatCard label="Максимальный класс" value={maxClassName ? `${maxClass} - ${maxClassName}` : maxClass} />
        <StatCard
          label="Район с максимальной опасностью"
          value={maxFeature?.properties.district_name ?? "-"}
        />
        <StatCard label="Дата прогноза" value={selectedDate || "-"} />
        <StatCard label="Источник данных" value={source || "Open-Meteo"} />
      </div>
    </section>
  );
}
