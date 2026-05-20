import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type District = {
  id: string;
  name: string;
  geometry_available: boolean;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
};

export type DistrictBoundaryProperties = {
  DISTRICT_NAME?: string;
  NAME?: string;
  NAME_RU?: string;
  name?: string;
};

export type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictBoundaryProperties>;
export type DistrictFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  DistrictBoundaryProperties
>;

let districtsPromise: Promise<District[]> | null = null;
let districtsGeoJsonPromise: Promise<DistrictFeatureCollection> | null = null;

export async function getDistricts(): Promise<District[]> {
  if (!districtsPromise) {
    districtsPromise = fetch(`${API_BASE_URL}/districts`).then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось получить список районов");
      }

      return response.json();
    });
  }

  return districtsPromise;
}

export async function getDistrictsGeoJson(): Promise<DistrictFeatureCollection> {
  if (!districtsGeoJsonPromise) {
    districtsGeoJsonPromise = fetch(`${API_BASE_URL}/districts/geojson`).then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось получить GeoJSON районов");
      }

      return response.json();
    });
  }

  return districtsGeoJsonPromise;
}
