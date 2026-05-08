import type { Feature, FeatureCollection, Polygon } from "geojson";

export type WeatherDistrict = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type WeatherHazardClass = "I" | "II" | "III" | "IV" | "V";

export type NesterovForecastDay = {
  date: string;
  temperature_c: number;
  dew_point_c: number;
  precipitation_mm: number;
  nesterov_index: number;
  weather_hazard_class: WeatherHazardClass;
  hazard_name: string;
  color: string;
};

export type DistrictWeatherForecast = {
  district_id: string;
  district_name: string;
  latitude: number;
  longitude: number;
  source: string;
  forecast_days: number;
  warning: string | null;
  daily: NesterovForecastDay[];
};

export type WeatherForecastResponse = {
  source: string;
  forecast_days: number;
  districts: DistrictWeatherForecast[];
};

export type WeatherFeatureProperties = {
  district_id?: string;
  district_name?: string;
  date?: string;
  temperature_c?: number;
  dew_point_c?: number;
  precipitation_mm?: number;
  nesterov_index?: number;
  weather_hazard_class?: WeatherHazardClass;
  hazard_name?: string;
  color?: string;
  source?: string;
};

export type WeatherFeature = Feature<Polygon, WeatherFeatureProperties>;
export type WeatherFeatureCollection = FeatureCollection<Polygon, WeatherFeatureProperties>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function getWeatherDistricts(): Promise<WeatherDistrict[]> {
  const response = await fetch(`${API_BASE_URL}/weather/districts`);

  if (!response.ok) {
    throw new Error("Не удалось получить список районов");
  }

  return response.json();
}

export async function getWeatherForecastAll(): Promise<WeatherForecastResponse> {
  const response = await fetch(`${API_BASE_URL}/weather/forecast/all`);

  if (!response.ok) {
    throw new Error("Не удалось получить метеопрогноз");
  }

  return response.json();
}

export async function getWeatherForecastGeoJson(): Promise<WeatherFeatureCollection> {
  const response = await fetch(`${API_BASE_URL}/weather/forecast/geojson`);

  if (!response.ok) {
    throw new Error("Не удалось получить GeoJSON метеопрогноза");
  }

  return response.json();
}
