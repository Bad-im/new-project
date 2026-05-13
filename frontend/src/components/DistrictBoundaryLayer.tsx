import { GeoJSON } from "react-leaflet";
import type { Layer } from "leaflet";
import {
  DistrictFeature,
  DistrictFeatureCollection,
  DistrictBoundaryProperties,
} from "../api/districtApi";

type StyledLayer = Layer & {
  bringToFront?: () => void;
  setStyle?: (style: Record<string, string | number>) => void;
};

type DistrictBoundaryLayerProps = {
  data: DistrictFeatureCollection | null;
  fill?: boolean;
};

export function getDistrictName(properties?: DistrictBoundaryProperties): string {
  return (
    properties?.DISTRICT_NAME ??
    properties?.NAME_RU ??
    properties?.NAME ??
    properties?.name ??
    "Район не указан"
  );
}

export default function DistrictBoundaryLayer({
  data,
  fill = true,
}: DistrictBoundaryLayerProps) {
  if (!data) {
    return null;
  }

  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={() => ({
        color: "#111827",
        fillColor: "#2563eb",
        fillOpacity: fill ? 0.08 : 0,
        opacity: 0.95,
        weight: 1.8,
      })}
      onEachFeature={(feature: DistrictFeature, layer: Layer) => {
        const styledLayer = layer as StyledLayer;

        layer.bindPopup(
          [
            `<strong>${getDistrictName(feature.properties)}</strong>`,
            "Статус: Нейросетевая классификация будет доступна после дообучения модели",
            "Источник границ: Векторные данные районов",
          ].join("<br />"),
        );

        layer.on({
          mouseover: () => {
            styledLayer.setStyle?.({
              color: "#000000",
              fillOpacity: fill ? 0.12 : 0,
              weight: 3,
            });

            styledLayer.bringToFront?.();
          },
          mouseout: () => {
            styledLayer.setStyle?.({
              color: "#111827",
              fillOpacity: fill ? 0.08 : 0,
              weight: 1.8,
            });
          },
        });
      }}
    />
  );
}
