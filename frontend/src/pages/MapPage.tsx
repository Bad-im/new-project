import { useEffect, useMemo, useState } from "react";
import FilterPanel, { MapFilters } from "../components/FilterPanel";
import HazardStats from "../components/HazardStats";
import LayerSwitcher, { MapMode } from "../components/LayerSwitcher";
import MapView from "../components/MapView";
import WeatherForecastPanel from "../components/WeatherForecastPanel";
import WeatherLegend from "../components/WeatherLegend";
import WeatherStats from "../components/WeatherStats";
import { getDistrictName } from "../components/DistrictBoundaryLayer";
import {
  District,
  DistrictFeatureCollection,
  getDistricts,
  getDistrictsGeoJson,
} from "../api/districtApi";
import {
  DistrictWeatherForecast,
  WeatherFeature,
  WeatherDistrict,
  WeatherFeatureCollection,
  WeatherForecastResponse,
  WeatherGeoJsonResponse,
  getWeatherDistricts,
  getWeatherForecastAll,
  getWeatherForecastGeoJson,
} from "../api/weatherApi";

const defaultFilters: MapFilters = {
  districtId: "all",
};

export default function MapPage() {
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [mode, setMode] = useState<MapMode>("weather");
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtGeoJson, setDistrictGeoJson] = useState<DistrictFeatureCollection | null>(null);
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(true);
  const [error, setError] = useState("");
  const [weatherDistricts, setWeatherDistricts] = useState<WeatherDistrict[]>([]);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecastResponse | null>(null);
  const [weatherGeoJson, setWeatherGeoJson] = useState<WeatherGeoJsonResponse | null>(null);
  const [weatherDate, setWeatherDate] = useState("");
  const [weatherDistrict, setWeatherDistrict] = useState("all");
  const [weatherHazardClass, setWeatherHazardClass] = useState("all");
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  useEffect(() => {
    let isMounted = true;

    Promise.all([getDistricts(), getDistrictsGeoJson()])
      .then(([districtList, geoJson]) => {
        if (isMounted) {
          setDistricts(districtList);
          setDistrictGeoJson(geoJson);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Не удалось загрузить границы районов");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsDistrictsLoading(false);
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
      const [districts, forecast] = await Promise.all([
        getWeatherDistricts(),
        getWeatherForecastAll(),
      ]);
      const geoJson = await getWeatherForecastGeoJson();
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

  const filteredDistrictData = useMemo(() => {
    if (!districtGeoJson) {
      return null;
    }

    const selectedDistrictName = districts.find((district) => district.id === filters.districtId)?.name;

    return {
      ...districtGeoJson,
      features: districtGeoJson.features.filter((feature) => {
        if (filters.districtId === "all") {
          return true;
        }

        return getDistrictName(feature.properties) === selectedDistrictName;
      }),
    };
  }, [districtGeoJson, districts, filters.districtId]);

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
    return weatherGeoJson?.meta?.warnings?.[0] ?? weatherGeoJson?.warning ?? warnings?.[0] ?? "";
  }, [weatherForecast, weatherGeoJson]);

  const weatherSource =
    weatherGeoJson?.meta?.readable_source ??
    weatherForecast?.source ??
    weatherGeoJson?.features[0]?.properties.source ??
    "Open-Meteo";
  const openMeteoCount = weatherGeoJson?.meta?.open_meteo_count ?? 0;
  const reserveCount =
    (weatherGeoJson?.meta?.mock_count ?? 0) + (weatherGeoJson?.meta?.unavailable_count ?? 0);
  const selectedHistoryInfo = useMemo(() => {
    const visibleForecasts =
      weatherDistrict === "all"
        ? weatherForecast?.districts ?? []
        : weatherForecast?.districts.filter((district) => district.district_id === weatherDistrict) ?? [];
    const selectedForecast = [...visibleForecasts].sort(
      (first, second) => second.dry_period_days - first.dry_period_days,
    )[0];

    return {
      isSummary: weatherDistrict === "all",
      historyDays:
        selectedForecast?.history_days_requested ??
        weatherGeoJson?.meta?.history_days_requested ??
        20,
      lastSignificantRainDate: selectedForecast?.last_significant_rain_date ?? "",
      lastSignificantRainMm: selectedForecast?.last_significant_rain_mm ?? null,
      dryPeriodDays: selectedForecast?.dry_period_days ?? null,
    };
  }, [weatherDistrict, weatherForecast, weatherGeoJson]);

  const selectedWeatherData = useMemo(() => {
    if (weatherForecast) {
      return buildWeatherGeoJsonFromForecast(
        weatherForecast.districts,
        weatherGeoJson,
        weatherDate,
        weatherDistrict,
        weatherHazardClass,
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
        const classMatches =
          weatherHazardClass === "all" ||
          feature.properties.weather_hazard_class === weatherHazardClass;
        return districtMatches && dateMatches && classMatches;
      }),
    };
  }, [weatherDate, weatherDistrict, weatherForecast, weatherGeoJson, weatherHazardClass]);

  const selectedWeatherDistrictName = useMemo(() => {
    if (weatherDistrict === "all") {
      return "Все районы";
    }

    return (
      weatherDistricts.find((district) => district.id === weatherDistrict)?.name ??
      selectedWeatherData?.features[0]?.properties.district_name ??
      "-"
    );
  }, [selectedWeatherData, weatherDistrict, weatherDistricts]);

  const selectedSatelliteDistrictName =
    filters.districtId === "all"
      ? "Все районы"
      : districts.find((district) => district.id === filters.districtId)?.name ?? "-";

  const showDistricts = mode === "satellite";
  const showWeather = mode === "weather";

  return (
    <div className="map-workspace">
      <aside className="map-sidebar">
        <div className="map-sidebar-header">
          <p className="eyebrow">Картографический раздел</p>
          <h1>Карта пожароопасности</h1>
          <p className="page-note">
            Единая карта спутниковой оценки и кратковременного метеопрогноза.
          </p>
        </div>
        <LayerSwitcher mode={mode} onModeChange={setMode} />
        {mode === "satellite" && (
          <>
            <FilterPanel filters={filters} districts={districts} onChange={setFilters} />
            <section className="panel">
              <h2>Информация о спутниковой оценке</h2>
              <p className="inline-status">
                Демонстрационный слой. Нейросетевая модель будет подключена после дообучения.
              </p>
            </section>
            <HazardStats
              displayedDistrictCount={filteredDistrictData?.features.length ?? 0}
              selectedDistrict={selectedSatelliteDistrictName}
            />
            <section className="panel">
              <h2>Уровни пожарной опасности</h2>
              <p className="inline-status">
                Слой спутниковой классификации не подключён. После дообучения модели на карте
                будут отображаться классы пожароопасности лесного покрова.
              </p>
            </section>
          </>
        )}
        {mode === "weather" && (
          <>
            <WeatherForecastPanel
              dateOptions={weatherDateOptions}
              selectedDate={weatherDate}
              selectedDistrict={weatherDistrict}
              selectedHazardClass={weatherHazardClass}
              districts={weatherDistricts}
              isLoading={isWeatherLoading}
              onDateChange={setWeatherDate}
              onDistrictChange={setWeatherDistrict}
              onHazardClassChange={setWeatherHazardClass}
              onRefresh={loadWeather}
            />
            <section className="panel">
              <h2>Источник данных</h2>
              <div className="source-box">
                <span>Поставщик</span>
                <strong>{weatherSource || "Open-Meteo"}</strong>
                <small>Получено из Open-Meteo: {openMeteoCount} районов</small>
                <small>Резервные данные: {reserveCount} районов</small>
                <small>Учтена история погоды: {selectedHistoryInfo.historyDays} дней</small>
                <small>
                  {selectedHistoryInfo.isSummary
                    ? "Последний значимый дождь (район с самым длинным сухим периодом): "
                    : "Последний значимый дождь: "}
                  {selectedHistoryInfo.lastSignificantRainDate
                    ? `${selectedHistoryInfo.lastSignificantRainDate}, ${selectedHistoryInfo.lastSignificantRainMm ?? 0} мм`
                    : "не найден в доступной истории"}
                </small>
                <small>Сухой период: {selectedHistoryInfo.dryPeriodDays ?? 0} дней</small>
              </div>
              {weatherWarning && <p className="inline-status warning">{weatherWarning}</p>}
            </section>
            <WeatherStats
              data={selectedWeatherData}
              selectedDate={weatherDate}
              selectedDistrict={selectedWeatherDistrictName}
            />
            <WeatherLegend />
          </>
        )}
        {isDistrictsLoading && <p className="inline-status">Загрузка границ районов...</p>}
        {error && <p className="error-message">{error}</p>}
        {weatherError && <p className="error-message">{weatherError}</p>}
      </aside>
      <section className="map-canvas" aria-label="Интерактивная карта">
        <MapView
          districtData={filteredDistrictData}
          weatherData={selectedWeatherData}
          showDistricts={showDistricts}
          showWeather={showWeather}
          showSatellite={mode === "satellite"}
          weatherOpacity={0.56}
          resizeKey={`${mode}-${filters.districtId}-${weatherDate}-${weatherDistrict}-${weatherHazardClass}`}
        />
      </section>
    </div>
  );
}

function buildWeatherGeoJsonFromForecast(
  forecasts: DistrictWeatherForecast[],
  boundariesGeoJson: WeatherGeoJsonResponse | null,
  selectedDate: string,
  selectedDistrict: string,
  selectedHazardClass: string,
): WeatherFeatureCollection {
  const boundaryFeatures = boundariesGeoJson?.features ?? [];
  const features: WeatherFeature[] = forecasts
    .filter((forecast) => selectedDistrict === "all" || forecast.district_id === selectedDistrict)
    .reduce<WeatherFeature[]>((acc, forecast) => {
      const selectedDay =
        forecast.daily.find((day) => day.date === selectedDate) ?? forecast.daily[0];
      const boundaryFeature = boundaryFeatures.find(
        (feature) =>
          feature.properties.district_id === forecast.district_id ||
          feature.properties.district_name === forecast.district_name,
      );

      if (!selectedDay || !boundaryFeature?.geometry) {
        return acc;
      }

      if (
        selectedHazardClass !== "all" &&
        selectedDay.weather_hazard_class !== selectedHazardClass
      ) {
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
          history_days_requested: forecast.history_days_requested,
          history_days_used: forecast.history_days_used,
          last_significant_rain_date: forecast.last_significant_rain_date,
          last_significant_rain_mm: forecast.last_significant_rain_mm,
          dry_period_days: forecast.dry_period_days,
          history_used: forecast.history_used,
        },
        geometry: boundaryFeature.geometry,
      });

      return acc;
    }, []);

  return {
    type: "FeatureCollection",
    features,
  };
}
