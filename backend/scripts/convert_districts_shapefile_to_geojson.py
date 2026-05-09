from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SHAPEFILE_PATH = ROOT_DIR / "data" / "vector" / "districts" / "boundary-polygon-lvl6.shp"
GEOJSON_PATH = ROOT_DIR / "data" / "geojson" / "districts_buryatia.geojson"

NAME_FIELD_CANDIDATES = (
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


def repair_mojibake(value):
    if not isinstance(value, str):
        return value

    try:
        repaired = value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value

    return repaired if "Ð" in value or "Ñ" in value else value


def detect_name_field(columns: list[str], rows_preview) -> str | None:
    for field_name in NAME_FIELD_CANDIDATES:
        if field_name in columns:
            return field_name

    for field_name in columns:
        if "name" in field_name.lower():
            return field_name

    for field_name in columns:
        values = rows_preview[field_name].dropna().astype(str).tolist()
        if any("район" in value.lower() or "р-н" in value.lower() for value in values):
            return field_name

    return None


def main() -> None:
    try:
        import geopandas as gpd
    except ImportError as error:
        raise SystemExit(
            "GeoPandas не установлен. Установите зависимости backend или экспортируйте "
            "GeoJSON вручную через QGIS."
        ) from error

    if not SHAPEFILE_PATH.exists():
        raise SystemExit(f"Shapefile не найден: {SHAPEFILE_PATH}")

    print(f"Открываю shapefile: {SHAPEFILE_PATH}")
    districts = gpd.read_file(SHAPEFILE_PATH)
    for column in districts.columns:
        if column != "geometry":
            districts[column] = districts[column].map(repair_mojibake)

    print("Поля атрибутивной таблицы:")
    print(list(districts.columns))

    rows_preview = districts.head(10)
    name_field = detect_name_field(list(districts.columns), rows_preview)
    if name_field:
        districts["DISTRICT_NAME"] = districts[name_field]
        print(f"Автоматически определено поле названия района: {name_field}")
        print("Первые 10 названий районов:")
        print(districts.head(10)[name_field].to_string(index=False))
    else:
        print("Не удалось автоматически определить поле с названием района.")
        print("Первые 10 строк атрибутивной таблицы:")
        print(rows_preview.drop(columns="geometry", errors="ignore").to_string(index=False))

    if districts.crs is None:
        print("CRS отсутствует в shapefile. Предполагается EPSG:4326.")
        districts = districts.set_crs(epsg=4326)
    else:
        districts = districts.to_crs(epsg=4326)

    GEOJSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    districts.to_file(GEOJSON_PATH, driver="GeoJSON", encoding="utf-8")
    print(f"GeoJSON сохранён: {GEOJSON_PATH}")


if __name__ == "__main__":
    main()
