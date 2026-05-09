from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[2]
DISTRICTS_GEOJSON_PATH = BACKEND_DIR / "data" / "geojson" / "districts_buryatia.geojson"
DISTRICTS_SHAPEFILE_PATH = (
    BACKEND_DIR / "data" / "vector" / "districts" / "boundary-polygon-lvl6.shp"
)

DISTRICT_NAME_FIELDS = (
    "DISTRICT_NAME",
    "name",
    "NAME",
    "name_ru",
    "NAME_RU",
    "official_name",
    "OFFICIAL_N",
    "district",
    "DISTRICT",
    "mun_name",
    "MUN_NAME",
)

WEATHER_TO_BOUNDARY_NAME_ALIASES = {
    "Тарбагатайский район": ("Тарбагатайский район", "Тарбагатайский"),
    "Баргузинский район": ("Баргузинский район", "Баргузинский"),
    "Кабанский район": ("Кабанский район", "Кабанский"),
    "Иволгинский район": ("Иволгинский район", "Иволгинский"),
    "Заиграевский район": ("Заиграевский район", "Заиграевский"),
}


class DistrictBoundaryError(RuntimeError):
    pass


def _normalize_name(value: str) -> str:
    value = repair_mojibake(value)
    normalized = value.lower().replace("ё", "е")
    normalized = re.sub(r"[^а-яa-z0-9]+", "", normalized)
    return normalized.replace("район", "")


def repair_mojibake(value: str) -> str:
    if not isinstance(value, str):
        return value

    try:
        repaired = value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value

    return repaired if "Ð" in value or "Ñ" in value else value


def _load_geojson_file() -> dict[str, Any]:
    if not DISTRICTS_GEOJSON_PATH.exists():
        _try_convert_shapefile_to_geojson()

    with DISTRICTS_GEOJSON_PATH.open("r", encoding="utf-8") as geojson_file:
        data = json.load(geojson_file)

    if data.get("type") != "FeatureCollection":
        raise DistrictBoundaryError("Файл границ районов должен быть GeoJSON FeatureCollection.")

    return data


def _try_convert_shapefile_to_geojson() -> None:
    if not DISTRICTS_SHAPEFILE_PATH.exists():
        raise DistrictBoundaryError(
            "GeoJSON границ районов не найден, shapefile также отсутствует. "
            "Поместите shapefile в backend/data/vector/districts или экспортируйте "
            "GeoJSON вручную через QGIS."
        )

    try:
        import geopandas as gpd
    except ImportError as error:
        raise DistrictBoundaryError(
            "GeoJSON границ районов не найден, а GeoPandas не установлен. "
            "Запустите scripts/convert_districts_shapefile_to_geojson.py после установки "
            "гео-зависимостей или экспортируйте GeoJSON вручную через QGIS."
        ) from error

    try:
        districts = gpd.read_file(DISTRICTS_SHAPEFILE_PATH)
        for column in districts.columns:
            if column != "geometry":
                districts[column] = districts[column].map(repair_mojibake)

        name_field = None
        for feature in json.loads(districts.head(1).to_json()).get("features", []):
            name_field = _detect_name_field(feature)

        if name_field:
            districts["DISTRICT_NAME"] = districts[name_field]

        if districts.crs is None:
            districts = districts.set_crs(epsg=4326)
        else:
            districts = districts.to_crs(epsg=4326)

        DISTRICTS_GEOJSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        districts.to_file(DISTRICTS_GEOJSON_PATH, driver="GeoJSON", encoding="utf-8")
    except Exception as error:
        raise DistrictBoundaryError(
            "Не удалось автоматически прочитать shapefile районов. "
            "Проверьте комплект файлов shapefile или экспортируйте GeoJSON вручную через QGIS."
        ) from error


def clean_geojson_properties(properties: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}

    for key, value in properties.items():
        if value is None:
            cleaned[key] = None
            continue

        if isinstance(value, float) and math.isnan(value):
            cleaned[key] = None
            continue

        if isinstance(value, str):
            cleaned[key] = repair_mojibake(value)
            continue

        cleaned[key] = value

    return cleaned


def _detect_name_field(feature: dict[str, Any]) -> str | None:
    properties = feature.get("properties") or {}

    for field_name in DISTRICT_NAME_FIELDS:
        if properties.get(field_name):
            return field_name

    for field_name, value in properties.items():
        if value and "name" in field_name.lower():
            return field_name

    for field_name, value in properties.items():
        if isinstance(value, str) and ("район" in value.lower() or "р-н" in value.lower()):
            return field_name

    return None


@lru_cache(maxsize=1)
def get_districts_geojson() -> dict[str, Any]:
    return _load_geojson_file()


def get_district_name_field() -> str | None:
    features = get_districts_geojson().get("features") or []
    if not features:
        return None

    return _detect_name_field(features[0])


def _get_feature_name(feature: dict[str, Any]) -> str:
    properties = feature.get("properties") or {}
    name_field = _detect_name_field(feature)
    if name_field and properties.get(name_field):
        return repair_mojibake(str(properties[name_field]))

    return "Без названия"


def _iter_coordinates(geometry: dict[str, Any]):
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates") or []

    if geometry_type == "Polygon":
        for ring in coordinates:
            for point in ring:
                yield point
    elif geometry_type == "MultiPolygon":
        for polygon in coordinates:
            for ring in polygon:
                for point in ring:
                    yield point


def _calculate_centroid(geometry: dict[str, Any]) -> tuple[float | None, float | None]:
    points = list(_iter_coordinates(geometry))
    if not points:
        return None, None

    longitude = sum(float(point[0]) for point in points) / len(points)
    latitude = sum(float(point[1]) for point in points) / len(points)
    return round(latitude, 6), round(longitude, 6)


def get_districts_list() -> list[dict[str, Any]]:
    features = get_districts_geojson().get("features") or []
    districts = []

    for index, feature in enumerate(features, start=1):
        name = _get_feature_name(feature)
        centroid_latitude, centroid_longitude = _calculate_centroid(feature.get("geometry") or {})
        districts.append(
            {
                "id": _normalize_name(name) or f"district-{index}",
                "name": name,
                "geometry_available": bool(feature.get("geometry")),
                "centroid_latitude": centroid_latitude,
                "centroid_longitude": centroid_longitude,
            }
        )

    return districts


def find_boundary_feature_by_district_id(district_id: str) -> dict[str, Any] | None:
    normalized_id = _normalize_name(district_id)

    for feature in get_districts_geojson().get("features") or []:
        boundary_name = _get_feature_name(feature)
        if _normalize_name(boundary_name) == normalized_id:
            return feature

    return None


def find_boundary_feature_for_weather_district(district_name: str) -> dict[str, Any] | None:
    features = get_districts_geojson().get("features") or []
    alias_names = WEATHER_TO_BOUNDARY_NAME_ALIASES.get(district_name, (district_name,))
    normalized_aliases = {_normalize_name(alias_name) for alias_name in alias_names}

    for feature in features:
        boundary_name = _get_feature_name(feature)
        normalized_boundary_name = _normalize_name(boundary_name)
        if normalized_boundary_name in normalized_aliases:
            return feature

    for feature in features:
        boundary_name = _get_feature_name(feature)
        normalized_boundary_name = _normalize_name(boundary_name)
        if any(alias in normalized_boundary_name for alias in normalized_aliases):
            return feature

    return None
