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
  WeatherDistrict,
  WeatherGeoJsonResponse,
  clearWeatherCache,
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
  const [weatherGeoJson, setWeatherGeoJson] = useState<WeatherGeoJsonResponse | null>(null);
  const [weatherDate, setWeatherDate] = useState("");
  const [weatherDistrict, setWeatherDistrict] = useState("all");
  const [weatherHazardClass, setWeatherHazardClass] = useState("all");
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([getDistricts(), getDistrictsGeoJson()])
      .then(([districtListResult, geoJsonResult]) => {
        if (isMounted) {
          if (districtListResult.status === "fulfilled") {
            setDistricts(districtListResult.value);
          }

          if (geoJsonResult.status === "fulfilled") {
            setDistrictGeoJson(geoJsonResult.value);
          } else {
            setError("Не удалось загрузить границы районов");
          }
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

  const loadWeather = async (force = false) => {
    setIsWeatherLoading(true);
    setWeatherError("");

    try {
      if (force) {
        await clearWeatherCache();
      }
      const geoJson = await getWeatherForecastGeoJson(force);
      setWeatherDistricts(
        geoJson.features.map((feature) => ({
          id: feature.properties.district_id ?? feature.properties.district_name ?? "",
          name: feature.properties.district_name ?? "Район не указан",
          latitude: feature.properties.latitude ?? 0,
          longitude: feature.properties.longitude ?? 0,
        })),
      );
      setWeatherGeoJson(geoJson);

      if (!weatherDate) {
        setWeatherDate(
          geoJson.features[0]?.properties.daily?.[0]?.date ??
            geoJson.features[0]?.properties.date ??
            "",
        );
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
    const labels = ["сегодня", "завтра", "послезавтра"];
    const firstFeatureDaily = weatherGeoJson?.features[0]?.properties.daily ?? [];
    const dates = firstFeatureDaily.length > 0
      ? firstFeatureDaily.map((day) => day.date)
      : Array.from(
          new Set(
            (weatherGeoJson?.features ?? [])
              .map((feature) => feature.properties.date)
              .filter(Boolean),
          ),
        );

    return dates.slice(0, 3).map((date, index) => ({
      value: date ?? "",
      label: `${labels[index] ?? date} (${date})`,
    }));
  }, [weatherGeoJson]);

  const weatherWarning = useMemo(() => {
    if (weatherGeoJson?.meta?.warnings?.[0] || weatherGeoJson?.warning) {
      return weatherGeoJson.meta?.warnings?.[0] ?? weatherGeoJson.warning ?? "";
    }

    return weatherGeoJson?.features.find((feature) => feature.properties.warning)?.properties.warning ?? "";
  }, [weatherGeoJson]);

  const weatherSource =
    weatherGeoJson?.meta?.readable_source ??
    weatherGeoJson?.features[0]?.properties.source ??
    "Open-Meteo";
  const openMeteoCount = weatherGeoJson?.meta?.open_meteo_count ?? 0;
  const reserveCount =
    (weatherGeoJson?.meta?.fallback_count ?? 0) + (weatherGeoJson?.meta?.unavailable_count ?? 0);
  const selectedHistoryInfo = useMemo(() => {
    const visibleFeatures =
      weatherDistrict === "all"
        ? weatherGeoJson?.features ?? []
        : weatherGeoJson?.features.filter((feature) => feature.properties.district_id === weatherDistrict) ?? [];
    const selectedFeature = [...visibleFeatures].sort(
      (first, second) => (second.properties.dry_period_days ?? 0) - (first.properties.dry_period_days ?? 0),
    )[0];
    const properties = selectedFeature?.properties;

    return {
      isSummary: weatherDistrict === "all",
      historyDays:
        properties?.history_days_requested ??
        weatherGeoJson?.meta?.history_days_requested ??
        20,
      lastSignificantRainDate: properties?.last_significant_rain_date ?? "",
      lastSignificantRainMm: properties?.last_significant_rain_mm ?? null,
      dryPeriodDays: properties?.dry_period_days ?? null,
    };
  }, [weatherDistrict, weatherGeoJson]);

  const selectedWeatherData = useMemo(() => {
    if (!weatherGeoJson) {
      return null;
    }

    return {
      ...weatherGeoJson,
      features: weatherGeoJson.features
        .filter((feature) => {
          const selectedDay =
            feature.properties.daily?.find((day) => day.date === weatherDate) ??
            feature.properties.daily?.[0];
          const districtMatches =
            weatherDistrict === "all" || feature.properties.district_id === weatherDistrict;
          const dateMatches = !weatherDate || !selectedDay || selectedDay.date === weatherDate;
          const classMatches =
            weatherHazardClass === "all" ||
            (selectedDay?.weather_hazard_class ?? feature.properties.weather_hazard_class) === weatherHazardClass;
          return districtMatches && dateMatches && classMatches;
        })
        .map((feature) => {
          const selectedDay =
            feature.properties.daily?.find((day) => day.date === weatherDate) ??
            feature.properties.daily?.[0];

          if (!selectedDay) {
            return feature;
          }

          return {
            ...feature,
            properties: {
              ...feature.properties,
              date: selectedDay.date,
              temperature_c: selectedDay.temperature_c,
              dew_point_c: selectedDay.dew_point_c,
              precipitation_mm: selectedDay.precipitation_mm,
              nesterov_index: selectedDay.nesterov_index,
              weather_hazard_class: selectedDay.weather_hazard_class,
              hazard_name: selectedDay.hazard_name,
              color: selectedDay.color,
            },
          };
        }),
    };
  }, [weatherDate, weatherDistrict, weatherGeoJson, weatherHazardClass]);

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
              onRefresh={() => loadWeather(true)}
            />
            <section className="panel">
              <h2>Источник данных</h2>
              <div className="source-box">
                <span>Поставщик</span>
                <strong>{weatherSource || "Open-Meteo"}</strong>
                <small>Получено из Open-Meteo: {openMeteoCount} районов</small>
                <small>Резервные данные: {reserveCount} районов</small>
                <small>
                  Кэш: {weatherGeoJson?.meta?.cache_hits ?? 0} попаданий,
                  {" "}
                  {weatherGeoJson?.meta?.cache_misses ?? 0} новых расчётов
                </small>
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
