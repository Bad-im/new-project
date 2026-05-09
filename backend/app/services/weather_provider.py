from __future__ import annotations

import logging
from datetime import datetime, timedelta

import requests

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_HOURLY_VARIABLES = "temperature_2m,dew_point_2m,precipitation"
OPEN_METEO_TIMEOUT_SECONDS = 15
OPEN_METEO_RETRY_COUNT = 1

logger = logging.getLogger(__name__)


def _build_mock_response(latitude: float, longitude: float, days: int, warning: str) -> dict:
    start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    times: list[str] = []
    temperature: list[float] = []
    dew_point: list[float] = []
    precipitation: list[float] = []

    for day_index in range(days):
        for hour in range(24):
            current_time = start + timedelta(days=day_index, hours=hour)
            daytime_factor = max(0, 1 - abs(12 - hour) / 12)
            times.append(current_time.strftime("%Y-%m-%dT%H:%M"))
            temperature.append(round(11 + day_index * 2 + daytime_factor * 11, 1))
            dew_point.append(round(4 + day_index + daytime_factor * 4, 1))
            precipitation.append(0.0 if day_index != 1 else (0.3 if hour in (3, 4, 5) else 0.0))

    return {
        "source": "mock",
        "warning": warning,
        "latitude": latitude,
        "longitude": longitude,
        "hourly": {
            "time": times,
            "temperature_2m": temperature,
            "dew_point_2m": dew_point,
            "precipitation": precipitation,
        },
    }


def _build_open_meteo_params(latitude: float, longitude: float, days: int = 3) -> dict:
    return {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": OPEN_METEO_HOURLY_VARIABLES,
        "forecast_days": days,
        "timezone": "Asia/Irkutsk",
    }


def _prepare_open_meteo_request(latitude: float, longitude: float, days: int = 3) -> requests.PreparedRequest:
    request = requests.Request(
        "GET",
        OPEN_METEO_FORECAST_URL,
        params=_build_open_meteo_params(latitude, longitude, days),
    )
    return request.prepare()


def _validate_open_meteo_payload(payload: dict) -> None:
    hourly = payload.get("hourly") or {}
    missing_variables = [
        variable
        for variable in ("temperature_2m", "dew_point_2m", "precipitation")
        if variable not in hourly
    ]

    if missing_variables:
        raise ValueError(
            "В ответе Open-Meteo отсутствуют переменные: "
            + ", ".join(missing_variables)
        )


def fetch_open_meteo_forecast(latitude: float, longitude: float, days: int = 3) -> dict:
    prepared_request = _prepare_open_meteo_request(latitude, longitude, days)
    request_url = prepared_request.url or OPEN_METEO_FORECAST_URL
    logger.info("Open-Meteo forecast request URL: %s", request_url)

    last_error: Exception | None = None
    for attempt in range(OPEN_METEO_RETRY_COUNT + 1):
        try:
            with requests.Session() as session:
                session.trust_env = False
                response = session.get(
                    OPEN_METEO_FORECAST_URL,
                    params=_build_open_meteo_params(latitude, longitude, days),
                    timeout=OPEN_METEO_TIMEOUT_SECONDS,
                )
            logger.info(
                "Open-Meteo response status: %s, attempt: %s",
                response.status_code,
                attempt + 1,
            )
            response.raise_for_status()

            payload = response.json()
            _validate_open_meteo_payload(payload)
            payload["source"] = "Open-Meteo"
            payload["warning"] = None
            payload["request_url"] = request_url
            return payload
        except (requests.RequestException, ValueError) as error:
            last_error = error
            logger.warning(
                "Open-Meteo request failed. URL: %s. Attempt: %s. Ошибка: %s",
                request_url,
                attempt + 1,
                error,
            )

    error_message = (
        "Open-Meteo недоступен или вернул некорректный ответ. "
        "Для района использованы резервные данные."
    )
    if last_error:
        logger.warning(
            "%s URL: %s. Ошибка: %s",
            error_message,
            request_url,
            last_error,
        )

    return _build_mock_response(
        latitude=latitude,
        longitude=longitude,
        days=days,
        warning=error_message,
    )


def debug_open_meteo_request(latitude: float, longitude: float, days: int = 3) -> dict:
    prepared_request = _prepare_open_meteo_request(latitude, longitude, days)
    request_url = prepared_request.url or OPEN_METEO_FORECAST_URL
    logger.info("Open-Meteo debug request URL: %s", request_url)

    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.get(
                OPEN_METEO_FORECAST_URL,
                params=_build_open_meteo_params(latitude, longitude, days),
                timeout=OPEN_METEO_TIMEOUT_SECONDS,
            )
        logger.info("Open-Meteo debug response status: %s", response.status_code)
        response.raise_for_status()
        payload = response.json()
        _validate_open_meteo_payload(payload)

        hourly = payload["hourly"]
        return {
            "success": True,
            "source": "Open-Meteo",
            "request_url": request_url,
            "error": None,
            "temperature_2m_first": hourly["temperature_2m"][0] if hourly["temperature_2m"] else None,
            "dew_point_2m_first": hourly["dew_point_2m"][0] if hourly["dew_point_2m"] else None,
            "precipitation_first": hourly["precipitation"][0] if hourly["precipitation"] else None,
        }
    except (requests.RequestException, ValueError) as error:
        logger.warning(
            "Open-Meteo debug request failed. URL: %s. Ошибка: %s",
            request_url,
            error,
        )
        return {
            "success": False,
            "source": "mock",
            "request_url": request_url,
            "error": (
                "Не удалось получить реальные данные Open-Meteo. "
                f"Детали: {error}"
            ),
            "temperature_2m_first": None,
            "dew_point_2m_first": None,
            "precipitation_first": None,
        }


def normalize_weather_response(raw_response: dict) -> dict:
    hourly = raw_response.get("hourly") or {}
    times = hourly.get("time") or []
    temperatures = hourly.get("temperature_2m") or []
    dew_points = hourly.get("dew_point_2m") or []
    precipitation = hourly.get("precipitation") or []

    normalized_hourly = []
    for index, time_value in enumerate(times):
        if index >= len(temperatures) or index >= len(dew_points) or index >= len(precipitation):
            continue

        normalized_hourly.append(
            {
                "time": time_value,
                "temperature_c": float(temperatures[index] or 0),
                "dew_point_c": float(dew_points[index] or 0),
                "precipitation_mm": float(precipitation[index] or 0),
            }
        )

    return {
        "source": raw_response.get("source", "Open-Meteo"),
        "warning": raw_response.get("warning"),
        "hourly": normalized_hourly,
    }
