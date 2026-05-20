from typing import Literal

from pydantic import BaseModel


class WeatherDailyValue(BaseModel):
    date: str
    temperature_c: float
    dew_point_c: float
    precipitation_mm: float


class NesterovForecastDay(WeatherDailyValue):
    nesterov_index: float
    weather_hazard_class: Literal["I", "II", "III", "IV", "V"]
    hazard_name: str
    color: str


class DistrictWeatherForecast(BaseModel):
    district_id: str
    district_name: str
    latitude: float
    longitude: float
    source: str
    forecast_days: int
    history_days_requested: int
    history_days_used: int
    last_significant_rain_date: str | None = None
    last_significant_rain_mm: float | None = None
    dry_period_days: int
    history_used: bool
    warning: str | None = None
    daily: list[NesterovForecastDay]


class WeatherDistrict(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float


class WeatherForecastResponse(BaseModel):
    source: str
    forecast_days: int
    districts: list[DistrictWeatherForecast]
