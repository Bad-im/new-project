from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.schemas.weather import (
    DistrictWeatherForecast,
    WeatherDistrict,
    WeatherForecastResponse,
)
from app.services.weather_forecast_service import (
    generate_weather_geojson,
    get_all_districts_weather_forecast,
    get_district_weather_forecast,
    get_weather_districts,
)
from app.services.weather_provider import debug_open_meteo_request

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/districts", response_model=list[WeatherDistrict])
def list_weather_districts() -> list[WeatherDistrict]:
    return get_weather_districts()


@router.get("/forecast", response_model=DistrictWeatherForecast)
def get_weather_forecast(
    district: str = Query(..., description="ID или название района"),
) -> DistrictWeatherForecast:
    try:
        return get_district_weather_forecast(district)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/forecast/all", response_model=WeatherForecastResponse)
def get_all_weather_forecasts() -> WeatherForecastResponse:
    return get_all_districts_weather_forecast()


@router.get("/forecast/geojson")
def get_weather_forecast_geojson() -> JSONResponse:
    return JSONResponse(generate_weather_geojson(get_all_districts_weather_forecast()))


@router.get("/debug/open-meteo")
def debug_open_meteo() -> dict:
    return debug_open_meteo_request(
        latitude=53.62,
        longitude=109.63,
        days=3,
    )
