from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


MODEL_PATH = Path(r"C:\labs\FireForest_outputs\finetune_resnet18_v2\best_model.pt")
EXPECTED_BAND_COUNT = 7
PATCH_SIZE = 512
MODEL_INPUT_SIZE = 224
MIN_VALID_RATIO = 0.8
HAZARD_CLASSES = (1, 2, 3, 4, 5)

_model_bundle: "ModelBundle | None" = None


@dataclass
class ModelBundle:
    model: Any
    device: Any
    torch: Any
    functional: Any


def _load_dependencies() -> dict[str, Any]:
    try:
        import numpy as np
        import rasterio
        import torch
        import torch.nn as nn
        import torch.nn.functional as functional
        import torchvision.models as models
        from rasterio.transform import Affine
        from rasterio.warp import transform as transform_coordinates
        from rasterio.warp import transform_bounds
        from rasterio.windows import Window, bounds as window_bounds
    except (ImportError, ModuleNotFoundError) as exc:
        dependency_name = getattr(exc, "name", None) or str(exc)
        raise RuntimeError(
            "Не установлены зависимости спутникового inference: "
            f"{dependency_name}. Установите rasterio, torch, torchvision, numpy и python-multipart."
        ) from exc

    return {
        "np": np,
        "rasterio": rasterio,
        "torch": torch,
        "nn": nn,
        "functional": functional,
        "models": models,
        "Affine": Affine,
        "Window": Window,
        "window_bounds": window_bounds,
        "transform_coordinates": transform_coordinates,
        "transform_bounds": transform_bounds,
    }


def _build_model(torch: Any, nn: Any, models: Any) -> Any:
    # Inference pipeline for fine-tuned ResNet18 on 7-channel Sentinel-2 patches.
    model = models.resnet18(weights=None)
    old_conv = model.conv1
    model.conv1 = nn.Conv2d(
        in_channels=EXPECTED_BAND_COUNT,
        out_channels=old_conv.out_channels,
        kernel_size=old_conv.kernel_size,
        stride=old_conv.stride,
        padding=old_conv.padding,
        bias=False,
    )
    model.fc = nn.Linear(model.fc.in_features, len(HAZARD_CLASSES))
    return model


def _extract_state_dict(checkpoint: Any) -> dict[str, Any]:
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    elif isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    else:
        state_dict = checkpoint

    if not isinstance(state_dict, dict):
        raise ValueError("Файл модели не содержит state_dict.")

    return {
        key.removeprefix("module."): value
        for key, value in state_dict.items()
    }


def get_model_bundle() -> ModelBundle:
    global _model_bundle

    if _model_bundle is not None:
        return _model_bundle

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Файл модели не найден: {MODEL_PATH}")

    deps = _load_dependencies()
    torch = deps["torch"]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = _build_model(torch, deps["nn"], deps["models"]).to(device)
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(_extract_state_dict(checkpoint))
    model.eval()

    _model_bundle = ModelBundle(
        model=model,
        device=device,
        torch=torch,
        functional=deps["functional"],
    )
    print(f"Satellite ResNet18 model loaded: {MODEL_PATH}")
    print(f"Satellite inference device: {device}")
    return _model_bundle


def _valid_pixel_mask(data: Any, nodata: float | int | None, np: Any) -> Any:
    finite_mask = np.all(np.isfinite(data), axis=0)
    nonzero_mask = ~np.all(data == 0, axis=0)
    valid_mask = finite_mask & nonzero_mask

    if nodata is not None:
        valid_mask &= ~np.any(data == nodata, axis=0)

    return valid_mask


def _valid_ratio(data: Any, nodata: float | int | None, np: Any) -> float:
    mask = _valid_pixel_mask(data, nodata, np)
    return round(float(mask.sum() / mask.size), 6)


def _prepare_tensor(data: Any, bundle: ModelBundle, np: Any) -> Any:
    data = data.astype(np.float32)
    data = np.nan_to_num(data, nan=0.0, posinf=1.0, neginf=0.0)

    if float(data.min()) < 0.0 or float(data.max()) > 1.0:
        data = np.clip(data, 0.0, 1.0)

    tensor = bundle.torch.from_numpy(data).unsqueeze(0).to(bundle.device)
    return bundle.functional.interpolate(
        tensor,
        size=(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE),
        mode="bilinear",
        align_corners=False,
    )


def _predict_patch(data: Any, bundle: ModelBundle, np: Any) -> dict[str, Any]:
    tensor = _prepare_tensor(data, bundle, np)

    with bundle.torch.no_grad():
        logits = bundle.model(tensor)
        probabilities_tensor = bundle.torch.softmax(logits, dim=1)[0].detach().cpu()

    probabilities = {
        str(class_id): round(float(probabilities_tensor[index]), 6)
        for index, class_id in enumerate(HAZARD_CLASSES)
    }
    predicted_index = int(probabilities_tensor.argmax().item())
    return {
        "predicted_class": predicted_index + 1,
        "confidence": round(float(probabilities_tensor[predicted_index]), 6),
        "probabilities": probabilities,
    }


def _bounds_to_polygon(bounds: tuple[float, float, float, float]) -> dict[str, Any]:
    left, bottom, right, top = bounds
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [left, bottom],
                [right, bottom],
                [right, top],
                [left, top],
                [left, bottom],
            ]
        ],
    }


def _to_wgs84_bounds(bounds: tuple[float, float, float, float], src_crs: Any, transform_bounds: Any) -> tuple[float, float, float, float]:
    left, bottom, right, top = transform_bounds(src_crs, "EPSG:4326", *bounds, densify_pts=21)
    return (
        round(float(left), 7),
        round(float(bottom), 7),
        round(float(right), 7),
        round(float(top), 7),
    )


def _to_wgs84_point(x: float, y: float, src_crs: Any, transform_coordinates: Any) -> tuple[float, float]:
    lon_values, lat_values = transform_coordinates(src_crs, "EPSG:4326", [x], [y])
    return round(float(lon_values[0]), 7), round(float(lat_values[0]), 7)


def _class_summary(features: list[dict[str, Any]]) -> dict[str, Any]:
    class_counts = {str(class_id): 0 for class_id in HAZARD_CLASSES}
    for feature in features:
        predicted_class = str(feature["properties"]["predicted_class"])
        class_counts[predicted_class] += 1

    processed = len(features)
    class_percentages = {
        class_id: round((count / processed) * 100, 2) if processed else 0.0
        for class_id, count in class_counts.items()
    }
    dominant_class = None
    max_class = None

    if processed:
        dominant_class = int(max(class_counts.items(), key=lambda item: item[1])[0])
        max_class = max(
            int(feature["properties"]["predicted_class"])
            for feature in features
        )

    return {
        "class_counts": class_counts,
        "class_percentages": class_percentages,
        "dominant_class": dominant_class,
        "max_class": max_class,
    }


def analyze_geotiff(image_path: Path) -> dict[str, Any]:
    if not image_path.exists():
        raise FileNotFoundError(f"Файл не найден: {image_path}")
    if image_path.suffix.lower() not in {".tif", ".tiff"}:
        raise ValueError("Поддерживаются только файлы .tif и .tiff.")

    deps = _load_dependencies()
    np = deps["np"]
    rasterio = deps["rasterio"]
    Window = deps["Window"]
    window_bounds = deps["window_bounds"]
    transform_coordinates = deps["transform_coordinates"]
    transform_bounds = deps["transform_bounds"]
    Affine = deps["Affine"]

    bundle = get_model_bundle()
    features: list[dict[str, Any]] = []
    skipped_patches = 0

    with rasterio.open(image_path) as src:
        if src.crs is None:
            raise ValueError("GeoTIFF не содержит CRS.")
        if src.transform == Affine.identity():
            raise ValueError("GeoTIFF не содержит корректную геопривязку.")
        if src.count != EXPECTED_BAND_COUNT:
            raise ValueError(
                f"GeoTIFF содержит {src.count} каналов; требуется {EXPECTED_BAND_COUNT}."
            )

        total_patches = (src.width // PATCH_SIZE) * (src.height // PATCH_SIZE)
        image_bounds = _to_wgs84_bounds(tuple(src.bounds), src.crs, transform_bounds)
        print(f"Satellite GeoTIFF accepted: {image_path.name}")
        print(f"Satellite total 512x512 patches: {total_patches}")

        patch_number = 0
        for row_off in range(0, src.height - PATCH_SIZE + 1, PATCH_SIZE):
            for col_off in range(0, src.width - PATCH_SIZE + 1, PATCH_SIZE):
                patch_number += 1
                window = Window(col_off, row_off, PATCH_SIZE, PATCH_SIZE)
                data = src.read(window=window)
                valid_ratio = _valid_ratio(data, src.nodata, np)

                if valid_ratio < MIN_VALID_RATIO:
                    skipped_patches += 1
                    continue

                source_bounds = window_bounds(window, src.transform)
                patch_bounds = _to_wgs84_bounds(source_bounds, src.crs, transform_bounds)
                center_x = (source_bounds[0] + source_bounds[2]) / 2
                center_y = (source_bounds[1] + source_bounds[3]) / 2
                center_lon, center_lat = _to_wgs84_point(
                    center_x,
                    center_y,
                    src.crs,
                    transform_coordinates,
                )
                prediction = _predict_patch(data, bundle, np)
                patch_id = f"{image_path.stem}_patch_{patch_number:06d}"

                features.append(
                    {
                        "type": "Feature",
                        "geometry": _bounds_to_polygon(patch_bounds),
                        "properties": {
                            "patch_id": patch_id,
                            "bounds_left": patch_bounds[0],
                            "bounds_bottom": patch_bounds[1],
                            "bounds_right": patch_bounds[2],
                            "bounds_top": patch_bounds[3],
                            "center_lon": center_lon,
                            "center_lat": center_lat,
                            "valid_ratio": valid_ratio,
                            **prediction,
                        },
                    }
                )

    class_stats = _class_summary(features)
    summary = {
        "total_patches": total_patches,
        "processed_patches": len(features),
        "skipped_patches": skipped_patches,
        **class_stats,
        "image_bounds": {
            "left": image_bounds[0],
            "bottom": image_bounds[1],
            "right": image_bounds[2],
            "top": image_bounds[3],
        },
        "district_detection": "not_implemented",
    }
    print(f"Satellite processed patches: {len(features)}")
    print(f"Satellite skipped patches: {skipped_patches}")
    print(f"Satellite class distribution: {class_stats['class_counts']}")

    return {
        "status": "ok",
        "summary": summary,
        "geojson": {
            "type": "FeatureCollection",
            "features": features,
        },
    }
