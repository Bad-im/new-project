import { GeoJSON } from "react-leaflet";
import type { Layer } from "leaflet";
import { WeatherFeature, WeatherFeatureCollection, WeatherHazardClass } from "../api/weatherApi";

export const weatherClassItems = [
  { classValue: "I", className: "отсутствует", color: "#4fc3f7" },
  { classValue: "II", className: "малая", color: "#2e7d32" },
  { classValue: "III", className: "средняя", color: "#fdd835" },
  { classValue: "IV", className: "высокая", color: "#fb8c00" },
  { classValue: "V", className: "чрезвычайная", color: "#d32f2f" },
] as const;

const weatherColors = new Map(
  weatherClassItems.map((item) => [item.classValue, item.color]),
);

type WeatherLayerProps = {
  data: WeatherFeatureCollection | null;
  opacity?: number;
};

export function getWeatherHazardColor(classId?: string): string {
  return weatherColors.get(classId as WeatherHazardClass) ?? "#607d8b";
}

function formatNumber(value?: number, fallback = "нет данных") {
  return typeof value === "number" ? String(value) : fallback;
}

export default function WeatherLayer({ data, opacity = 0.52 }: WeatherLayerProps) {
  if (!data) {
    return null;
  }

  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={(feature) => ({
        color: getWeatherHazardColor(feature?.properties?.weather_hazard_class),
        fillColor: getWeatherHazardColor(feature?.properties?.weather_hazard_class),
        fillOpacity: opacity,
        opacity: 0.92,
        weight: 2,
      })}
      onEachFeature={(feature: WeatherFeature, layer: Layer) => {
        const properties = feature.properties ?? {};
        layer.bindPopup(
          [
            `<strong>${properties.district_name ?? "Район не указан"}</strong>`,
            `Дата прогноза: ${properties.date ?? "нет данных"}`,
            `Температура: ${formatNumber(properties.temperature_c)} °C`,
            `Точка росы: ${formatNumber(properties.dew_point_c)} °C`,
            `Осадки: ${formatNumber(properties.precipitation_mm)} мм`,
            `Индекс Нестерова / КППО: ${formatNumber(properties.nesterov_index)}`,
            `Класс пожарной опасности: ${properties.weather_hazard_class ?? "нет данных"} (${properties.hazard_name ?? "нет данных"})`,
            `Источник данных: ${properties.source ?? "нет данных"}`,
          ].join("<br />"),
        );
      }}
    />
  );
}
