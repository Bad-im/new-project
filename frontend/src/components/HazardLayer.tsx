import { GeoJSON } from "react-leaflet";
import type { Layer } from "leaflet";
import { HazardFeature, HazardFeatureCollection } from "../api/predictionApi";

export const hazardClassItems = [
  { classValue: 1, className: "1 - Низкая", color: "#2e7d32" },
  { classValue: 2, className: "2 - Умеренная", color: "#fdd835" },
  { classValue: 3, className: "3 - Средняя", color: "#fb8c00" },
  { classValue: 4, className: "4 - Высокая", color: "#d32f2f" },
  { classValue: 5, className: "5 - Чрезвычайная", color: "#7f0000" },
] as const;

const hazardColors = new Map(
  hazardClassItems.map((item) => [item.classValue, item.color]),
);

type HazardLayerProps = {
  data: HazardFeatureCollection | null;
  variant?: "hazard" | "boundary";
};

export function getHazardColor(hazardClass: number): string {
  return hazardColors.get(hazardClass as 1 | 2 | 3 | 4 | 5) ?? "#607d8b";
}

export default function HazardLayer({ data, variant = "hazard" }: HazardLayerProps) {
  if (!data) {
    return null;
  }

  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={(feature) => ({
        color:
          variant === "boundary"
            ? "#26495f"
            : getHazardColor(feature?.properties?.hazard_class ?? 0),
        dashArray: variant === "boundary" ? "6 5" : undefined,
        fillColor:
          variant === "boundary"
            ? "transparent"
            : getHazardColor(feature?.properties?.hazard_class ?? 0),
        fillOpacity: variant === "boundary" ? 0 : 0.55,
        opacity: variant === "boundary" ? 0.7 : 0.95,
        weight: variant === "boundary" ? 2 : 2,
      })}
      onEachFeature={(feature: HazardFeature, layer: Layer) => {
        layer.bindPopup(
          [
            `<strong>${feature.properties.district}</strong>`,
            `Класс пожароопасности: ${feature.properties.hazard_class}`,
            `Название класса: ${feature.properties.hazard_name}`,
            `Площадь: ${feature.properties.area_ha} га`,
            `Дата снимка: ${feature.properties.image_date}`,
          ].join("<br />"),
        );
      }}
    />
  );
}
