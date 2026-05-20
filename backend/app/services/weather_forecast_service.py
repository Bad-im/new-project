from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Callable

from app.schemas.weather import DistrictWeatherForecast, WeatherDistrict, WeatherForecastResponse
from app.services.district_boundary_service import (
    DistrictBoundaryError,
    find_boundary_feature_by_district_id,
    get_districts_list,
)
from app.services.nesterov_service import (
    calculate_daily_weather_values,
    calculate_nesterov_index_with_history,
)
from app.services.weather_provider import (
    fetch_open_meteo_forecast,
    fetch_open_meteo_history,
    normalize_weather_response,
)

FORECAST_DAYS = 3
HISTORY_DAYS = 20
SUCCESS_CACHE_TTL = timedelta(minutes=30)
FALLBACK_CACHE_TTL = timedelta(minutes=5)
CACHE_TTL_SECONDS = int(SUCCESS_CACHE_TTL.total_seconds())
FALLBACK_CACHE_TTL_SECONDS = int(FALLBACK_CACHE_TTL.total_seconds())
MAX_WEATHER_WORKERS = 3
FALLBACK_WARNING = "Open-Meteo временно недоступен, использованы резервные данные"
logger = logging.getLogger(__name__)


@dataclass
class WeatherRequestStats:
    cache_hits: int = 0
    cache_misses: int = 0
    history_used_count: int = 0
    history_failed_count: int = 0


_WEATHER_CACHE: dict[str, tuple[datetime, timedelta, Any]] = {}
_CACHE_LOCK = threading.Lock()
_KEY_LOCKS: dict[str, threading.Lock] = {}
_CACHE_HITS = 0
_CACHE_MISSES = 0
_LAST_UPDATED: datetime | None = None


def get_weather_districts() -> list[WeatherDistrict]:
    return [
        WeatherDistrict(
            id=district["id"],
            name=district["name"],
            latitude=district["centroid_latitude"],
            longitude=district["centroid_longitude"],
        )
        for district in get_districts_list()
        if district["centroid_latitude"] is not None and district["centroid_longitude"] is not None
    ]


def _find_district(district: str) -> WeatherDistrict:
    normalized_district = district.strip().lower()
    for item in get_weather_districts():
        if item.id.lower() == normalized_district or item.name.lower() == normalized_district:
            return item

    raise ValueError(f"Район не найден: {district}")


def _cache_key(kind: str, *parts: object) -> str:
    normalized_parts = []
    for part in parts:
        if isinstance(part, float):
            normalized_parts.append(f"{part:.6f}")
        else:
            normalized_parts.append(str(part))
    return "|".join([kind, *normalized_parts])


def _record_cache_hit(stats: WeatherRequestStats | None) -> None:
    global _CACHE_HITS
    _CACHE_HITS += 1
    if stats:
        stats.cache_hits += 1


def _record_cache_miss(stats: WeatherRequestStats | None) -> None:
    global _CACHE_MISSES
    _CACHE_MISSES += 1
    if stats:
        stats.cache_misses += 1


def _get_key_lock(key: str) -> threading.Lock:
    with _CACHE_LOCK:
        lock = _KEY_LOCKS.get(key)
        if not lock:
            lock = threading.Lock()
            _KEY_LOCKS[key] = lock
        return lock


def _read_cache(key: str) -> Any | None:
    with _CACHE_LOCK:
        cached = _WEATHER_CACHE.get(key)
        if not cached:
            return None

        cached_at, ttl, value = cached
        if datetime.now() - cached_at > ttl:
            _WEATHER_CACHE.pop(key, None)
            return None

        return value


def _write_cache(key: str, value: Any, ttl: timedelta) -> None:
    global _LAST_UPDATED
    with _CACHE_LOCK:
        _WEATHER_CACHE[key] = (datetime.now(), ttl, value)
        _LAST_UPDATED = datetime.now()


def _get_or_set_cache(
    key: str,
    loader: Callable[[], Any],
    stats: WeatherRequestStats | None = None,
    ttl_for_value: Callable[[Any], timedelta] | None = None,
) -> Any:
    cached_value = _read_cache(key)
    if cached_value is not None:
        _record_cache_hit(stats)
        return cached_value

    key_lock = _get_key_lock(key)
    with key_lock:
        cached_value = _read_cache(key)
        if cached_value is not None:
            _record_cache_hit(stats)
            return cached_value

        _record_cache_miss(stats)
        value = loader()
        ttl = ttl_for_value(value) if ttl_for_value else SUCCESS_CACHE_TTL
        _write_cache(key, value, ttl)
        return value


def clear_weather_cache() -> dict[str, object]:
    global _CACHE_HITS, _CACHE_MISSES, _LAST_UPDATED
    with _CACHE_LOCK:
        _WEATHER_CACHE.clear()
        _KEY_LOCKS.clear()
        _CACHE_HITS = 0
        _CACHE_MISSES = 0
        _LAST_UPDATED = None
    return get_weather_cache_status()


def get_weather_cache_status() -> dict[str, object]:
    now = datetime.now()
    with _CACHE_LOCK:
        expired_keys = [
            key
            for key, (cached_at, ttl, _) in _WEATHER_CACHE.items()
            if now - cached_at > ttl
        ]
        for key in expired_keys:
            _WEATHER_CACHE.pop(key, None)

        districts_cached = sorted(
            {
                key.split("|")[1]
                for key in _WEATHER_CACHE
                if key.startswith("district_result|") and len(key.split("|")) > 1
            }
        )
        return {
            "cached_items": len(_WEATHER_CACHE),
            "ttl_seconds": CACHE_TTL_SECONDS,
            "fallback_ttl_seconds": FALLBACK_CACHE_TTL_SECONDS,
            "cache_hits": _CACHE_HITS,
            "cache_misses": _CACHE_MISSES,
            "fallback_cached_items": sum(
                1
                for key, (_, _, value) in _WEATHER_CACHE.items()
                if _is_fallback_cache_item(key, value)
            ),
            "districts_cached": districts_cached,
            "last_updated": _LAST_UPDATED.isoformat() if _LAST_UPDATED else None,
        }


def _is_fallback_cache_item(key: str, value: Any) -> bool:
    if isinstance(value, DistrictWeatherForecast):
        return value.source == "fallback"
    if isinstance(value, WeatherForecastResponse):
        return value.source in ("fallback", "mixed") and any(
            district.source == "fallback" for district in value.districts
        )
    if isinstance(value, dict):
        return value.get("source") == "fallback"
    return key.startswith("fallback|")


def _ttl_for_weather_payload(value: Any) -> timedelta:
    source = getattr(value, "source", None)
    if source is None and isinstance(value, dict):
        source = value.get("source")
    return FALLBACK_CACHE_TTL if source == "fallback" else SUCCESS_CACHE_TTL


def get_district_weather_forecast(
    district_id_or_name: str,
    stats: WeatherRequestStats | None = None,
) -> DistrictWeatherForecast:
    district = _find_district(district_id_or_name)
    today = date.today()
    history_start_date = today - timedelta(days=HISTORY_DAYS)
    history_end_date = today - timedelta(days=1)

    result_key = _cache_key(
        "district_result",
        district.id,
        district.latitude,
        district.longitude,
        FORECAST_DAYS,
        HISTORY_DAYS,
        today.isoformat(),
    )

    def load_result() -> DistrictWeatherForecast:
        history_key = _cache_key(
            "history",
            district.id,
            district.latitude,
            district.longitude,
            FORECAST_DAYS,
            HISTORY_DAYS,
            history_start_date.isoformat(),
            history_end_date.isoformat(),
        )
        forecast_key = _cache_key(
            "forecast",
            district.id,
            district.latitude,
            district.longitude,
            FORECAST_DAYS,
            HISTORY_DAYS,
            today.isoformat(),
        )

        raw_forecast = _get_or_set_cache(
            forecast_key,
            lambda: fetch_open_meteo_forecast(
                latitude=district.latitude,
                longitude=district.longitude,
                days=FORECAST_DAYS,
            ),
            stats,
            _ttl_for_weather_payload,
        )
        if raw_forecast.get("source") == "fallback":
            raw_history = {
                "source": "fallback",
                "warning": raw_forecast.get("warning"),
                "hourly": {"time": [], "temperature_2m": [], "dew_point_2m": [], "precipitation": []},
            }
        else:
            raw_history = _get_or_set_cache(
                history_key,
                lambda: fetch_open_meteo_history(
                    latitude=district.latitude,
                    longitude=district.longitude,
                    start_date=history_start_date,
                    end_date=history_end_date,
                ),
                stats,
                _ttl_for_weather_payload,
            )
        normalized_history = normalize_weather_response(raw_history)
        normalized_forecast = normalize_weather_response(raw_forecast)
        history_daily_values = calculate_daily_weather_values(normalized_history["hourly"])
        forecast_daily_values = calculate_daily_weather_values(normalized_forecast["hourly"])
        if not forecast_daily_values:
            return _build_fallback_forecast(district, FALLBACK_WARNING)

        nesterov_result = calculate_nesterov_index_with_history(
            history_days=history_daily_values,
            forecast_days=forecast_daily_values,
        )

        history_used = normalized_history["source"] != "fallback"
        source = "Open-Meteo"
        if normalized_history["source"] == "fallback" or normalized_forecast["source"] == "fallback":
            source = "fallback"

        warnings = [
            warning
            for warning in (
                normalized_history.get("warning"),
                normalized_forecast.get("warning"),
                nesterov_result.get("warning"),
            )
            if warning
        ]

        return DistrictWeatherForecast(
            district_id=district.id,
            district_name=district.name,
            latitude=district.latitude,
            longitude=district.longitude,
            source=source,
            forecast_days=len(nesterov_result["daily"]),
            history_days_requested=HISTORY_DAYS,
            history_days_used=nesterov_result["history_days_used"],
            last_significant_rain_date=nesterov_result["last_significant_rain_date"],
            last_significant_rain_mm=nesterov_result["last_significant_rain_mm"],
            dry_period_days=nesterov_result["dry_period_days"],
            history_used=history_used,
            warning="; ".join(warnings) if warnings else None,
            daily=nesterov_result["daily"],
        )

    try:
        forecast = _get_or_set_cache(result_key, load_result, stats, _ttl_for_weather_payload)
    except Exception as error:
        logger.warning(
            "Weather forecast calculation failed for district %s. Falling back. Error: %s",
            district.id,
            error,
        )
        forecast = _build_fallback_forecast(district, FALLBACK_WARNING)
        _write_cache(result_key, forecast, FALLBACK_CACHE_TTL)
    if forecast.history_used:
        if stats:
            stats.history_used_count += 1
    elif stats:
        stats.history_failed_count += 1
    return forecast


def _build_fallback_forecast(district: WeatherDistrict, warning: str) -> DistrictWeatherForecast:
    from app.services.weather_provider import _build_mock_response

    raw_forecast = _build_mock_response(
        latitude=district.latitude,
        longitude=district.longitude,
        days=FORECAST_DAYS,
        warning=warning,
    )
    raw_forecast["source"] = "fallback"
    normalized_forecast = normalize_weather_response(raw_forecast)
    forecast_daily_values = calculate_daily_weather_values(normalized_forecast["hourly"])
    nesterov_result = calculate_nesterov_index_with_history(
        history_days=[],
        forecast_days=forecast_daily_values,
    )

    return DistrictWeatherForecast(
        district_id=district.id,
        district_name=district.name,
        latitude=district.latitude,
        longitude=district.longitude,
        source="fallback",
        forecast_days=len(nesterov_result["daily"]),
        history_days_requested=HISTORY_DAYS,
        history_days_used=0,
        last_significant_rain_date=None,
        last_significant_rain_mm=None,
        dry_period_days=nesterov_result["dry_period_days"],
        history_used=False,
        warning=warning,
        daily=nesterov_result["daily"],
    )


def get_all_districts_weather_forecast(
    stats: WeatherRequestStats | None = None,
) -> WeatherForecastResponse:
    request_stats = stats or WeatherRequestStats()
    districts = get_weather_districts()
    with ThreadPoolExecutor(max_workers=min(MAX_WEATHER_WORKERS, max(len(districts), 1))) as executor:
        forecasts = list(
            executor.map(
                lambda district: get_district_weather_forecast(district.id, request_stats),
                districts,
            )
        )
    source = get_source_summary(
        open_meteo_count=sum(1 for forecast in forecasts if forecast.source == "Open-Meteo"),
        fallback_count=sum(1 for forecast in forecasts if forecast.source == "fallback"),
        unavailable_count=sum(1 for forecast in forecasts if forecast.source == "unavailable"),
    )["source"]

    return WeatherForecastResponse(
        source=source,
        forecast_days=FORECAST_DAYS,
        districts=forecasts,
        meta={
            "cache_hits": request_stats.cache_hits,
            "cache_misses": request_stats.cache_misses,
            "history_used_count": request_stats.history_used_count,
            "history_failed_count": request_stats.history_failed_count,
        },
    )


def get_source_summary(open_meteo_count: int, fallback_count: int, unavailable_count: int) -> dict[str, str]:
    active_sources = sum(1 for count in (open_meteo_count, fallback_count, unavailable_count) if count > 0)

    if active_sources == 0:
        return {"source": "unavailable", "readable_source": "Источник недоступен"}
    if open_meteo_count > 0 and fallback_count == 0 and unavailable_count == 0:
        return {"source": "Open-Meteo", "readable_source": "Open-Meteo"}
    if fallback_count > 0 and open_meteo_count == 0 and unavailable_count == 0:
        return {"source": "fallback", "readable_source": "Резервные данные"}
    return {"source": "mixed", "readable_source": "Open-Meteo + резервные данные"}


def generate_weather_geojson(
    forecast_results: WeatherForecastResponse | list[DistrictWeatherForecast],
    request_duration_ms: int | None = None,
) -> dict:
    forecasts = (
        forecast_results.districts
        if isinstance(forecast_results, WeatherForecastResponse)
        else forecast_results
    )
    request_meta = (
        forecast_results.meta
        if isinstance(forecast_results, WeatherForecastResponse) and forecast_results.meta
        else {}
    )
    features = []
    unmatched_districts = []
    source_counts = {
        "Open-Meteo": 0,
        "fallback": 0,
        "unavailable": 0,
    }
    warnings = []

    for forecast in forecasts:
        if not forecast.daily:
            continue

        selected_day = forecast.daily[0]
        try:
            boundary_feature = find_boundary_feature_by_district_id(forecast.district_id)
        except DistrictBoundaryError as error:
            return {
                "type": "FeatureCollection",
                "features": [],
                "warning": str(error),
                "unmatched_districts": [forecast.district_name for forecast in forecasts],
                "meta": {
                    "total_districts": len(forecasts),
                    "forecasted_districts": 0,
                    "features_count": 0,
                    "open_meteo_count": 0,
                    "fallback_count": len(forecasts),
                    "unavailable_count": len(forecasts),
                    "source": "fallback",
                    "readable_source": "Резервные данные",
                    "warnings": [str(error)],
                    "history_days_requested": HISTORY_DAYS,
                    "cache_hits": request_meta.get("cache_hits", 0),
                    "cache_misses": request_meta.get("cache_misses", 0),
                    "request_duration_ms": request_duration_ms,
                    "history_used_count": request_meta.get("history_used_count", 0),
                    "history_failed_count": request_meta.get("history_failed_count", 0),
                },
            }

        if not boundary_feature:
            unmatched_districts.append(forecast.district_name)
            continue

        if forecast.source == "Open-Meteo":
            source_counts["Open-Meteo"] += 1
        elif forecast.source == "fallback":
            source_counts["fallback"] += 1
        elif forecast.source == "unavailable":
            source_counts["unavailable"] += 1

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "district_id": forecast.district_id,
                    "district_name": forecast.district_name,
                    "latitude": forecast.latitude,
                    "longitude": forecast.longitude,
                    "date": selected_day.date,
                    "temperature_c": selected_day.temperature_c,
                    "dew_point_c": selected_day.dew_point_c,
                    "precipitation_mm": selected_day.precipitation_mm,
                    "nesterov_index": selected_day.nesterov_index,
                    "weather_hazard_class": selected_day.weather_hazard_class,
                    "hazard_name": selected_day.hazard_name,
                    "color": selected_day.color,
                    "source": forecast.source,
                    "warning": forecast.warning,
                    "weather_data_available": forecast.source == "Open-Meteo",
                    "daily": [day.model_dump() for day in forecast.daily],
                    "history_days_requested": forecast.history_days_requested,
                    "history_days_used": forecast.history_days_used,
                    "last_significant_rain_date": forecast.last_significant_rain_date,
                    "last_significant_rain_mm": forecast.last_significant_rain_mm,
                    "dry_period_days": forecast.dry_period_days,
                    "history_used": forecast.history_used,
                },
                "geometry": boundary_feature.get("geometry"),
            }
        )

    source_summary = get_source_summary(
        open_meteo_count=source_counts["Open-Meteo"],
        fallback_count=source_counts["fallback"],
        unavailable_count=source_counts["unavailable"],
    )
    if unmatched_districts:
        warnings.append("Для части районов не найдены полигоны границ.")
    if source_counts["fallback"] > 0:
        warnings.append(
            "Для части районов использованы резервные данные из-за недоступности Open-Meteo."
        )
    if source_counts["unavailable"] > 0:
        warnings.append("Для части районов источник погодных данных недоступен.")

    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "unmatched_districts": unmatched_districts,
        "meta": {
            "total_districts": len(forecasts),
            "forecasted_districts": len(forecasts),
            "features_count": len(features),
            "open_meteo_count": source_counts["Open-Meteo"],
            "fallback_count": source_counts["fallback"],
            "unavailable_count": source_counts["unavailable"],
            "source": source_summary["source"],
            "readable_source": source_summary["readable_source"],
            "warnings": sorted(set(warnings)),
            "history_days_requested": HISTORY_DAYS,
            "cache_hits": request_meta.get("cache_hits", 0),
            "cache_misses": request_meta.get("cache_misses", 0),
            "request_duration_ms": request_duration_ms,
            "history_used_count": request_meta.get("history_used_count", 0),
            "history_failed_count": request_meta.get("history_failed_count", 0),
        },
    }
    if unmatched_districts:
        geojson["warning"] = "Для части районов не найдены полигоны границ."

    return geojson
