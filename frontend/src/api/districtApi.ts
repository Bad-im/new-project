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

export async function getDistricts(): Promise<District[]> {
  const response = await fetch(`${API_BASE_URL}/districts`);

  if (!response.ok) {
    throw new Error("Не удалось получить список районов");
  }

  return response.json();
}

export async function getDistrictsGeoJson(): Promise<DistrictFeatureCollection> {
  const response = await fetch(`${API_BASE_URL}/districts/geojson`);

  if (!response.ok) {
    throw new Error("Не удалось получить GeoJSON районов");
  }

  return response.json();
}
