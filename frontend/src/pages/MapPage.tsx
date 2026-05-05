import { useEffect, useMemo, useState } from "react";
import FilterPanel, { MapFilters } from "../components/FilterPanel";
import HazardLegend from "../components/HazardLegend";
import HazardStats from "../components/HazardStats";
import MapView from "../components/MapView";
import { HazardFeatureCollection, runPrediction } from "../api/predictionApi";

const defaultFilters: MapFilters = {
  district: "Все районы",
  hazardClass: "all",
  showHazards: true,
  showDistricts: false,
  showSatellite: false,
};

export default function MapPage() {
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [hazardData, setHazardData] = useState<HazardFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    runPrediction()
      .then((data) => {
        if (isMounted) {
          setHazardData(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Не удалось загрузить тестовый GeoJSON-слой");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredData = useMemo(() => {
    if (!hazardData) {
      return null;
    }

    return {
      ...hazardData,
      features: hazardData.features.filter((feature) => {
        const districtMatches =
          filters.district === "Все районы" || feature.properties.district === filters.district;
        const classMatches =
          filters.hazardClass === "all" ||
          String(feature.properties.hazard_class) === filters.hazardClass;
        return districtMatches && classMatches;
      }),
    };
  }, [filters.district, filters.hazardClass, hazardData]);

  return (
    <div className="map-workspace">
      <aside className="map-sidebar">
        <div>
          <p className="eyebrow">Картографический раздел</p>
          <h1>Карта пожароопасности</h1>
          <p className="page-note">Просмотр тестовых зон классификации лесного покрова.</p>
        </div>
        <FilterPanel filters={filters} onChange={setFilters} />
        <HazardLegend />
        <HazardStats data={filteredData} selectedDistrict={filters.district} />
        {isLoading && <p className="inline-status">Загрузка слоя карты...</p>}
        {error && <p className="error-message">{error}</p>}
      </aside>
      <section className="map-canvas" aria-label="Интерактивная карта">
        <MapView
          hazardData={filteredData}
          showHazards={filters.showHazards}
          showDistricts={filters.showDistricts}
          showSatellite={filters.showSatellite}
        />
      </section>
    </div>
  );
}
