from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


METADATA_COLUMNS = [
    "patch_id",
    "patch_path",
    "source_folder",
    "filename",
    "width",
    "height",
    "band_count",
    "dtype",
    "crs",
    "bounds_left",
    "bounds_bottom",
    "bounds_right",
    "bounds_top",
    "center_lon",
    "center_lat",
    "pixel_size_x",
    "pixel_size_y",
    "nodata",
    "has_nodata",
    "valid_ratio",
    "created_at",
]
ERROR_COLUMNS = [
    "patch_path",
    "source_folder",
    "filename",
    "error",
    "created_at",
]

np = None
pd = None
rasterio = None
transform_coordinates = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild metadata CSV from already cut georeferenced GeoTIFF patches."
    )
    parser.add_argument("--patches-root", required=True, type=Path, help="Root folder with GeoTIFF patches.")
    parser.add_argument("--output", required=True, type=Path, help="Output rebuilt metadata CSV.")
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Search .tif and .tiff files recursively.",
    )
    return parser.parse_args()


def load_dependencies() -> bool:
    global np, pd, rasterio, transform_coordinates

    try:
        import numpy as numpy_module
        import pandas as pandas_module
        import rasterio as rasterio_module
        from rasterio.warp import transform as transform_function
    except ModuleNotFoundError as exc:
        print(
            "Missing ML dependency: "
            f"{exc.name}. Install dependencies with: pip install -r ml/requirements-ml.txt"
        )
        return False

    np = numpy_module
    pd = pandas_module
    rasterio = rasterio_module
    transform_coordinates = transform_function
    return True


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_geotiffs(patches_root: Path, recursive: bool) -> list[Path]:
    patterns = ("*.tif", "*.tiff", "*.TIF", "*.TIFF")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(patches_root.rglob(pattern) if recursive else patches_root.glob(pattern))
    return sorted(set(files))


def source_folder(patch_path: Path, patches_root: Path) -> str:
    try:
        relative_parent = patch_path.parent.relative_to(patches_root)
    except ValueError:
        relative_parent = patch_path.parent

    if str(relative_parent) == ".":
        return ""
    return str(relative_parent)


def valid_pixel_ratio(data: np.ndarray, nodata: float | int | None) -> float:
    finite_mask = np.all(np.isfinite(data), axis=0)
    nonzero_mask = ~np.all(data == 0, axis=0)
    valid_mask = finite_mask & nonzero_mask

    if nodata is not None:
        nodata_mask = ~np.any(data == nodata, axis=0)
        valid_mask &= nodata_mask

    return float(valid_mask.sum() / valid_mask.size) if valid_mask.size else 0.0


def center_lon_lat(bounds: object, crs: object) -> tuple[float, float]:
    center_x = (bounds.left + bounds.right) / 2
    center_y = (bounds.bottom + bounds.top) / 2

    if not crs:
        return center_x, center_y

    try:
        epsg = crs.to_epsg()
    except Exception:  # noqa: BLE001 - CRS objects can fail on malformed metadata.
        epsg = None

    if epsg == 4326:
        return center_x, center_y

    lon_values, lat_values = transform_coordinates(crs, "EPSG:4326", [center_x], [center_y])
    return float(lon_values[0]), float(lat_values[0])


def process_patch(patch_path: Path, patches_root: Path, created_at: str) -> dict[str, object]:
    with rasterio.open(patch_path) as src:
        data = src.read()
        bounds = src.bounds
        pixel_size_x = abs(float(src.transform.a))
        pixel_size_y = abs(float(src.transform.e))
        lon, lat = center_lon_lat(bounds, src.crs)
        nodata = src.nodata

        return {
            "patch_id": patch_path.stem,
            "patch_path": str(patch_path.resolve()),
            "source_folder": source_folder(patch_path, patches_root),
            "filename": patch_path.name,
            "width": src.width,
            "height": src.height,
            "band_count": src.count,
            "dtype": "|".join(src.dtypes),
            "crs": str(src.crs) if src.crs else "",
            "bounds_left": bounds.left,
            "bounds_bottom": bounds.bottom,
            "bounds_right": bounds.right,
            "bounds_top": bounds.top,
            "center_lon": lon,
            "center_lat": lat,
            "pixel_size_x": pixel_size_x,
            "pixel_size_y": pixel_size_y,
            "nodata": "" if nodata is None else nodata,
            "has_nodata": nodata is not None,
            "valid_ratio": valid_pixel_ratio(data, nodata),
            "created_at": created_at,
        }


def error_row(patch_path: Path, patches_root: Path, error: Exception, created_at: str) -> dict[str, object]:
    return {
        "patch_path": str(patch_path.resolve()),
        "source_folder": source_folder(patch_path, patches_root),
        "filename": patch_path.name,
        "error": str(error),
        "created_at": created_at,
    }


def write_csv(path: Path, rows: Iterable[dict[str, object]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=columns).to_csv(path, index=False, encoding="utf-8-sig")


def main() -> int:
    args = parse_args()
    if not load_dependencies():
        return 1

    patches_root = args.patches_root
    output_csv = args.output
    errors_csv = output_csv.parent / "rebuilt_metadata_errors.csv"

    if not patches_root.exists() or not patches_root.is_dir():
        print(f"Patches root folder was not found: {patches_root}")
        return 1

    geotiffs = find_geotiffs(patches_root, args.recursive)
    print(f"GeoTIFF files found: {len(geotiffs)}")

    metadata_rows: list[dict[str, object]] = []
    error_rows: list[dict[str, object]] = []
    created_at = utc_now()

    for index, patch_path in enumerate(geotiffs, start=1):
        try:
            metadata_rows.append(process_patch(patch_path, patches_root, created_at))
        except Exception as exc:  # noqa: BLE001 - keep scanning and write a separate errors CSV.
            error_rows.append(error_row(patch_path, patches_root, exc, created_at))
            print(f"WARNING: could not read {patch_path}: {exc}")

        if index % 500 == 0:
            print(f"Processed {index}/{len(geotiffs)} files...")

    write_csv(output_csv, metadata_rows, METADATA_COLUMNS)
    write_csv(errors_csv, error_rows, ERROR_COLUMNS)

    print(f"Successfully processed: {len(metadata_rows)}")
    print(f"Files with errors: {len(error_rows)}")
    print(f"Metadata CSV saved to: {output_csv}")
    print(f"Errors CSV saved to: {errors_csv}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
