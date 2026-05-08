from __future__ import annotations

from app.schemas.weather import DistrictWeatherForecast, WeatherDistrict, WeatherForecastResponse
from app.services.nesterov_service import calculate_daily_weather_values, calculate_nesterov_index
from app.services.weather_provider import fetch_open_meteo_forecast, normalize_weather_response

FORECAST_DAYS = 3

DISTRICTS: list[WeatherDistrict] = [
    WeatherDistrict(
        id="tarbagatay",
        name="Тарбагатайский район",
        latitude=51.48,
        longitude=107.36,
    ),
    WeatherDistrict(
        id="barguzinsky",
        name="Баргузинский район",
        latitude=53.62,
        longitude=109.63,
    ),
    WeatherDistrict(
        id="kabansky",
        name="Кабанский район",
        latitude=52.05,
        longitude=106.65,
    ),
    WeatherDistrict(
        id="ivolginsky",
        name="Иволгинский район",
        latitude=51.74,
        longitude=107.28,
    ),
    WeatherDistrict(
        id="zaigraevsky",
        name="Заиграевский район",
        latitude=51.83,
        longitude=108.27,
    ),
]


def get_weather_districts() -> list[WeatherDistrict]:
    return DISTRICTS


def _find_district(district: str) -> WeatherDistrict:
    normalized_district = district.strip().lower()
    for item in DISTRICTS:
        if item.id.lower() == normalized_district or item.name.lower() == normalized_district:
            return item

    raise ValueError(f"Район не найден: {district}")


def get_district_weather_forecast(district_id_or_name: str) -> DistrictWeatherForecast:
    district = _find_district(district_id_or_name)
    raw_forecast = fetch_open_meteo_forecast(
        latitude=district.latitude,
        longitude=district.longitude,
        days=FORECAST_DAYS,
    )
    normalized_forecast = normalize_weather_response(raw_forecast)
    daily_values = calculate_daily_weather_values(normalized_forecast["hourly"])
    nesterov_days, calculation_warning = calculate_nesterov_index(daily_values)

    warnings = [
        warning
        for warning in (normalized_forecast.get("warning"), calculation_warning)
        if warning
    ]

    return DistrictWeatherForecast(
        district_id=district.id,
        district_name=district.name,
        latitude=district.latitude,
        longitude=district.longitude,
        source=normalized_forecast["source"],
        forecast_days=len(nesterov_days),
        warning="; ".join(warnings) if warnings else None,
        daily=nesterov_days,
    )


def get_all_districts_weather_forecast() -> WeatherForecastResponse:
    forecasts = [
        get_district_weather_forecast(district.id)
        for district in DISTRICTS
    ]
    source = "Open-Meteo"
    if any(forecast.source == "mock" for forecast in forecasts):
        source = "mock"

    return WeatherForecastResponse(
        source=source,
        forecast_days=FORECAST_DAYS,
        districts=forecasts,
    )


def _build_square(longitude: float, latitude: float, size: float = 0.16) -> list[list[list[float]]]:
    return [
        [
            [longitude - size, latitude - size],
            [longitude + size, latitude - size],
            [longitude + size, latitude + size],
            [longitude - size, latitude + size],
            [longitude - size, latitude - size],
        ]
    ]


def generate_weather_geojson(forecast_results: WeatherForecastResponse | list[DistrictWeatherForecast]) -> dict:
    forecasts = (
        forecast_results.districts
        if isinstance(forecast_results, WeatherForecastResponse)
        else forecast_results
    )
    features = []

    for forecast in forecasts:
        if not forecast.daily:
            continue

        latest_day = forecast.daily[-1]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "district_id": forecast.district_id,
                    "district_name": forecast.district_name,
                    "date": latest_day.date,
                    "nesterov_index": latest_day.nesterov_index,
                    "weather_hazard_class": latest_day.weather_hazard_class,
                    "hazard_name": latest_day.hazard_name,
                    "color": latest_day.color,
                    "source": forecast.source,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": _build_square(
                        longitude=forecast.longitude,
                        latitude=forecast.latitude,
                    ),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }
