import { useEffect, useMemo, useState } from "react";
import FilterPanel, { MapFilters } from "../components/FilterPanel";
import HazardLegend from "../components/HazardLegend";
import HazardStats from "../components/HazardStats";
import LayerSwitcher, { MapLayerState, MapMode } from "../components/LayerSwitcher";
import MapView from "../components/MapView";
import WeatherForecastPanel from "../components/WeatherForecastPanel";
import WeatherLegend from "../components/WeatherLegend";
import WeatherStats from "../components/WeatherStats";
import { HazardFeatureCollection, runPrediction } from "../api/predictionApi";
import {
  DistrictWeatherForecast,
  WeatherFeature,
  WeatherDistrict,
  WeatherFeatureCollection,
  WeatherForecastResponse,
  getWeatherDistricts,
  getWeatherForecastAll,
  getWeatherForecastGeoJson,
} from "../api/weatherApi";

const defaultFilters: MapFilters = {
  district: "Все районы",
  hazardClass: "all",
};

const defaultLayers: MapLayerState = {
  satelliteAssessment: true,
  weatherForecast: true,
  districtBorders: false,
  settlements: false,
  roads: false,
  hydrography: false,
};

export default function MapPage() {
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [mode, setMode] = useState<MapMode>("satellite");
  const [layers, setLayers] = useState<MapLayerState>(defaultLayers);
  const [hazardData, setHazardData] = useState<HazardFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [weatherDistricts, setWeatherDistricts] = useState<WeatherDistrict[]>([]);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecastResponse | null>(null);
  const [weatherGeoJson, setWeatherGeoJson] = useState<WeatherFeatureCollection | null>(null);
  const [weatherDate, setWeatherDate] = useState("");
  const [weatherDistrict, setWeatherDistrict] = useState("all");
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

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

  const loadWeather = async () => {
    setIsWeatherLoading(true);
    setWeatherError("");

    try {
      const [districts, forecast, geoJson] = await Promise.all([
        getWeatherDistricts(),
        getWeatherForecastAll(),
        getWeatherForecastGeoJson(),
      ]);
      setWeatherDistricts(districts);
      setWeatherForecast(forecast);
      setWeatherGeoJson(geoJson);

      if (!weatherDate) {
        setWeatherDate(forecast.districts[0]?.daily[0]?.date ?? "");
      }
    } catch {
      setWeatherError("Не удалось получить метеоданные");
    } finally {
      setIsWeatherLoading(false);
    }
  };

  useEffect(() => {
    void loadWeather();
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

  const weatherDateOptions = useMemo(() => {
    const firstForecast = weatherForecast?.districts[0];
    const labels = ["сегодня", "завтра", "послезавтра"];

    return (firstForecast?.daily ?? []).slice(0, 3).map((day, index) => ({
      value: day.date,
      label: `${labels[index] ?? day.date} (${day.date})`,
    }));
  }, [weatherForecast]);

  const weatherWarning = useMemo(() => {
    const warnings = weatherForecast?.districts
      .map((district) => district.warning)
      .filter(Boolean);
    return warnings?.[0] ?? "";
  }, [weatherForecast]);

  const weatherSource = weatherForecast?.source ?? weatherGeoJson?.features[0]?.properties.source ?? "Open-Meteo";

  const selectedWeatherData = useMemo(() => {
    if (weatherForecast) {
      return buildWeatherGeoJsonFromForecast(
        weatherForecast.districts,
        weatherDate,
        weatherDistrict,
      );
    }

    if (!weatherGeoJson) {
      return null;
    }

    return {
      ...weatherGeoJson,
      features: weatherGeoJson.features.filter((feature) => {
        const districtMatches =
          weatherDistrict === "all" || feature.properties.district_id === weatherDistrict;
        const dateMatches = !weatherDate || !feature.properties.date || feature.properties.date === weatherDate;
        return districtMatches && dateMatches;
      }),
    };
  }, [weatherDate, weatherDistrict, weatherForecast, weatherGeoJson]);

  const showHazards =
    layers.satelliteAssessment && (mode === "satellite" || mode === "combined");
  const showWeather = layers.weatherForecast && (mode === "weather" || mode === "combined");
  const showWeatherPanels = mode === "weather" || mode === "combined";
  const showHazardPanels = mode === "satellite" || mode === "combined";

  return (
    <div className="map-workspace">
      <aside className="map-sidebar">
        <div>
          <p className="eyebrow">Картографический раздел</p>
          <h1>Карта пожароопасности</h1>
          <p className="page-note">
            Единая карта спутниковой оценки и кратковременного метеопрогноза.
          </p>
        </div>
        <LayerSwitcher
          mode={mode}
          layers={layers}
          onModeChange={setMode}
          onLayerChange={setLayers}
        />
        {showHazardPanels && (
          <>
            <FilterPanel filters={filters} onChange={setFilters} />
            <HazardLegend />
            <HazardStats data={filteredData} selectedDistrict={filters.district} />
          </>
        )}
        {showWeatherPanels && (
          <>
            <WeatherForecastPanel
              dateOptions={weatherDateOptions}
              selectedDate={weatherDate}
              selectedDistrict={weatherDistrict}
              districts={weatherDistricts}
              isLoading={isWeatherLoading}
              source={weatherSource}
              warning={weatherWarning}
              usingMockData={weatherSource === "mock"}
              onDateChange={setWeatherDate}
              onDistrictChange={setWeatherDistrict}
              onRefresh={loadWeather}
            />
            <WeatherLegend />
            <WeatherStats
              data={selectedWeatherData}
              selectedDate={weatherDate}
              source={weatherSource}
            />
          </>
        )}
        {isLoading && <p className="inline-status">Загрузка слоя карты...</p>}
        {error && <p className="error-message">{error}</p>}
        {weatherError && <p className="error-message">{weatherError}</p>}
      </aside>
      <section className="map-canvas" aria-label="Интерактивная карта">
        <MapView
          hazardData={filteredData}
          weatherData={selectedWeatherData}
          showHazards={showHazards}
          showWeather={showWeather}
          showDistricts={layers.districtBorders}
          showSatellite={mode === "weather"}
          weatherOpacity={mode === "combined" ? 0.34 : 0.56}
        />
      </section>
    </div>
  );
}

function buildWeatherGeoJsonFromForecast(
  forecasts: DistrictWeatherForecast[],
  selectedDate: string,
  selectedDistrict: string,
): WeatherFeatureCollection {
  const features: WeatherFeature[] = forecasts
    .filter((forecast) => selectedDistrict === "all" || forecast.district_id === selectedDistrict)
    .reduce<WeatherFeature[]>((acc, forecast) => {
      const selectedDay =
        forecast.daily.find((day) => day.date === selectedDate) ?? forecast.daily[0];

      if (!selectedDay) {
        return acc;
      }

      acc.push({
        type: "Feature",
        properties: {
          district_id: forecast.district_id,
          district_name: forecast.district_name,
          date: selectedDay.date,
          temperature_c: selectedDay.temperature_c,
          dew_point_c: selectedDay.dew_point_c,
          precipitation_mm: selectedDay.precipitation_mm,
          nesterov_index: selectedDay.nesterov_index,
          weather_hazard_class: selectedDay.weather_hazard_class,
          hazard_name: selectedDay.hazard_name,
          color: selectedDay.color,
          source: forecast.source,
        },
        geometry: {
          type: "Polygon",
          coordinates: buildSquare(forecast.longitude, forecast.latitude),
        },
      });

      return acc;
    }, []);

  return {
    type: "FeatureCollection",
    features,
  };
}

function buildSquare(longitude: number, latitude: number, size = 0.16) {
  return [
    [
      [longitude - size, latitude - size],
      [longitude + size, latitude - size],
      [longitude + size, latitude + size],
      [longitude - size, latitude + size],
      [longitude - size, latitude - size],
    ],
  ];
}
