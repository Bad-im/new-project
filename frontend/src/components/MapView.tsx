import { MapContainer, TileLayer } from "react-leaflet";
import HazardLayer from "./HazardLayer";
import { HazardFeatureCollection } from "../api/predictionApi";

type MapViewProps = {
  hazardData: HazardFeatureCollection | null;
  showHazards?: boolean;
  showDistricts?: boolean;
  showSatellite?: boolean;
};

export default function MapView({
  hazardData,
  showHazards = true,
  showDistricts = false,
  showSatellite = false,
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
      {showDistricts && hazardData && (
        <HazardLayer data={hazardData} variant="boundary" />
      )}
      {showHazards && <HazardLayer data={hazardData} />}
    </MapContainer>
  );
}
