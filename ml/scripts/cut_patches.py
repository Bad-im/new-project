from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


EXPECTED_BANDS = 7
DEFAULT_BAND_NAMES = ("B2", "B3", "B4", "B5", "B8", "B11", "B12")
np = None
pd = None
rasterio = None
Window = None
transform_coordinates = None
METADATA_COLUMNS = [
    "patch_id",
    "patch_path",
    "source_file",
    "source_path",
    "source_width",
    "source_height",
    "x_offset",
    "y_offset",
    "patch_width",
    "patch_height",
    "patch_size",
    "stride",
    "band_count",
    "band_names",
    "dtype",
    "crs",
    "bounds_left",
    "bounds_bottom",
    "bounds_right",
    "bounds_top",
    "center_lon",
    "center_lat",
    "valid_ratio",
    "has_nodata",
    "created_at",
]
SKIPPED_COLUMNS = [
    "source_file",
    "x_offset",
    "y_offset",
    "skipped_reason",
    "valid_ratio",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cut multi-band GeoTIFF files into georeferenced ML patches."
    )
    parser.add_argument("--input", required=True, type=Path, help="Folder with source GeoTIFF files.")
    parser.add_argument("--output", required=True, type=Path, help="Folder for patch outputs.")
    parser.add_argument("--metadata", required=True, type=Path, help="Output CSV path for patch metadata.")
    parser.add_argument("--patch-size", type=int, default=512, help="Patch side size in pixels.")
    parser.add_argument(
        "--stride",
        type=int,
        default=None,
        help="Window stride in pixels. Defaults to patch-size.",
    )
    parser.add_argument(
        "--min-valid-ratio",
        type=float,
        default=0.8,
        help="Minimum valid pixel ratio required to save a patch.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Search GeoTIFF files recursively.",
    )
    parser.add_argument(
        "--max-patches-per-file",
        type=int,
        default=None,
        help="Optional limit for saved patches per source file.",
    )
    parser.add_argument(
        "--preview-count",
        type=int,
        default=0,
        help="Optional total number of PNG previews to write.",
    )
    return parser.parse_args()


def load_dependencies() -> bool:
    global Window, np, pd, rasterio, transform_coordinates

    try:
        import numpy as numpy_module
        import pandas as pandas_module
        import rasterio as rasterio_module
        from rasterio.windows import Window as WindowClass
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
    Window = WindowClass
    transform_coordinates = transform_function
    return True


def find_geotiffs(input_dir: Path, recursive: bool) -> list[Path]:
    patterns = ("*.tif", "*.tiff", "*.TIF", "*.TIFF")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(input_dir.rglob(pattern) if recursive else input_dir.glob(pattern))
    return sorted(set(files))


def band_names(descriptions: Iterable[str | None], band_count: int) -> list[str]:
    names = [description or "" for description in descriptions]
    if not any(names) and band_count == EXPECTED_BANDS:
        return list(DEFAULT_BAND_NAMES)
    return names


def valid_pixel_mask(data: np.ndarray, nodata: float | int | None) -> np.ndarray:
    finite_mask = np.all(np.isfinite(data), axis=0)
    nonzero_mask = ~np.all(data == 0, axis=0)
    valid_mask = finite_mask & nonzero_mask

    if nodata is not None:
        nodata_mask = ~np.any(data == nodata, axis=0)
        valid_mask &= nodata_mask

    return valid_mask


def patch_validity(
    data: np.ndarray,
    patch_size: int,
    nodata: float | int | None,
) -> tuple[bool, str, float]:
    if data.shape[1] != patch_size or data.shape[2] != patch_size:
        return False, "incomplete_patch", 0.0

    valid_mask = valid_pixel_mask(data, nodata)
    valid_ratio = float(valid_mask.sum() / valid_mask.size)

    empty_channels = []
    for band_index in range(data.shape[0]):
        band = data[band_index]
        band_finite = np.isfinite(band)
        band_nonzero = band != 0
        band_valid = band_finite & band_nonzero
        if nodata is not None:
            band_valid &= band != nodata
        if not np.any(band_valid):
            empty_channels.append(str(band_index + 1))

    if empty_channels:
        return False, f"empty_channels:{','.join(empty_channels)}", valid_ratio

    return True, "", valid_ratio


def normalize_rgb_for_preview(data: np.ndarray) -> np.ndarray:
    rgb = data[[2, 1, 0], :, :].astype(np.float32)
    preview = np.zeros_like(rgb, dtype=np.uint8)

    for channel_index in range(3):
        channel = rgb[channel_index]
        finite_values = channel[np.isfinite(channel)]
        if finite_values.size == 0:
            continue

        low, high = np.percentile(finite_values, [2, 98])
        if high <= low:
            high = low + 1.0

        scaled = (channel - low) / (high - low)
        scaled = np.clip(scaled, 0.0, 1.0)
        preview[channel_index] = (scaled * 255).astype(np.uint8)

    return preview


def write_preview(preview_path: Path, data: np.ndarray) -> None:
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview = normalize_rgb_for_preview(data)
    profile = {
        "driver": "PNG",
        "height": preview.shape[1],
        "width": preview.shape[2],
        "count": 3,
        "dtype": "uint8",
    }
    with rasterio.open(preview_path, "w", **profile) as dst:
        dst.write(preview)


def patch_bounds_and_center(
    affine_transform: rasterio.Affine,
    patch_size: int,
    crs: object,
) -> dict[str, float]:
    left, top = affine_transform * (0, 0)
    right, bottom = affine_transform * (patch_size, patch_size)
    bounds_left = min(left, right)
    bounds_right = max(left, right)
    bounds_bottom = min(bottom, top)
    bounds_top = max(bottom, top)
    center_x = (bounds_left + bounds_right) / 2
    center_y = (bounds_bottom + bounds_top) / 2

    center_lon = center_x
    center_lat = center_y
    if crs:
        try:
            lon_values, lat_values = transform_coordinates(crs, "EPSG:4326", [center_x], [center_y])
            center_lon = lon_values[0]
            center_lat = lat_values[0]
        except Exception as exc:  # noqa: BLE001 - keep source CRS coordinates if reprojection fails.
            print(f"  WARNING: could not transform patch center to EPSG:4326: {exc}")

    return {
        "bounds_left": bounds_left,
        "bounds_bottom": bounds_bottom,
        "bounds_right": bounds_right,
        "bounds_top": bounds_top,
        "center_lon": center_lon,
        "center_lat": center_lat,
    }


def write_patch(
    patch_path: Path,
    data: np.ndarray,
    src: rasterio.io.DatasetReader,
    window: Window,
    patch_size: int,
) -> None:
    patch_path.parent.mkdir(parents=True, exist_ok=True)
    profile = src.profile.copy()
    profile.update(
        {
            "driver": "GTiff",
            "height": patch_size,
            "width": patch_size,
            "count": src.count,
            "dtype": src.dtypes[0],
            "transform": src.window_transform(window),
            "crs": src.crs,
            "compress": "lzw",
        }
    )

    try:
        with rasterio.open(patch_path, "w", **profile) as dst:
            dst.write(data)
            for band_index, description in enumerate(src.descriptions, start=1):
                if description:
                    dst.set_band_description(band_index, description)
    except Exception:
        profile.pop("compress", None)
        with rasterio.open(patch_path, "w", **profile) as dst:
            dst.write(data)
            for band_index, description in enumerate(src.descriptions, start=1):
                if description:
                    dst.set_band_description(band_index, description)


def source_output_name(source_path: Path) -> str:
    return source_path.stem


def process_file(
    source_path: Path,
    output_dir: Path,
    patch_size: int,
    stride: int,
    min_valid_ratio: float,
    max_patches_per_file: int | None,
    preview_count: int,
    previews_created: int,
) -> tuple[list[dict[str, object]], list[dict[str, object]], int]:
    metadata_rows: list[dict[str, object]] = []
    skipped_rows: list[dict[str, object]] = []
    source_name = source_output_name(source_path)
    created_count = 0
    skipped_count = 0

    with rasterio.open(source_path) as src:
        print(f"Processing: {source_path}")
        print(f"  size={src.width}x{src.height}, bands={src.count}, dtype={'|'.join(src.dtypes)}")

        if src.count != EXPECTED_BANDS:
            warning = f"expected_{EXPECTED_BANDS}_bands_got_{src.count}"
            print(f"  WARNING: {warning}; file skipped")
            skipped_rows.append(
                {
                    "source_file": source_path.name,
                    "x_offset": "",
                    "y_offset": "",
                    "skipped_reason": warning,
                    "valid_ratio": "",
                }
            )
            return metadata_rows, skipped_rows, previews_created

        names = band_names(src.descriptions, src.count)
        dtype = src.dtypes[0]
        has_nodata = src.nodata is not None
        created_at = datetime.now(timezone.utc).isoformat()

        for y_offset in range(0, src.height - patch_size + 1, stride):
            for x_offset in range(0, src.width - patch_size + 1, stride):
                window = Window(x_offset, y_offset, patch_size, patch_size)
                data = src.read(window=window)
                is_valid, skipped_reason, valid_ratio = patch_validity(data, patch_size, src.nodata)

                if not is_valid or valid_ratio < min_valid_ratio:
                    reason = skipped_reason or "valid_ratio_below_threshold"
                    skipped_rows.append(
                        {
                            "source_file": source_path.name,
                            "x_offset": x_offset,
                            "y_offset": y_offset,
                            "skipped_reason": reason,
                            "valid_ratio": valid_ratio,
                        }
                    )
                    skipped_count += 1
                    continue

                patch_index = created_count + 1
                patch_filename = f"{source_name}_patch_{patch_index:06d}.tif"
                patch_path = output_dir / "patches" / source_name / patch_filename
                write_patch(patch_path, data, src, window, patch_size)

                if preview_count > 0 and previews_created < preview_count:
                    preview_path = output_dir / "previews" / source_name / patch_filename.replace(".tif", ".png")
                    try:
                        write_preview(preview_path, data)
                        previews_created += 1
                    except Exception as exc:  # noqa: BLE001 - preview should not stop patch creation.
                        print(f"  WARNING: could not write preview {preview_path}: {exc}")

                patch_transform = src.window_transform(window)
                patch_geo = patch_bounds_and_center(patch_transform, patch_size, src.crs)
                patch_id = f"{source_name}_patch_{patch_index:06d}"
                metadata_rows.append(
                    {
                        "patch_id": patch_id,
                        "patch_path": str(patch_path.resolve()),
                        "source_file": source_path.name,
                        "source_path": str(source_path.resolve()),
                        "source_width": src.width,
                        "source_height": src.height,
                        "x_offset": x_offset,
                        "y_offset": y_offset,
                        "patch_width": patch_size,
                        "patch_height": patch_size,
                        "patch_size": patch_size,
                        "stride": stride,
                        "band_count": src.count,
                        "band_names": "|".join(names),
                        "dtype": dtype,
                        "crs": str(src.crs) if src.crs else "",
                        **patch_geo,
                        "valid_ratio": valid_ratio,
                        "has_nodata": has_nodata,
                        "created_at": created_at,
                    }
                )
                created_count += 1

                if max_patches_per_file is not None and created_count >= max_patches_per_file:
                    print(f"  Reached --max-patches-per-file={max_patches_per_file}")
                    print(f"  created={created_count}, skipped={skipped_count}")
                    return metadata_rows, skipped_rows, previews_created

    print(f"  created={created_count}, skipped={skipped_count}")
    return metadata_rows, skipped_rows, previews_created


def main() -> int:
    args = parse_args()
    if not load_dependencies():
        return 1

    input_dir = args.input
    output_dir = args.output
    metadata_csv = args.metadata
    patch_size = args.patch_size
    stride = args.stride or patch_size

    if patch_size <= 0:
        print("--patch-size must be greater than 0")
        return 1
    if stride <= 0:
        print("--stride must be greater than 0")
        return 1
    if not 0 <= args.min_valid_ratio <= 1:
        print("--min-valid-ratio must be between 0 and 1")
        return 1
    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input folder was not found: {input_dir}")
        return 1

    geotiffs = find_geotiffs(input_dir, args.recursive)
    if not geotiffs:
        print(f"No .tif or .tiff files found in: {input_dir}")
        return 1

    print(f"Found GeoTIFF files: {len(geotiffs)}")
    print(f"Patch size: {patch_size}; stride: {stride}; min valid ratio: {args.min_valid_ratio}")

    all_metadata_rows: list[dict[str, object]] = []
    all_skipped_rows: list[dict[str, object]] = []
    previews_created = 0

    for source_path in geotiffs:
        try:
            metadata_rows, skipped_rows, previews_created = process_file(
                source_path=source_path,
                output_dir=output_dir,
                patch_size=patch_size,
                stride=stride,
                min_valid_ratio=args.min_valid_ratio,
                max_patches_per_file=args.max_patches_per_file,
                preview_count=args.preview_count,
                previews_created=previews_created,
            )
            all_metadata_rows.extend(metadata_rows)
            all_skipped_rows.extend(skipped_rows)
        except rasterio.errors.RasterioIOError as exc:
            print(f"WARNING: could not open {source_path}: {exc}")
            all_skipped_rows.append(
                {
                    "source_file": source_path.name,
                    "x_offset": "",
                    "y_offset": "",
                    "skipped_reason": f"open_error:{exc}",
                    "valid_ratio": "",
                }
            )

    metadata_csv.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(all_metadata_rows, columns=METADATA_COLUMNS).to_csv(
        metadata_csv,
        index=False,
        encoding="utf-8-sig",
    )

    skipped_csv = output_dir / "metadata" / "skipped_patches.csv"
    skipped_csv.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(all_skipped_rows, columns=SKIPPED_COLUMNS).to_csv(
        skipped_csv,
        index=False,
        encoding="utf-8-sig",
    )

    print(f"Total patches created: {len(all_metadata_rows)}")
    print(f"Total patches skipped: {len(all_skipped_rows)}")
    print(f"Metadata CSV saved to: {metadata_csv}")
    print(f"Skipped patches CSV saved to: {skipped_csv}")
    if args.preview_count > 0:
        print(f"PNG previews created: {previews_created}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
