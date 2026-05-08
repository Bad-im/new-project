from __future__ import annotations

from datetime import datetime

from app.schemas.weather import NesterovForecastDay, WeatherDailyValue

RESET_PRECIPITATION_MM = 2.5
FORECAST_WARNING = (
    "Расчёт выполнен по доступному прогнозному периоду; для более точного КППО "
    "требуется история сухого периода"
)


def _parse_hour(time_value: str) -> datetime:
    return datetime.fromisoformat(time_value.replace("Z", "+00:00"))


def calculate_daily_weather_values(hourly_data: list[dict]) -> list[WeatherDailyValue]:
    grouped: dict[str, list[dict]] = {}
    for item in hourly_data:
        current_time = _parse_hour(item["time"])
        grouped.setdefault(current_time.date().isoformat(), []).append({**item, "_time": current_time})

    daily_values: list[WeatherDailyValue] = []
    for date_value, items in sorted(grouped.items()):
        noon_item = min(items, key=lambda item: abs(item["_time"].hour - 12))
        daily_values.append(
            WeatherDailyValue(
                date=date_value,
                temperature_c=round(float(noon_item["temperature_c"]), 1),
                dew_point_c=round(float(noon_item["dew_point_c"]), 1),
                precipitation_mm=round(
                    sum(float(item["precipitation_mm"]) for item in items),
                    1,
                ),
            )
        )

    return daily_values


def calculate_nesterov_index(
    days_data: list[WeatherDailyValue],
) -> tuple[list[NesterovForecastDay], str | None]:
    accumulated_index = 0.0
    forecast_days: list[NesterovForecastDay] = []

    for day in days_data:
        if day.precipitation_mm >= RESET_PRECIPITATION_MM:
            accumulated_index = 0.0
        else:
            dew_point_deficit = day.temperature_c - day.dew_point_c
            accumulated_index += max(day.temperature_c * dew_point_deficit, 0)

        hazard_class, hazard_name = classify_nesterov_index(accumulated_index)
        forecast_days.append(
            NesterovForecastDay(
                **day.model_dump(),
                nesterov_index=round(accumulated_index, 1),
                weather_hazard_class=hazard_class,
                hazard_name=hazard_name,
                color=get_hazard_color_by_weather_class(hazard_class),
            )
        )

    return forecast_days, FORECAST_WARNING


def classify_nesterov_index(kp_value: float) -> tuple[str, str]:
    if kp_value <= 300:
        return "I", "отсутствует"
    if kp_value <= 1000:
        return "II", "малая"
    if kp_value <= 4000:
        return "III", "средняя"
    if kp_value <= 10000:
        return "IV", "высокая"
    return "V", "чрезвычайная"


def get_hazard_color_by_weather_class(class_id: str) -> str:
    return {
        "I": "#2e7d32",
        "II": "#fdd835",
        "III": "#fb8c00",
        "IV": "#d32f2f",
        "V": "#7f0000",
    }.get(class_id, "#607d8b")
