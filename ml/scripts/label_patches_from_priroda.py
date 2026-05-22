from __future__ import annotations

import argparse
import csv
import json
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_ENDPOINT = "https://priroda-rb.ru/api/feature_layer/identify"
DEFAULT_LAYER_ID = 7201
DEFAULT_SOURCE = "priroda_identify"
REQUIRED_METADATA_COLUMNS = [
    "patch_id",
    "patch_path",
    "source_file",
    "center_lon",
    "center_lat",
    "bounds_left",
    "bounds_bottom",
    "bounds_right",
    "bounds_top",
]
LABEL_COLUMNS = [
    "patch_id",
    "patch_path",
    "source_file",
    "center_lon",
    "center_lat",
    "hazard_class",
    "status",
    "confidence",
    "points_checked",
    "points_with_class",
    "class_votes",
    "raw_classes",
    "layer_id",
    "source",
    "created_at",
]

pd = None
requests = None
Transformer = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Label GeoTIFF patches by fire hazard class from priroda-rb.ru identify endpoint."
    )
    parser.add_argument("--metadata", required=True, type=Path, help="Input patch metadata CSV.")
    parser.add_argument("--output", required=True, type=Path, help="Output labels CSV.")
    parser.add_argument("--limit", type=int, default=None, help="Optional patch limit for a test run.")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay between identify requests in seconds.",
    )
    parser.add_argument(
        "--mode",
        choices=("center", "five_points"),
        default="five_points",
        help="Point sampling mode.",
    )
    parser.add_argument("--layer-id", type=int, default=DEFAULT_LAYER_ID, help="Priroda layer id.")
    parser.add_argument(
        "--min-agreement",
        type=int,
        default=3,
        help="Minimum matching sample points required to assign a class.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip patch_id values already present in the output CSV.",
    )
    parser.add_argument(
        "--save-raw-response",
        action="store_true",
        help="Save raw identify responses to a JSONL file next to the labels CSV.",
    )
    parser.add_argument(
        "--request-size-meters",
        type=float,
        default=20.0,
        help="Side length of the identify polygon around each sample point in EPSG:3857 meters.",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def load_dependencies() -> bool:
    global Transformer, pd, requests

    try:
        import pandas as pandas_module
        import requests as requests_module
        from pyproj import Transformer as TransformerClass
    except ModuleNotFoundError as exc:
        print(
            "Missing ML dependency: "
            f"{exc.name}. Install dependencies with: pip install -r ml/requirements-ml.txt"
        )
        return False

    pd = pandas_module
    requests = requests_module
    Transformer = TransformerClass
    return True


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def as_float(value: Any, column: str, patch_id: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Patch {patch_id}: column {column} must be numeric, got {value!r}") from exc


def feature_class_counts(response_json: dict[str, Any], layer_id: int) -> tuple[Counter[str], list[str]]:
    layer = response_json.get(str(layer_id), response_json.get(layer_id, {}))
    features = layer.get("features") or []
    counts: Counter[str] = Counter()
    raw_classes: list[str] = []

    for feature in features:
        fields = feature.get("fields") or {}
        hazard_class = fields.get("Класс")
        if hazard_class is None or hazard_class == "":
            continue
        class_value = str(hazard_class)
        counts[class_value] += 1
        raw_classes.append(class_value)

    return counts, raw_classes


def build_polygon_wkt(x: float, y: float, size_meters: float) -> str:
    half_size = size_meters / 2.0
    left = x - half_size
    right = x + half_size
    bottom = y - half_size
    top = y + half_size
    return (
        "POLYGON(("
        f"{left} {bottom},"
        f"{left} {top},"
        f"{right} {top},"
        f"{right} {bottom},"
        f"{left} {bottom}"
        "))"
    )


def identify_point(
    session: requests.Session,
    transformer: Transformer,
    endpoint: str,
    layer_id: int,
    lon: float,
    lat: float,
    request_size_meters: float,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    try:
        x, y = transformer.transform(lon, lat)
        payload = {
            "srs": 3857,
            "geom": build_polygon_wkt(x, y, request_size_meters),
            "layers": [layer_id],
        }
        response = session.post(endpoint, json=payload, timeout=timeout_seconds)
        response.raise_for_status()
        response_json = response.json()
    except Exception as exc:  # noqa: BLE001 - network/API errors become CSV status rows.
        return {
            "status": "request_error",
            "error": str(exc),
            "payload": locals().get("payload"),
            "response": None,
        }

    counts, raw_classes = feature_class_counts(response_json, layer_id)
    return {
        "status": "ok",
        "error": "",
        "payload": payload,
        "response": response_json,
        "counts": counts,
        "raw_classes": raw_classes,
    }


def sample_points(row: Any, mode: str) -> list[tuple[str, float, float]]:
    patch_id = str(row["patch_id"])
    center_lon = as_float(row["center_lon"], "center_lon", patch_id)
    center_lat = as_float(row["center_lat"], "center_lat", patch_id)

    if mode == "center":
        return [("center", center_lon, center_lat)]

    left = as_float(row["bounds_left"], "bounds_left", patch_id)
    right = as_float(row["bounds_right"], "bounds_right", patch_id)
    bottom = as_float(row["bounds_bottom"], "bounds_bottom", patch_id)
    top = as_float(row["bounds_top"], "bounds_top", patch_id)
    min_lon, max_lon = sorted((left, right))
    min_lat, max_lat = sorted((bottom, top))
    lon_inset = (max_lon - min_lon) * 0.1
    lat_inset = (max_lat - min_lat) * 0.1

    return [
        ("center", center_lon, center_lat),
        ("top-left-inner", min_lon + lon_inset, max_lat - lat_inset),
        ("top-right-inner", max_lon - lon_inset, max_lat - lat_inset),
        ("bottom-left-inner", min_lon + lon_inset, min_lat + lat_inset),
        ("bottom-right-inner", max_lon - lon_inset, min_lat + lat_inset),
    ]


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def write_raw_response(raw_response_path: Path, item: dict[str, Any]) -> None:
    serializable = item.copy()
    counts = serializable.get("counts")
    if isinstance(counts, Counter):
        serializable["counts"] = dict(counts)
    with raw_response_path.open("a", encoding="utf-8") as raw_file:
        raw_file.write(json.dumps(serializable, ensure_ascii=False) + "\n")


def choose_feature_class(counts: Counter[str]) -> tuple[str | None, str, float, list[str]]:
    if not counts:
        return None, "not_found", 0.0, []

    total = sum(counts.values())
    winners = counts.most_common()
    hazard_class, winner_count = winners[0]
    unique_classes = [class_value for class_value, _ in winners]
    status = "ok" if len(unique_classes) == 1 else "mixed"
    confidence = winner_count / total if total else 0.0
    return hazard_class, status, confidence, unique_classes


def evaluate_center_mode(point_result: dict[str, Any], layer_id: int) -> dict[str, Any]:
    if point_result["status"] == "request_error":
        return label_result(
            hazard_class="skip",
            status="request_error",
            confidence=0.0,
            points_checked=1,
            points_with_class=0,
            class_votes={},
            raw_classes=[],
            layer_id=layer_id,
        )

    counts = point_result.get("counts", Counter())
    raw_classes = point_result.get("raw_classes", [])
    hazard_class, status, confidence, _ = choose_feature_class(counts)
    if hazard_class is None:
        return label_result("skip", "not_found", 0.0, 1, 0, {}, [], layer_id)

    return label_result(
        hazard_class=hazard_class,
        status=status,
        confidence=confidence,
        points_checked=1,
        points_with_class=1,
        class_votes=dict(counts),
        raw_classes=raw_classes,
        layer_id=layer_id,
    )


def evaluate_five_points_mode(
    point_results: list[dict[str, Any]],
    layer_id: int,
    min_agreement: int,
) -> dict[str, Any]:
    point_votes: Counter[str] = Counter()
    raw_classes: list[str] = []
    had_request_error = False

    for point_result in point_results:
        if point_result["status"] == "request_error":
            had_request_error = True
            continue

        counts = point_result.get("counts", Counter())
        raw_classes.extend(point_result.get("raw_classes", []))
        hazard_class, _, _, _ = choose_feature_class(counts)
        if hazard_class is not None:
            point_votes[hazard_class] += 1

    points_checked = len(point_results)
    points_with_class = sum(point_votes.values())
    if not point_votes:
        status = "request_error" if had_request_error else "not_found"
        return label_result("skip", status, 0.0, points_checked, 0, {}, raw_classes, layer_id)

    hazard_class, winner_count = point_votes.most_common(1)[0]
    confidence = winner_count / points_checked if points_checked else 0.0
    if winner_count >= min_agreement:
        return label_result(
            hazard_class=hazard_class,
            status="ok",
            confidence=confidence,
            points_checked=points_checked,
            points_with_class=points_with_class,
            class_votes=dict(point_votes),
            raw_classes=raw_classes,
            layer_id=layer_id,
        )

    status = "request_error" if had_request_error else "mixed_points"
    return label_result(
        hazard_class="skip",
        status=status,
        confidence=confidence,
        points_checked=points_checked,
        points_with_class=points_with_class,
        class_votes=dict(point_votes),
        raw_classes=raw_classes,
        layer_id=layer_id,
    )


def label_result(
    hazard_class: str,
    status: str,
    confidence: float,
    points_checked: int,
    points_with_class: int,
    class_votes: dict[str, int],
    raw_classes: list[str],
    layer_id: int,
) -> dict[str, Any]:
    return {
        "hazard_class": hazard_class,
        "status": status,
        "confidence": round(confidence, 4),
        "points_checked": points_checked,
        "points_with_class": points_with_class,
        "class_votes": json_dumps(class_votes),
        "raw_classes": json_dumps(raw_classes),
        "layer_id": layer_id,
        "source": DEFAULT_SOURCE,
        "created_at": utc_now(),
    }


def existing_patch_ids(output_csv: Path) -> set[str]:
    if not output_csv.exists():
        return set()

    try:
        existing = pd.read_csv(output_csv, dtype=str, encoding="utf-8-sig")
    except pd.errors.EmptyDataError:
        return set()

    if "patch_id" not in existing.columns:
        return set()
    return set(existing["patch_id"].dropna().astype(str))


def validate_args(args: argparse.Namespace) -> bool:
    if args.limit is not None and args.limit < 0:
        print("--limit must be greater than or equal to 0")
        return False
    if args.delay < 0:
        print("--delay must be greater than or equal to 0")
        return False
    if args.request_size_meters <= 0:
        print("--request-size-meters must be greater than 0")
        return False
    if args.min_agreement <= 0:
        print("--min-agreement must be greater than 0")
        return False
    if args.mode == "center" and args.min_agreement != 1:
        print("NOTE: --min-agreement is ignored in center mode.")
    if args.mode == "five_points" and args.min_agreement > 5:
        print("--min-agreement cannot be greater than 5 in five_points mode")
        return False
    if not args.metadata.exists():
        print(f"Metadata CSV was not found: {args.metadata}")
        return False
    return True


def validate_metadata(metadata: Any) -> bool:
    missing_columns = [column for column in REQUIRED_METADATA_COLUMNS if column not in metadata.columns]
    if missing_columns:
        print(f"Metadata CSV is missing required columns: {', '.join(missing_columns)}")
        return False
    return True


def append_label_row(output_csv: Path, row: dict[str, Any], append: bool) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append else "w"
    with output_csv.open(mode, newline="", encoding="utf-8-sig") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=LABEL_COLUMNS)
        if not append:
            writer.writeheader()
        writer.writerow(row)


def build_output_row(metadata_row: Any, label_data: dict[str, Any]) -> dict[str, Any]:
    output_row = {
        "patch_id": str(metadata_row["patch_id"]),
        "patch_path": str(metadata_row["patch_path"]),
        "source_file": str(metadata_row["source_file"]),
        "center_lon": metadata_row["center_lon"],
        "center_lat": metadata_row["center_lat"],
    }
    output_row.update(label_data)
    return output_row


def process_patch(
    metadata_row: Any,
    session: requests.Session,
    transformer: Transformer,
    args: argparse.Namespace,
    raw_response_path: Path | None,
) -> dict[str, Any]:
    patch_id = str(metadata_row["patch_id"])
    points = sample_points(metadata_row, args.mode)
    point_results: list[dict[str, Any]] = []

    for point_name, lon, lat in points:
        point_result = identify_point(
            session=session,
            transformer=transformer,
            endpoint=args.endpoint,
            layer_id=args.layer_id,
            lon=lon,
            lat=lat,
            request_size_meters=args.request_size_meters,
        )
        point_result["point"] = point_name
        point_result["lon"] = lon
        point_result["lat"] = lat
        point_results.append(point_result)

        if raw_response_path is not None:
            write_raw_response(
                raw_response_path,
                {
                    "patch_id": patch_id,
                    "layer_id": args.layer_id,
                    **point_result,
                },
            )

        if args.delay > 0:
            time.sleep(args.delay)

    if args.mode == "center":
        return evaluate_center_mode(point_results[0], args.layer_id)
    return evaluate_five_points_mode(point_results, args.layer_id, args.min_agreement)


def main() -> int:
    args = parse_args()
    if not load_dependencies():
        return 1
    if not validate_args(args):
        return 1

    metadata = pd.read_csv(args.metadata, encoding="utf-8-sig")
    if not validate_metadata(metadata):
        return 1

    already_labeled = existing_patch_ids(args.output) if args.resume else set()
    metadata_rows = metadata.to_dict("records")
    if args.limit is not None:
        metadata_rows = metadata_rows[: args.limit]

    append = args.resume and args.output.exists() and args.output.stat().st_size > 0
    raw_response_path = args.output.with_suffix(".raw_responses.jsonl") if args.save_raw_response else None
    if raw_response_path is not None and not append:
        raw_response_path.parent.mkdir(parents=True, exist_ok=True)
        raw_response_path.write_text("", encoding="utf-8")

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "FireForest-Monitor/1.0 patch-labeling"})

    processed_count = 0
    skipped_count = 0
    for metadata_row in metadata_rows:
        patch_id = str(metadata_row["patch_id"])
        if patch_id in already_labeled:
            skipped_count += 1
            continue

        try:
            label_data = process_patch(metadata_row, session, transformer, args, raw_response_path)
        except ValueError as exc:
            print(f"WARNING: {exc}")
            label_data = label_result(
                hazard_class="skip",
                status="invalid_metadata",
                confidence=0.0,
                points_checked=0,
                points_with_class=0,
                class_votes={},
                raw_classes=[],
                layer_id=args.layer_id,
            )

        output_row = build_output_row(metadata_row, label_data)
        append_label_row(args.output, output_row, append=append or processed_count > 0)
        processed_count += 1
        print(
            f"{processed_count}: {patch_id} -> "
            f"class={output_row['hazard_class']} status={output_row['status']}"
        )

    print(f"Labels CSV saved to: {args.output}")
    print(f"Processed patches: {processed_count}")
    if args.resume:
        print(f"Skipped already labeled patches: {skipped_count}")
    if raw_response_path is not None:
        print(f"Raw responses saved to: {raw_response_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
