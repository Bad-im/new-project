from __future__ import annotations

from pathlib import Path
from typing import Optional

INPUT_CSV = Path(r"C:\labs\Патчи_Full\metadata\train_dataset_v2.csv")
SPLITS_DIR = Path(r"C:\labs\Патчи_Full\metadata\splits_v2")

TRAIN_CSV = SPLITS_DIR / "train.csv"
VAL_CSV = SPLITS_DIR / "val.csv"
TEST_CSV = SPLITS_DIR / "test.csv"

EXPECTED_CLASSES = {1, 2, 3, 4, 5}
RANDOM_STATE = 42

pd = None
train_test_split = None


def load_dependencies() -> bool:
    global pd, train_test_split

    try:
        import pandas as pandas_module
        from sklearn.model_selection import train_test_split as split_function
    except ModuleNotFoundError as exc:
        print(
            "Missing ML dependency: "
            f"{exc.name}. Install dependencies with: pip install -r ml/requirements-ml.txt"
        )
        return False

    pd = pandas_module
    train_test_split = split_function
    return True


def print_class_distribution(df, title: str) -> None:
    counts = df["hazard_class"].value_counts().sort_index()
    percents = (counts / len(df) * 100).round(2) if len(df) else counts

    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)
    print(f"Rows: {len(df)}")

    print("\nClass counts:")
    for hazard_class, count in counts.items():
        print(f"  class {hazard_class}: {count}")

    print("\nClass percentages:")
    for hazard_class, percent in percents.items():
        print(f"  class {hazard_class}: {percent}%")


def validate_columns(df) -> bool:
    required_columns = [
        "patch_id",
        "patch_path",
        "hazard_class",
        "band_count",
        "valid_ratio",
        "source_folder",
        "center_lon",
        "center_lat",
    ]

    missing_columns = [column for column in required_columns if column not in df.columns]

    if missing_columns:
        print("CSV is missing required columns:")
        for column in missing_columns:
            print(f"  {column}")
        return False

    return True


def normalize_hazard_class(df):
    normalized = df.copy()

    converted = pd.to_numeric(normalized["hazard_class"], errors="coerce")
    invalid_mask = converted.isna() | (converted % 1 != 0)

    if invalid_mask.any():
        unexpected_values = sorted(
            normalized.loc[invalid_mask, "hazard_class"].astype(str).unique()
        )
        print("hazard_class contains non-integer or empty values:")
        for value in unexpected_values:
            print(f"  {value}")
        return None

    normalized["hazard_class"] = converted.astype(int)

    actual_classes = set(normalized["hazard_class"].dropna().unique())
    unexpected_classes = sorted(actual_classes - EXPECTED_CLASSES)
    missing_classes = sorted(EXPECTED_CLASSES - actual_classes)

    if unexpected_classes:
        print("Unexpected hazard_class values found:")
        for value in unexpected_classes:
            print(f"  {value}")
        print(f"Expected only classes: {sorted(EXPECTED_CLASSES)}")
        return None

    if missing_classes:
        print("Warning: some expected classes are missing:")
        for value in missing_classes:
            print(f"  class {value}")

    return normalized


def save_split(df, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")


def main() -> int:
    if not load_dependencies():
        return 1

    if not INPUT_CSV.exists():
        print(f"Input CSV not found: {INPUT_CSV}")
        return 1

    print(f"Input CSV: {INPUT_CSV}")
    print(f"Splits directory: {SPLITS_DIR}")

    df = pd.read_csv(INPUT_CSV)

    if not validate_columns(df):
        return 1

    df = normalize_hazard_class(df)
    if df is None:
        return 1

    print_class_distribution(df, "FULL DATASET")

    # 70% train, 30% temporary set.
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=df["hazard_class"],
    )

    # Split remaining 30% into 15% validation and 15% test.
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=temp_df["hazard_class"],
    )

    save_split(train_df, TRAIN_CSV)
    save_split(val_df, VAL_CSV)
    save_split(test_df, TEST_CSV)

    print("\nSaved split files:")
    print(f"  train: {TRAIN_CSV}")
    print(f"  val:   {VAL_CSV}")
    print(f"  test:  {TEST_CSV}")

    print_class_distribution(train_df, "TRAIN SPLIT")
    print_class_distribution(val_df, "VALIDATION SPLIT")
    print_class_distribution(test_df, "TEST SPLIT")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())