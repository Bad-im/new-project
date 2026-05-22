import { useEffect, useMemo, useState } from "react";
import LayerSwitcher, { MapMode } from "../components/LayerSwitcher";
import MapView from "../components/MapView";
import {
  satelliteClassItems,
} from "../components/SatelliteLayer";
import SatelliteSummaryPanel from "../components/SatelliteSummaryPanel";
import WeatherForecastPanel from "../components/WeatherForecastPanel";
import WeatherLegend from "../components/WeatherLegend";
import WeatherStats from "../components/WeatherStats";
import {
  DistrictFeatureCollection,
  getDistrictsGeoJson,
} from "../api/districtApi";
import {
  SatelliteAnalysisDetailResponse,
  SatelliteAnalysisListItem,
  SatelliteAnalysisSuccessResponse,
  SatelliteAnalysisSummary,
  SatelliteImageBounds,
  SatellitePatchClass,
  SatellitePatchFeatureCollection,
  getSatelliteAnalyses,
  getSatelliteAnalysisDetail,
} from "../api/satelliteApi";
import {
  WeatherDistrict,
  WeatherGeoJsonResponse,
  clearWeatherCache,
  getWeatherForecastGeoJson,
} from "../api/weatherApi";

type MapPageProps = {
  satelliteAnalysis: SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null;
  onSatelliteAnalysis: (
    analysis: SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null,
  ) => void;
};

type SatelliteViewMode = "single" | "all";

const allSatelliteClasses: SatellitePatchClass[] = [1, 2, 3, 4, 5];

function isDetailAnalysis(
  analysis: SatelliteAnalysisSuccessResponse | SatelliteAnalysisDetailResponse | null,
): analysis is SatelliteAnalysisDetailResponse {
  return Boolean(analysis && "metadata" in analysis);
}

function formatDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

function mergeBounds(boundsList: SatelliteImageBounds[]): SatelliteImageBounds {
  return {
    left: Math.min(...boundsList.map((bounds) => bounds.left)),
    bottom: Math.min(...boundsList.map((bounds) => bounds.bottom)),
    right: Math.max(...boundsList.map((bounds) => bounds.right)),
    top: Math.max(...boundsList.map((bounds) => bounds.top)),
  };
}

function emptySummary(imageBounds?: SatelliteImageBounds): SatelliteAnalysisSummary {
  return {
    total_patches: 0,
    processed_patches: 0,
    skipped_patches: 0,
    class_counts: Object.fromEntries(allSatelliteClasses.map((classId) => [String(classId), 0])),
    class_percentages: Object.fromEntries(allSatelliteClasses.map((classId) => [String(classId), 0])),
    dominant_class: null,
    max_class: null,
    image_bounds: imageBounds ?? { left: 0, bottom: 0, right: 0, top: 0 },
    district_detection: "not_implemented",
  };
}

function aggregateSummary(
  analyses: SatelliteAnalysisDetailResponse[],
  enabledClasses: SatellitePatchClass[],
): SatelliteAnalysisSummary | null {
  if (analyses.length === 0) {
    return null;
  }

  const classCounts = Object.fromEntries(allSatelliteClasses.map((classId) => [String(classId), 0]));
  let processedPatches = 0;

  analyses.forEach((analysis) => {
    analysis.geojson.features.forEach((feature) => {
      const predictedClass = feature.properties.predicted_class;
      if (enabledClasses.includes(predictedClass)) {
        classCounts[String(predictedClass)] += 1;
        processedPatches += 1;
      }
    });
  });

  const totalPatches = analyses.reduce((sum, analysis) => sum + analysis.summary.total_patches, 0);
  const skippedPatches = analyses.reduce((sum, analysis) => sum + analysis.summary.skipped_patches, 0);
  const classPercentages = Object.fromEntries(
    allSatelliteClasses.map((classId) => {
      const count = classCounts[String(classId)];
      return [String(classId), processedPatches ? Math.round((count / processedPatches) * 10000) / 100 : 0];
    }),
  );
  const visibleClassCounts = Object.entries(classCounts).filter(([, count]) => count > 0);
  const dominantClass = visibleClassCounts.length
    ? Number(visibleClassCounts.sort((first, second) => second[1] - first[1])[0][0]) as SatellitePatchClass
    : null;
  const maxClass = visibleClassCounts.length
    ? Math.max(...visibleClassCounts.map(([classId]) => Number(classId))) as SatellitePatchClass
    : null;
  const boundsList = analyses.map((analysis) => analysis.summary.image_bounds);

  return {
    analysis_count: analyses.length,
    total_patches: totalPatches,
    processed_patches: processedPatches,
    skipped_patches: skippedPatches,
    class_counts: classCounts,
    class_percentages: classPercentages,
    dominant_class: dominantClass,
    max_class: maxClass,
    image_bounds: mergeBounds(boundsList),
    district_detection: "not_implemented",
  };
}

function buildSatelliteGeoJson(
  analyses: SatelliteAnalysisDetailResponse[],
  enabledClasses: SatellitePatchClass[],
): SatellitePatchFeatureCollection | null {
  const features = analyses.flatMap((analysis) =>
    analysis.geojson.features
      .filter((feature) => enabledClasses.includes(feature.properties.predicted_class))
      .map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          analysis_id: analysis.analysis_id,
          original_filename: analysis.metadata.original_filename,
          created_at: formatDate(analysis.metadata.created_at),
          image_date: analysis.metadata.image_date,
        },
      })),
  );

  return {
    type: "FeatureCollection",
    features,
  };
}

export default function MapPage({ satelliteAnalysis, onSatelliteAnalysis }: MapPageProps) {
  const initialParams = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<MapMode>(
    initialParams.get("mode") === "satellite" || initialParams.get("analysisId")
      ? "satellite"
      : "weather",
  );
  const [satelliteViewMode, setSatelliteViewMode] = useState<SatelliteViewMode>(
    initialParams.get("view") === "all" ? "all" : "single",
  );
  const [enabledSatelliteClasses, setEnabledSatelliteClasses] =
    useState<SatellitePatchClass[]>(allSatelliteClasses);
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
  const [satelliteAnalyses, setSatelliteAnalyses] = useState<SatelliteAnalysisListItem[]>([]);
  const [allSatelliteDetails, setAllSatelliteDetails] = useState<SatelliteAnalysisDetailResponse[]>([]);
  const [selectedSatelliteAnalysisId, setSelectedSatelliteAnalysisId] = useState(
    initialParams.get("analysisId") ?? "",
  );
  const [isSatelliteListLoading, setIsSatelliteListLoading] = useState(false);
  const [isAllSatelliteLoading, setIsAllSatelliteLoading] = useState(false);
  const [satelliteError, setSatelliteError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getDistrictsGeoJson()
      .then((geoJson) => {
        if (isMounted) {
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

  const loadSatelliteAnalyses = async () => {
    setIsSatelliteListLoading(true);
    setSatelliteError("");

    try {
      const analyses = await getSatelliteAnalyses();
      setSatelliteAnalyses(analyses);
      if (!selectedSatelliteAnalysisId && analyses[0]) {
        setSelectedSatelliteAnalysisId(analyses[0].analysis_id);
      }
    } catch (loadError) {
      setSatelliteError(
        loadError instanceof Error ? loadError.message : "Не удалось получить список анализов",
      );
    } finally {
      setIsSatelliteListLoading(false);
    }
  };

  useEffect(() => {
    void loadWeather();
  }, []);

  useEffect(() => {
    if (mode === "satellite") {
      void loadSatelliteAnalyses();
    }
  }, [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get("mode");
    const queryView = params.get("view");
    const queryAnalysisId = params.get("analysisId");

    if (queryMode === "satellite" || queryAnalysisId) {
      setMode("satellite");
    }
    if (queryView === "all") {
      setSatelliteViewMode("all");
    }
    if (queryAnalysisId) {
      setSelectedSatelliteAnalysisId(queryAnalysisId);
    }

    if (!queryAnalysisId) {
      return;
    }

    if (isDetailAnalysis(satelliteAnalysis) && satelliteAnalysis.analysis_id === queryAnalysisId) {
      return;
    }

    let isMounted = true;
    setSatelliteError("");
    getSatelliteAnalysisDetail(queryAnalysisId)
      .then((analysis) => {
        if (isMounted) {
          onSatelliteAnalysis(analysis);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setSatelliteError(
            loadError instanceof Error ? loadError.message : "Не удалось открыть сохранённый анализ",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [onSatelliteAnalysis, satelliteAnalysis]);

  useEffect(() => {
    if (satelliteViewMode !== "all" || mode !== "satellite") {
      return;
    }

    let isMounted = true;
    setIsAllSatelliteLoading(true);
    setSatelliteError("");

    getSatelliteAnalyses()
      .then(async (analyses) => {
        if (isMounted) {
          setSatelliteAnalyses(analyses);
        }
        const details = await Promise.all(
          analyses.map((analysis) => getSatelliteAnalysisDetail(analysis.analysis_id)),
        );
        if (isMounted) {
          setAllSatelliteDetails(details);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setSatelliteError(
            loadError instanceof Error ? loadError.message : "Не удалось загрузить все снимки",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAllSatelliteLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mode, satelliteViewMode]);

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

  const singleAnalysis = useMemo(() => {
    if (isDetailAnalysis(satelliteAnalysis)) {
      return satelliteAnalysis;
    }
    return null;
  }, [satelliteAnalysis]);

  const visibleAnalyses = satelliteViewMode === "all"
    ? allSatelliteDetails
    : singleAnalysis
      ? [singleAnalysis]
      : [];
  const satelliteData = useMemo(
    () => buildSatelliteGeoJson(visibleAnalyses, enabledSatelliteClasses),
    [enabledSatelliteClasses, visibleAnalyses],
  );
  const satelliteSummary = useMemo(() => {
    if (satelliteViewMode === "all") {
      return aggregateSummary(allSatelliteDetails, enabledSatelliteClasses);
    }
    if (!singleAnalysis) {
      return null;
    }
    const summary = aggregateSummary([singleAnalysis], enabledSatelliteClasses);
    return summary ?? emptySummary(singleAnalysis.summary.image_bounds);
  }, [allSatelliteDetails, enabledSatelliteClasses, satelliteViewMode, singleAnalysis]);
  const satelliteImageBounds = visibleAnalyses.map((analysis) => analysis.summary.image_bounds);

  const updateSatelliteUrl = (viewMode: SatelliteViewMode, analysisId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "satellite");
    url.searchParams.set("view", viewMode);
    if (viewMode === "single" && analysisId) {
      url.searchParams.set("analysisId", analysisId);
    } else {
      url.searchParams.delete("analysisId");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const openSavedAnalysis = async (analysisId: string) => {
    setSatelliteError("");
    setSelectedSatelliteAnalysisId(analysisId);
    setSatelliteViewMode("single");
    updateSatelliteUrl("single", analysisId);

    try {
      onSatelliteAnalysis(await getSatelliteAnalysisDetail(analysisId));
    } catch (loadError) {
      setSatelliteError(
        loadError instanceof Error ? loadError.message : "Не удалось открыть сохранённый анализ",
      );
    }
  };

  const toggleSatelliteClass = (classId: SatellitePatchClass) => {
    setEnabledSatelliteClasses((current) => {
      if (current.includes(classId)) {
        return current.length > 1 ? current.filter((item) => item !== classId) : current;
      }
      return [...current, classId].sort((first, second) => first - second) as SatellitePatchClass[];
    });
  };

  const handleModeChange = (nextMode: MapMode) => {
    setMode(nextMode);
    const url = new URL(window.location.href);
    if (nextMode === "satellite") {
      url.searchParams.set("mode", "satellite");
    } else {
      url.searchParams.delete("mode");
      url.searchParams.delete("view");
      url.searchParams.delete("analysisId");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const showDistricts = mode === "satellite";
  const showWeather = mode === "weather";
  const mapDescription =
    mode === "satellite"
      ? "Карта спутниковой оценки пожарной опасности лесных территорий на основе анализа многоканальных снимков Sentinel-2."
      : "Карта кратковременного метеопрогноза пожарной опасности на основе метеоданных.";

  return (
    <div className="map-workspace">
      <aside className="map-sidebar">
        <div className="map-sidebar-header">
          <p className="eyebrow">Картографический раздел</p>
          <h1>Карта пожароопасности</h1>
          <p className="page-note">{mapDescription}</p>
        </div>
        <LayerSwitcher mode={mode} onModeChange={handleModeChange} />
        {mode === "satellite" && (
          <>
            <section className="panel">
              <h2>Просмотр спутниковых анализов</h2>
              <div className="segmented-control">
                <button
                  className={satelliteViewMode === "single" ? "segment active" : "segment"}
                  type="button"
                  onClick={() => {
                    setSatelliteViewMode("single");
                    updateSatelliteUrl("single", selectedSatelliteAnalysisId);
                  }}
                >
                  Один снимок
                </button>
                <button
                  className={satelliteViewMode === "all" ? "segment active" : "segment"}
                  type="button"
                  onClick={() => {
                    setSatelliteViewMode("all");
                    updateSatelliteUrl("all");
                  }}
                >
                  Все снимки
                </button>
              </div>
              {satelliteViewMode === "single" && (
                <label className="field satellite-file-field">
                  <span>Сохранённый анализ</span>
                  <select
                    value={selectedSatelliteAnalysisId}
                    onChange={(event) => void openSavedAnalysis(event.target.value)}
                  >
                    <option value="">Выберите анализ</option>
                    {satelliteAnalyses.map((analysis) => (
                      <option key={analysis.analysis_id} value={analysis.analysis_id}>
                        {analysis.image_date || "без даты"} - {analysis.original_filename || analysis.analysis_id}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isSatelliteListLoading && <p className="inline-status">Загрузка списка анализов...</p>}
              {isAllSatelliteLoading && <p className="inline-status">Загрузка всех сохранённых снимков...</p>}
              {!isSatelliteListLoading && satelliteAnalyses.length === 0 && (
                <p className="inline-status warning">Сохранённых спутниковых анализов пока нет.</p>
              )}
              {satelliteError && <p className="error-message">{satelliteError}</p>}
            </section>
            <section className="panel">
              <h2>Фильтр уровней</h2>
              <div className="class-filter-list">
                {satelliteClassItems.map((item) => (
                  <label className="class-filter-item" key={item.classValue}>
                    <input
                      type="checkbox"
                      checked={enabledSatelliteClasses.includes(item.classValue)}
                      onChange={() => toggleSatelliteClass(item.classValue)}
                    />
                    <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                    <span>{item.className}</span>
                  </label>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>Район отображения</h2>
              <p className="inline-status">
                Район определяется по географическому положению загруженного GeoTIFF. Один снимок
                может пересекать несколько муниципальных районов.
              </p>
            </section>
            <SatelliteSummaryPanel
              summary={satelliteSummary}
              title={
                satelliteViewMode === "all"
                  ? "Сводка по всем сохранённым спутниковым анализам"
                  : "Summary спутникового анализа"
              }
            />
            {satelliteData?.features.length === 0 && (
              <p className="inline-status warning">Нет патчей для выбранных уровней пожароопасности.</p>
            )}
            <section className="panel">
              <h2>Интерпретация результата</h2>
              <p className="inline-status">
                “Преобладающий класс” показывает основной фон отображаемых патчей,
                “максимальный обнаруженный класс” подсвечивает наиболее опасный уровень.
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
          districtData={districtGeoJson}
          satelliteData={satelliteData}
          satelliteImageBounds={satelliteImageBounds}
          satelliteSummary={satelliteSummary}
          weatherData={selectedWeatherData}
          showDistricts={showDistricts}
          showWeather={showWeather}
          showSatellite={mode === "satellite"}
          weatherOpacity={0.56}
          resizeKey={`${mode}-${satelliteViewMode}-${enabledSatelliteClasses.join("-")}-${satelliteSummary?.processed_patches ?? 0}-${weatherDate}-${weatherDistrict}-${weatherHazardClass}`}
        />
      </section>
    </div>
  );
}
