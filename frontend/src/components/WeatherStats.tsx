import { WeatherFeatureCollection } from "../api/weatherApi";
import { weatherClassItems } from "./WeatherLayer";
import StatCard from "./StatCard";

type WeatherStatsProps = {
  data: WeatherFeatureCollection | null;
  selectedDate: string;
  selectedDistrict: string;
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

function getDominantWeatherClass(data: WeatherFeatureCollection | null): string {
  if (!data || data.features.length === 0) {
    return "-";
  }

  const counts = data.features.reduce<Record<string, number>>((acc, feature) => {
    const hazardClass = feature.properties.weather_hazard_class ?? "I";
    acc[hazardClass] = (acc[hazardClass] ?? 0) + 1;
    return acc;
  }, {});

  const [dominantClass] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const dominantClassName =
    weatherClassItems.find((item) => item.classValue === dominantClass)?.className ?? "";
  return dominantClassName ? `${dominantClass} - ${dominantClassName}` : dominantClass;
}

export default function WeatherStats({ data, selectedDate, selectedDistrict }: WeatherStatsProps) {
  const maxFeature = getMaxWeatherFeature(data);
  const maxClass = maxFeature?.properties.weather_hazard_class ?? "-";
  const maxClassName =
    weatherClassItems.find((item) => item.classValue === maxClass)?.className ?? "";

  return (
    <section className="panel">
      <h2>Статистика</h2>
      <div className="compact-stats">
        <StatCard label="Зон/районов" value={data?.features.length ?? 0} />
        <StatCard label="Максимальный класс" value={maxClassName ? `${maxClass} - ${maxClassName}` : maxClass} />
        <StatCard label="Преобладающий класс" value={getDominantWeatherClass(data)} />
        <StatCard label="Выбранный район" value={selectedDistrict} />
        <StatCard label="Дата прогноза" value={selectedDate || "-"} />
      </div>
    </section>
  );
}
