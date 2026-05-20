import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

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
  history_days_requested: number;
  history_days_used: number;
  last_significant_rain_date: string | null;
  last_significant_rain_mm: number | null;
  dry_period_days: number;
  history_used: boolean;
  warning: string | null;
  daily: NesterovForecastDay[];
};

export type WeatherForecastResponse = {
  source: string;
  forecast_days: number;
  districts: DistrictWeatherForecast[];
  meta?: {
    cache_hits?: number;
    cache_misses?: number;
    history_used_count?: number;
    history_failed_count?: number;
  };
};

export type WeatherFeatureProperties = {
  district_id?: string;
  district_name?: string;
  latitude?: number;
  longitude?: number;
  date?: string;
  temperature_c?: number;
  dew_point_c?: number;
  precipitation_mm?: number;
  nesterov_index?: number;
  weather_hazard_class?: WeatherHazardClass;
  hazard_name?: string;
  color?: string;
  source?: string;
  warning?: string | null;
  weather_data_available?: boolean;
  daily?: NesterovForecastDay[];
  history_days_requested?: number;
  history_days_used?: number;
  last_significant_rain_date?: string | null;
  last_significant_rain_mm?: number | null;
  dry_period_days?: number;
  history_used?: boolean;
};

export type WeatherFeature = Feature<Polygon | MultiPolygon, WeatherFeatureProperties>;
export type WeatherFeatureCollection = FeatureCollection<Polygon | MultiPolygon, WeatherFeatureProperties>;
export type WeatherGeoJsonResponse = WeatherFeatureCollection & {
  warning?: string;
  unmatched_districts?: string[];
  meta?: {
    total_districts: number;
    forecasted_districts: number;
    features_count: number;
    open_meteo_count: number;
    fallback_count: number;
    unavailable_count: number;
    source: string;
    readable_source: string;
    warnings: string[];
    history_days_requested?: number;
    cache_hits?: number;
    cache_misses?: number;
    request_duration_ms?: number;
    history_used_count?: number;
    history_failed_count?: number;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

let weatherDistrictsPromise: Promise<WeatherDistrict[]> | null = null;
let weatherForecastAllPromise: Promise<WeatherForecastResponse> | null = null;
let weatherGeoJsonPromise: Promise<WeatherGeoJsonResponse> | null = null;

export async function getWeatherDistricts(): Promise<WeatherDistrict[]> {
  if (!weatherDistrictsPromise) {
    weatherDistrictsPromise = fetch(`${API_BASE_URL}/weather/districts`).then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось получить список районов");
      }

      return response.json();
    });
  }

  return weatherDistrictsPromise;
}

export async function getWeatherForecastAll(force = false): Promise<WeatherForecastResponse> {
  if (force) {
    weatherForecastAllPromise = null;
  }

  if (!weatherForecastAllPromise) {
    weatherForecastAllPromise = fetch(`${API_BASE_URL}/weather/forecast/all`).then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось получить метеопрогноз");
      }

      return response.json();
    });
  }

  return weatherForecastAllPromise;
}

export async function getWeatherForecastGeoJson(force = false): Promise<WeatherGeoJsonResponse> {
  if (force) {
    weatherGeoJsonPromise = null;
  }

  if (!weatherGeoJsonPromise) {
    weatherGeoJsonPromise = fetch(`${API_BASE_URL}/weather/forecast/geojson`).then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось получить GeoJSON метеопрогноза");
      }

      return response.json();
    });
  }

  return weatherGeoJsonPromise;
}

export async function clearWeatherCache(): Promise<void> {
  weatherForecastAllPromise = null;
  weatherGeoJsonPromise = null;

  const response = await fetch(`${API_BASE_URL}/weather/cache/clear`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Не удалось очистить кэш метеоданных");
  }
}
