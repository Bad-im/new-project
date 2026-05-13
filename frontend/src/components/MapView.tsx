import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import DistrictBoundaryLayer from "./DistrictBoundaryLayer";
import WeatherLayer from "./WeatherLayer";
import { DistrictFeatureCollection } from "../api/districtApi";
import { WeatherFeatureCollection } from "../api/weatherApi";

type MapViewProps = {
  districtData: DistrictFeatureCollection | null;
  weatherData?: WeatherFeatureCollection | null;
  showDistricts?: boolean;
  showWeather?: boolean;
  showSatellite?: boolean;
  weatherOpacity?: number;
  resizeKey?: string;
};

export default function MapView({
  districtData,
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
      {showDistricts && <DistrictBoundaryLayer data={districtData} />}
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
