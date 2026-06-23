import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import DistrictBoundaryLayer from "./DistrictBoundaryLayer";
import SatelliteLayer from "./SatelliteLayer";
import WeatherLayer from "./WeatherLayer";
import { DistrictFeatureCollection } from "../api/districtApi";
import type {
  SatelliteImageBounds,
  SatelliteAnalysisSummary,
  SatellitePatchFeatureCollection,
} from "../api/satelliteApi";
import { WeatherFeatureCollection } from "../api/weatherApi";

type MapViewProps = {
  districtData: DistrictFeatureCollection | null;
  satelliteData?: SatellitePatchFeatureCollection | null;
  satelliteImageBounds?: SatelliteImageBounds[];
  satelliteSummary?: SatelliteAnalysisSummary | null;
  weatherData?: WeatherFeatureCollection | null;
  showDistricts?: boolean;
  showWeather?: boolean;
  showSatellite?: boolean;
  weatherOpacity?: number;
  resizeKey?: string;
};

export default function MapView({
  districtData,
  satelliteData = null,
  satelliteImageBounds = [],
  satelliteSummary = null,
  weatherData = null,
  showDistricts = true,
  showWeather = false,
  showSatellite = false,
  weatherOpacity = 0.52,
  resizeKey = "",
}: MapViewProps) {
  return (
    <MapContainer
      center={[51.95, 109.2]}
      zoom={9}
      minZoom={6}
      className="map-view"
      scrollWheelZoom
    >
      {showSatellite ? (
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      <MapResizeHandler resizeKey={resizeKey} />
      <SatelliteFitBounds summary={showSatellite ? satelliteSummary : null} />
      {showDistricts && (
        <DistrictBoundaryLayer
          data={districtData}
          fill={!satelliteData?.features.length}
          interactive={!satelliteData?.features.length}
        />
      )}
      {showSatellite && (
        <SatelliteLayer
          data={satelliteData}
          imageBoundsList={satelliteImageBounds}
          summary={satelliteSummary}
        />
      )}
      {showWeather && <WeatherLayer data={weatherData} opacity={weatherOpacity} />}
    </MapContainer>
  );
}

function MapResizeHandler({ resizeKey }: { resizeKey: string }) {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => map.invalidateSize();
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(resizeMap);

    resizeObserver.observe(container);
    window.setTimeout(resizeMap, 0);
    window.setTimeout(resizeMap, 180);

    return () => resizeObserver.disconnect();
  }, [map, resizeKey]);

  return null;
}

function SatelliteFitBounds({ summary }: { summary: SatelliteAnalysisSummary | null }) {
  const map = useMap();

  useEffect(() => {
    if (!summary) {
      return;
    }

    const { image_bounds: bounds } = summary;
    map.fitBounds(
      [
        [bounds.bottom, bounds.left],
        [bounds.top, bounds.right],
      ],
      {
        maxZoom: 13,
        padding: [24, 24],
      },
    );
  }, [map, summary]);

  return null;
}
