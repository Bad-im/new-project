from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect GeoTIFF files before cutting them into ML patches."
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Folder with source GeoTIFF files.",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Output CSV path for inspection metadata.",
    )
    return parser.parse_args()


def find_geotiffs(input_dir: Path) -> list[Path]:
    patterns = ("*.tif", "*.tiff", "*.TIF", "*.TIFF")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(input_dir.rglob(pattern))
    return sorted(set(files))


def estimate_full_patches(width: int, height: int, patch_size: int) -> int:
    return (width // patch_size) * (height // patch_size)


def band_descriptions(descriptions: Iterable[str | None]) -> str:
    names = [description or "" for description in descriptions]
    return "|".join(names)


def inspect_file(path: Path) -> dict[str, object]:
    import rasterio

    with rasterio.open(path) as src:
        bounds = src.bounds
        transform = src.transform
        return {
            "filename": path.name,
            "full_path": str(path.resolve()),
            "width": src.width,
            "height": src.height,
            "band_count": src.count,
            "band_descriptions": band_descriptions(src.descriptions),
            "dtype": "|".join(src.dtypes),
            "crs": str(src.crs) if src.crs else "",
            "transform": str(transform),
            "bounds": str(bounds),
            "nodata": src.nodata,
            "pixel_size_x": transform.a,
            "pixel_size_y": transform.e,
            "estimated_patches_256": estimate_full_patches(src.width, src.height, 256),
            "estimated_patches_512": estimate_full_patches(src.width, src.height, 512),
        }


def main() -> int:
    args = parse_args()
    input_dir = args.input
    output_csv = args.output

    try:
        import pandas as pd
        import rasterio
    except ModuleNotFoundError as exc:
        print(
            "Missing ML dependency: "
            f"{exc.name}. Install dependencies with: pip install -r ml/requirements-ml.txt"
        )
        return 1

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input folder was not found: {input_dir}")
        return 1

    geotiffs = find_geotiffs(input_dir)
    if not geotiffs:
        print(f"No .tif or .tiff files found in: {input_dir}")
        return 1

    print(f"Found GeoTIFF files: {len(geotiffs)}")
    rows: list[dict[str, object]] = []

    for index, path in enumerate(geotiffs, start=1):
        print(f"[{index}/{len(geotiffs)}] Inspecting: {path}")
        try:
            row = inspect_file(path)
            rows.append(row)
            print(
                "  "
                f"{row['width']}x{row['height']}, "
                f"bands={row['band_count']}, dtype={row['dtype']}"
            )
        except rasterio.errors.RasterioIOError as exc:
            print(f"  WARNING: could not open GeoTIFF: {exc}")
            rows.append(
                {
                    "filename": path.name,
                    "full_path": str(path.resolve()),
                    "warning": str(exc),
                }
            )

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(output_csv, index=False, encoding="utf-8-sig")
    print(f"Inspection CSV saved to: {output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
