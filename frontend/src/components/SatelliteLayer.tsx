import { GeoJSON, Rectangle } from "react-leaflet";
import type { Layer } from "leaflet";
import type {
  SatelliteImageBounds,
  SatelliteAnalysisSummary,
  SatellitePatchFeature,
  SatellitePatchFeatureCollection,
} from "../api/satelliteApi";

export const satelliteClassItems = [
  { classValue: 1, className: "I - отсутствует", color: "#2e7d32" },
  { classValue: 2, className: "II - малая", color: "#f6c445" },
  { classValue: 3, className: "III - средняя", color: "#fb8c00" },
  { classValue: 4, className: "IV - высокая", color: "#d32f2f" },
  { classValue: 5, className: "V - чрезвычайная", color: "#7f0000" },
] as const;

const satelliteColors = new Map(
  satelliteClassItems.map((item) => [item.classValue, item.color]),
);

type SatelliteLayerProps = {
  data: SatellitePatchFeatureCollection | null;
  summary?: SatelliteAnalysisSummary | null;
  imageBoundsList?: SatelliteImageBounds[];
};

type StyledLayer = Layer & {
  bringToFront?: () => void;
  setStyle?: (style: Record<string, string | number>) => void;
};

export function getSatelliteClassColor(classValue?: number): string {
  return satelliteColors.get(classValue as 1 | 2 | 3 | 4 | 5) ?? "#607d8b";
}

export function getSatelliteClassName(classValue?: number): string {
  return (
    satelliteClassItems.find((item) => item.classValue === classValue)?.className ??
    "нет данных"
  );
}

function formatPercent(value?: number) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "нет данных";
}

export default function SatelliteLayer({ data, imageBoundsList = [], summary }: SatelliteLayerProps) {
  if (!data) {
    return null;
  }

  const boundsToRender = imageBoundsList.length > 0
    ? imageBoundsList
    : summary?.image_bounds
      ? [summary.image_bounds]
      : [];

  return (
    <>
      {boundsToRender.map((bounds, index) => (
        <Rectangle
          key={`${bounds.left}-${bounds.bottom}-${bounds.right}-${bounds.top}-${index}`}
          bounds={[
            [bounds.bottom, bounds.left],
            [bounds.top, bounds.right],
          ]}
          pathOptions={{
            color: "#12384e",
            dashArray: "8 6",
            fillOpacity: 0,
            opacity: 0.95,
            weight: 2,
          }}
        />
      ))}
      <GeoJSON
        key={JSON.stringify(data)}
        data={data}
        style={(feature) => ({
          color: "#17212b",
          fillColor: getSatelliteClassColor(feature?.properties?.predicted_class),
          fillOpacity: 0.58,
          opacity: 0.96,
          weight: 1.4,
        })}
        onEachFeature={(feature: SatellitePatchFeature, layer: Layer) => {
          const styledLayer = layer as StyledLayer;
          const properties = feature.properties;
          layer.bindPopup(
            [
              `<strong>Патч ${properties.patch_id}</strong>`,
              properties.analysis_id ? `analysis_id: ${properties.analysis_id}` : "",
              properties.original_filename ? `Файл: ${properties.original_filename}` : "",
              properties.image_date ? `Дата снимка: ${properties.image_date}` : "",
              properties.created_at ? `Дата анализа: ${properties.created_at}` : "",
              `Класс пожарной опасности: ${getSatelliteClassName(properties.predicted_class)}`,
              `Уверенность модели: ${formatPercent(properties.confidence)}`,
              `valid_ratio: ${formatPercent(properties.valid_ratio)}`,
              `Центр: ${properties.center_lat.toFixed(6)}, ${properties.center_lon.toFixed(6)}`,
            ].filter(Boolean).join("<br />"),
          );

          layer.on({
            mouseover: () => {
              styledLayer.setStyle?.({
                color: "#000000",
                weight: 3,
              });
              styledLayer.bringToFront?.();
            },
            mouseout: () => {
              styledLayer.setStyle?.({
                color: "#17212b",
                weight: 1.4,
              });
            },
          });
        }}
      />
    </>
  );
}
