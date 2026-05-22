from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from json import JSONDecodeError
from pathlib import Path
from uuid import uuid4
from typing import Any

from app.services.satellite_model import (
    MODEL_INPUT_SIZE,
    MODEL_PATH,
    PATCH_SIZE,
)


ANALYSES_ROOT = Path(r"C:\labs\FireForest_uploads\satellite_analyses")
MODEL_NAME = "fine-tuned ResNet18 Sentinel-2 7-band classifier"


class SatelliteStorageError(ValueError):
    pass


def generate_analysis_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"{timestamp}_{uuid4().hex[:8]}"


def _read_json(path: Path, broken_message: str) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Файл результата не найден: {path.name}") from exc
    except JSONDecodeError as exc:
        raise SatelliteStorageError(broken_message) from exc


def _write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def save_satellite_analysis(
    source_path: Path,
    original_filename: str,
    image_date: str | None,
    result: dict[str, Any],
) -> dict[str, Any]:
    analysis_id = generate_analysis_id()
    analysis_dir = ANALYSES_ROOT / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=False)

    stored_path = analysis_dir / "original.tif"
    shutil.copy2(source_path, stored_path)

    summary = result["summary"]
    geojson = result["geojson"]
    metadata = {
        "analysis_id": analysis_id,
        "original_filename": original_filename,
        "stored_filename": stored_path.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "image_date": image_date or "",
        "model_path": str(MODEL_PATH),
        "model_name": MODEL_NAME,
        "patch_size": PATCH_SIZE,
        "img_size": MODEL_INPUT_SIZE,
        "total_patches": summary.get("total_patches"),
        "processed_patches": summary.get("processed_patches"),
        "skipped_patches": summary.get("skipped_patches"),
        "dominant_class": summary.get("dominant_class"),
        "max_class": summary.get("max_class"),
        "image_bounds": summary.get("image_bounds"),
    }

    _write_json(analysis_dir / "summary.json", summary)
    _write_json(analysis_dir / "result.geojson", geojson)
    _write_json(analysis_dir / "metadata.json", metadata)

    print(f"Satellite analysis saved: {analysis_dir}")
    return {
        "analysis_id": analysis_id,
        "metadata": metadata,
    }


def list_satellite_analyses() -> list[dict[str, Any]]:
    if not ANALYSES_ROOT.exists():
        return []

    items: list[dict[str, Any]] = []
    for analysis_dir in sorted(ANALYSES_ROOT.iterdir(), reverse=True):
        if not analysis_dir.is_dir():
            continue

        try:
            metadata = _read_json(
                analysis_dir / "metadata.json",
                "Сохранённый metadata.json повреждён.",
            )
            summary = _read_json(
                analysis_dir / "summary.json",
                "Сохранённый summary.json повреждён.",
            )
        except (FileNotFoundError, SatelliteStorageError):
            continue

        items.append(
            {
                "analysis_id": metadata.get("analysis_id", analysis_dir.name),
                "original_filename": metadata.get("original_filename", ""),
                "created_at": metadata.get("created_at", ""),
                "image_date": metadata.get("image_date", ""),
                "dominant_class": metadata.get("dominant_class"),
                "max_class": metadata.get("max_class"),
                "total_patches": metadata.get("total_patches", 0),
                "processed_patches": metadata.get("processed_patches", 0),
                "skipped_patches": metadata.get("skipped_patches", 0),
                "class_counts": summary.get("class_counts", {}),
            }
        )

    return items


def get_satellite_analysis(analysis_id: str) -> dict[str, Any]:
    analysis_dir = ANALYSES_ROOT / analysis_id
    if not analysis_dir.is_dir():
        raise FileNotFoundError(f"Анализ не найден: {analysis_id}")

    metadata = _read_json(
        analysis_dir / "metadata.json",
        "Сохранённый metadata.json повреждён.",
    )
    summary = _read_json(
        analysis_dir / "summary.json",
        "Сохранённый summary.json повреждён.",
    )
    geojson = _read_json(
        analysis_dir / "result.geojson",
        "Сохранённый result.geojson повреждён.",
    )

    if geojson.get("type") != "FeatureCollection" or not isinstance(geojson.get("features"), list):
        raise SatelliteStorageError("Сохранённый GeoJSON повреждён.")

    return {
        "status": "ok",
        "analysis_id": analysis_id,
        "metadata": metadata,
        "summary": summary,
        "geojson": geojson,
    }


def delete_satellite_analysis(analysis_id: str) -> None:
    analysis_dir = ANALYSES_ROOT / analysis_id
    if not analysis_dir.is_dir():
        raise FileNotFoundError(f"Анализ не найден: {analysis_id}")

    shutil.rmtree(analysis_dir)


def delete_all_satellite_analyses() -> int:
    if not ANALYSES_ROOT.exists():
        return 0

    deleted_count = 0
    for analysis_dir in ANALYSES_ROOT.iterdir():
        if analysis_dir.is_dir():
            shutil.rmtree(analysis_dir)
            deleted_count += 1

    return deleted_count
