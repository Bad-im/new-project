from __future__ import annotations

from datetime import date, datetime, timedelta

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
CACHE_TTL = timedelta(minutes=30)
_FORECAST_CACHE: dict[str, tuple[datetime, DistrictWeatherForecast]] = {}


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


def _get_cached_forecast(district: WeatherDistrict) -> DistrictWeatherForecast | None:
    cached = _FORECAST_CACHE.get(district.id)
    if not cached:
        return None

    cached_at, forecast = cached
    if datetime.now() - cached_at > CACHE_TTL:
        _FORECAST_CACHE.pop(district.id, None)
        return None

    return forecast


def _set_cached_forecast(district_id: str, forecast: DistrictWeatherForecast) -> None:
    _FORECAST_CACHE[district_id] = (datetime.now(), forecast)


def get_district_weather_forecast(district_id_or_name: str) -> DistrictWeatherForecast:
    district = _find_district(district_id_or_name)
    cached_forecast = _get_cached_forecast(district)
    if cached_forecast:
        return cached_forecast

    today = date.today()
    history_start_date = today - timedelta(days=HISTORY_DAYS)
    history_end_date = today - timedelta(days=1)

    raw_history = fetch_open_meteo_history(
        latitude=district.latitude,
        longitude=district.longitude,
        start_date=history_start_date,
        end_date=history_end_date,
    )
    raw_forecast = fetch_open_meteo_forecast(
        latitude=district.latitude,
        longitude=district.longitude,
        days=FORECAST_DAYS,
    )
    normalized_history = normalize_weather_response(raw_history)
    normalized_forecast = normalize_weather_response(raw_forecast)
    history_daily_values = calculate_daily_weather_values(normalized_history["hourly"])
    forecast_daily_values = calculate_daily_weather_values(normalized_forecast["hourly"])
    nesterov_result = calculate_nesterov_index_with_history(
        history_days=history_daily_values,
        forecast_days=forecast_daily_values,
    )

    source = "Open-Meteo"
    if normalized_history["source"] == "mock" or normalized_forecast["source"] == "mock":
        source = "mock"

    warnings = [
        warning
        for warning in (
            normalized_history.get("warning"),
            normalized_forecast.get("warning"),
            nesterov_result.get("warning"),
        )
        if warning
    ]

    forecast = DistrictWeatherForecast(
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
        history_used=True,
        warning="; ".join(warnings) if warnings else None,
        daily=nesterov_result["daily"],
    )
    _set_cached_forecast(district.id, forecast)
    return forecast


def get_all_districts_weather_forecast() -> WeatherForecastResponse:
    forecasts = [
        get_district_weather_forecast(district.id)
        for district in get_weather_districts()
    ]
    sources = {forecast.source for forecast in forecasts}
    source = get_source_summary(
        open_meteo_count=sum(1 for forecast in forecasts if forecast.source == "Open-Meteo"),
        mock_count=sum(1 for forecast in forecasts if forecast.source == "mock"),
        unavailable_count=sum(1 for forecast in forecasts if forecast.source == "unavailable"),
    )["source"]

    return WeatherForecastResponse(
        source=source,
        forecast_days=FORECAST_DAYS,
        districts=forecasts,
    )


def get_source_summary(open_meteo_count: int, mock_count: int, unavailable_count: int) -> dict[str, str]:
    active_sources = sum(1 for count in (open_meteo_count, mock_count, unavailable_count) if count > 0)

    if active_sources == 0:
        return {"source": "unavailable", "readable_source": "Источник недоступен"}
    if open_meteo_count > 0 and mock_count == 0 and unavailable_count == 0:
        return {"source": "Open-Meteo", "readable_source": "Open-Meteo"}
    if mock_count > 0 and open_meteo_count == 0 and unavailable_count == 0:
        return {"source": "mock", "readable_source": "Тестовые данные"}
    return {"source": "mixed", "readable_source": "Open-Meteo + резервные данные"}


def generate_weather_geojson(forecast_results: WeatherForecastResponse | list[DistrictWeatherForecast]) -> dict:
    forecasts = (
        forecast_results.districts
        if isinstance(forecast_results, WeatherForecastResponse)
        else forecast_results
    )
    features = []
    unmatched_districts = []
    source_counts = {
        "Open-Meteo": 0,
        "mock": 0,
        "unavailable": 0,
    }
    warnings = []

    for forecast in forecasts:
        if not forecast.daily:
            continue

        latest_day = forecast.daily[-1]
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
                    "mock_count": 0,
                    "unavailable_count": len(forecasts),
                    "source": "unavailable",
                    "readable_source": "Источник недоступен",
                    "warnings": [str(error)],
                    "history_days_requested": HISTORY_DAYS,
                },
            }

        if not boundary_feature:
            unmatched_districts.append(forecast.district_name)
            continue

        if forecast.source == "Open-Meteo":
            source_counts["Open-Meteo"] += 1
        elif forecast.source == "mock":
            source_counts["mock"] += 1
        elif forecast.source == "unavailable":
            source_counts["unavailable"] += 1

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "district_id": forecast.district_id,
                    "district_name": forecast.district_name,
                    "date": latest_day.date,
                    "temperature_c": latest_day.temperature_c,
                    "dew_point_c": latest_day.dew_point_c,
                    "precipitation_mm": latest_day.precipitation_mm,
                    "nesterov_index": latest_day.nesterov_index,
                    "weather_hazard_class": latest_day.weather_hazard_class,
                    "hazard_name": latest_day.hazard_name,
                    "color": latest_day.color,
                    "source": forecast.source,
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
        mock_count=source_counts["mock"],
        unavailable_count=source_counts["unavailable"],
    )
    if unmatched_districts:
        warnings.append("Для части районов не найдены полигоны границ.")
    if source_counts["mock"] > 0:
        warnings.append(
            "Для части районов использованы резервные данные из-за недоступности погодного API."
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
            "mock_count": source_counts["mock"],
            "unavailable_count": source_counts["unavailable"],
            "source": source_summary["source"],
            "readable_source": source_summary["readable_source"],
            "warnings": sorted(set(warnings)),
            "history_days_requested": HISTORY_DAYS,
        },
    }
    if unmatched_districts:
        geojson["warning"] = "Для части районов не найдены полигоны границ."

    return geojson
