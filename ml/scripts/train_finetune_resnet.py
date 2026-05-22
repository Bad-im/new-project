from __future__ import annotations

import argparse
import random
from pathlib import Path
from typing import Any


DEFAULT_TRAIN_CSV = Path(r"C:\labs\Патчи_Full\metadata\splits_v2\train.csv")
DEFAULT_VAL_CSV = Path(r"C:\labs\Патчи_Full\metadata\splits_v2\val.csv")
DEFAULT_TEST_CSV = Path(r"C:\labs\Патчи_Full\metadata\splits_v2\test.csv")
DEFAULT_OUTPUT_DIR = Path("ml/outputs/finetune_resnet18_v1")
EXPECTED_CLASSES = [1, 2, 3, 4, 5]
EXPECTED_BAND_COUNT = 7

np = None
pd = None
rasterio = None
torch = None
F = None
nn = None
DataLoader = None
models = None
f1_score = None
accuracy_score = None
classification_report = None
confusion_matrix = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune an ImageNet-pretrained ResNet18 on 7-band Sentinel-2 fire hazard patches."
    )
    parser.add_argument("--train-csv", type=Path, default=DEFAULT_TRAIN_CSV)
    parser.add_argument("--val-csv", type=Path, default=DEFAULT_VAL_CSV)
    parser.add_argument("--test-csv", type=Path, default=DEFAULT_TEST_CSV)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=0.0001)
    parser.add_argument("--weight-decay", type=float, default=0.0001)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def load_dependencies() -> bool:
    global DataLoader, F, accuracy_score, classification_report, confusion_matrix
    global f1_score, models, nn, np, pd, rasterio, torch

    try:
        import numpy as numpy_module
        import pandas as pandas_module
        import rasterio as rasterio_module
        import torch as torch_module
        import torch.nn as nn_module
        import torch.nn.functional as functional_module
        import torchvision.models as torchvision_models
        from sklearn.metrics import (
            accuracy_score as accuracy_score_function,
            classification_report as classification_report_function,
            confusion_matrix as confusion_matrix_function,
            f1_score as f1_score_function,
        )
        from torch.utils.data import DataLoader as DataLoaderClass
    except (ImportError, ModuleNotFoundError) as exc:
        dependency_name = getattr(exc, "name", None) or str(exc)
        print(
            "Missing ML dependency: "
            f"{dependency_name}. Install dependencies with: pip install -r ml/requirements-ml.txt"
        )
        return False

    np = numpy_module
    pd = pandas_module
    rasterio = rasterio_module
    torch = torch_module
    nn = nn_module
    F = functional_module
    models = torchvision_models
    DataLoader = DataLoaderClass
    f1_score = f1_score_function
    accuracy_score = accuracy_score_function
    classification_report = classification_report_function
    confusion_matrix = confusion_matrix_function
    return True


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def validate_args(args: argparse.Namespace) -> bool:
    if args.epochs <= 0:
        print("--epochs must be greater than 0")
        return False
    if args.batch_size <= 0:
        print("--batch-size must be greater than 0")
        return False
    if args.lr <= 0:
        print("--lr must be greater than 0")
        return False
    if args.weight_decay < 0:
        print("--weight-decay must be greater than or equal to 0")
        return False
    if args.img_size <= 0:
        print("--img-size must be greater than 0")
        return False
    if args.num_workers < 0:
        print("--num-workers must be greater than or equal to 0")
        return False

    for csv_path in (args.train_csv, args.val_csv, args.test_csv):
        if not csv_path.exists():
            print(f"CSV file was not found: {csv_path}")
            return False
    return True


def load_split_csv(csv_path: Path, split_name: str) -> Any:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
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
        raise ValueError(f"{split_name} CSV is missing columns: {', '.join(missing_columns)}")

    hazard_class = pd.to_numeric(df["hazard_class"], errors="coerce")
    invalid_mask = hazard_class.isna() | (hazard_class % 1 != 0)
    if invalid_mask.any():
        values = sorted(df.loc[invalid_mask, "hazard_class"].astype(str).unique())
        raise ValueError(f"{split_name} CSV has non-integer hazard_class values: {values}")

    df = df.copy()
    df["hazard_class"] = hazard_class.astype(int)
    unexpected_classes = sorted(set(df["hazard_class"].unique()) - set(EXPECTED_CLASSES))
    if unexpected_classes:
        raise ValueError(
            f"{split_name} CSV has unexpected hazard_class values: {unexpected_classes}. "
            f"Expected only {EXPECTED_CLASSES}."
        )

    band_count = pd.to_numeric(df["band_count"], errors="coerce")
    invalid_band_count = band_count.isna() | (band_count % 1 != 0)
    if invalid_band_count.any():
        values = sorted(df.loc[invalid_band_count, "band_count"].astype(str).unique())
        raise ValueError(f"{split_name} CSV has invalid band_count values: {values}")

    unexpected_band_counts = sorted(set(band_count.astype(int)))
    if unexpected_band_counts != [EXPECTED_BAND_COUNT]:
        raise ValueError(
            f"{split_name} CSV has band_count values {unexpected_band_counts}; "
            f"expected only {EXPECTED_BAND_COUNT}."
        )

    return df


def print_class_distribution(df: Any, title: str) -> None:
    counts = df["hazard_class"].value_counts().reindex(EXPECTED_CLASSES, fill_value=0).sort_index()
    percents = (counts / len(df) * 100).round(2) if len(df) else counts
    print(title)
    print("Class counts:")
    for hazard_class, count in counts.items():
        print(f"  class {hazard_class}: {count}")
    print("Class percentages:")
    for hazard_class, percent in percents.items():
        print(f"  class {hazard_class}: {percent}%")


def class_weights_from_train(train_df: Any, device: Any) -> Any:
    counts = train_df["hazard_class"].value_counts().reindex(EXPECTED_CLASSES, fill_value=0).sort_index()
    if (counts == 0).any():
        missing = [str(class_id) for class_id, count in counts.items() if count == 0]
        raise ValueError(f"Cannot compute class weights; missing train classes: {', '.join(missing)}")

    total = int(counts.sum())
    weights = [total / (len(EXPECTED_CLASSES) * int(count)) for count in counts]
    weight_tensor = torch.tensor(weights, dtype=torch.float32, device=device)
    print("Class weights for weighted CrossEntropyLoss:")
    for hazard_class, weight in zip(EXPECTED_CLASSES, weights, strict=True):
        print(f"  class {hazard_class}: {weight:.6f}")
    return weight_tensor


def ensure_dataset_dependencies() -> None:
    global np, rasterio, torch

    if np is None:
        import numpy as numpy_module

        np = numpy_module
    if rasterio is None:
        import rasterio as rasterio_module

        rasterio = rasterio_module
    if torch is None:
        import torch as torch_module

        torch = torch_module


class FireForestPatchDataset:
    def __init__(self, df: Any) -> None:
        self.rows = df.reset_index(drop=True)

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> tuple[Any, Any]:
        ensure_dataset_dependencies()

        row = self.rows.iloc[index]
        patch_path = Path(str(row["patch_path"]))
        hazard_class = int(row["hazard_class"])
        label = hazard_class - 1

        with rasterio.open(patch_path) as src:
            data = src.read().astype(np.float32)

        if data.shape[0] != EXPECTED_BAND_COUNT:
            raise ValueError(
                f"Patch {patch_path} has {data.shape[0]} bands; expected {EXPECTED_BAND_COUNT}."
            )

        data = np.nan_to_num(data, nan=0.0, posinf=1.0, neginf=0.0)
        if data.min() < 0.0 or data.max() > 1.0:
            data = np.clip(data, 0.0, 1.0)

        image = torch.from_numpy(data)
        target = torch.tensor(label, dtype=torch.long)
        return image, target


def build_model(num_classes: int = 5, in_channels: int = 7) -> Any:
    try:
        weights = models.ResNet18_Weights.IMAGENET1K_V1
        model = models.resnet18(weights=weights)
    except AttributeError:
        model = models.resnet18(pretrained=True)

    old_conv = model.conv1
    new_conv = nn.Conv2d(
        in_channels=in_channels,
        out_channels=old_conv.out_channels,
        kernel_size=old_conv.kernel_size,
        stride=old_conv.stride,
        padding=old_conv.padding,
        bias=False,
    )

    # Adapt the first ResNet18 convolution from ImageNet RGB to 7 Sentinel-2 channels.
    with torch.no_grad():
        new_conv.weight[:, :3, :, :] = old_conv.weight
        extra_channel_weights = old_conv.weight.mean(dim=1, keepdim=True)
        new_conv.weight[:, 3:, :, :] = extra_channel_weights.repeat(1, in_channels - 3, 1, 1)

    model.conv1 = new_conv
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def resize_batch(images: Any, img_size: int) -> Any:
    if images.shape[-2:] == (img_size, img_size):
        return images
    return F.interpolate(images, size=(img_size, img_size), mode="bilinear", align_corners=False)


def train_one_epoch(model: Any, dataloader: Any, criterion: Any, optimizer: Any, device: Any, img_size: int) -> float:
    model.train()
    total_loss = 0.0
    total_samples = 0

    for images, targets in dataloader:
        images = resize_batch(images.to(device, non_blocking=True), img_size)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)
        logits = model(images)
        loss = criterion(logits, targets)
        loss.backward()
        optimizer.step()

        batch_size = images.size(0)
        total_loss += float(loss.item()) * batch_size
        total_samples += batch_size

    return total_loss / total_samples if total_samples else 0.0


def evaluate(model: Any, dataloader: Any, criterion: Any, device: Any, img_size: int) -> dict[str, Any]:
    model.eval()
    total_loss = 0.0
    total_samples = 0
    y_true: list[int] = []
    y_pred: list[int] = []

    with torch.no_grad():
        for images, targets in dataloader:
            images = resize_batch(images.to(device, non_blocking=True), img_size)
            targets = targets.to(device, non_blocking=True)
            logits = model(images)
            loss = criterion(logits, targets)
            predictions = torch.argmax(logits, dim=1)

            batch_size = images.size(0)
            total_loss += float(loss.item()) * batch_size
            total_samples += batch_size
            y_true.extend(targets.cpu().numpy().tolist())
            y_pred.extend(predictions.cpu().numpy().tolist())

    loss_value = total_loss / total_samples if total_samples else 0.0
    accuracy = accuracy_score(y_true, y_pred) if y_true else 0.0
    macro_f1 = f1_score(y_true, y_pred, average="macro", labels=list(range(5)), zero_division=0) if y_true else 0.0
    return {
        "loss": loss_value,
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "y_true": y_true,
        "y_pred": y_pred,
    }


def save_checkpoint(path: Path, model: Any, epoch: int, args: argparse.Namespace, metrics: dict[str, float]) -> None:
    saved_args = {
        key: str(value) if isinstance(value, Path) else value
        for key, value in vars(args).items()
    }
    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "metrics": metrics,
            "class_mapping": {class_id: class_id - 1 for class_id in EXPECTED_CLASSES},
            "args": saved_args,
        },
        path,
    )


def test_model(model: Any, checkpoint_path: Path, dataloader: Any, criterion: Any, device: Any, args: argparse.Namespace) -> None:
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    result = evaluate(model, dataloader, criterion, device, args.img_size)

    target_names = [f"class_{class_id}" for class_id in EXPECTED_CLASSES]
    report = classification_report(
        result["y_true"],
        result["y_pred"],
        labels=list(range(5)),
        target_names=target_names,
        zero_division=0,
    )
    matrix = confusion_matrix(result["y_true"], result["y_pred"], labels=list(range(5)))
    matrix_df = pd.DataFrame(
        matrix,
        index=[f"true_{name}" for name in target_names],
        columns=[f"pred_{name}" for name in target_names],
    )

    report_path = args.output_dir / "classification_report_test.txt"
    matrix_path = args.output_dir / "confusion_matrix_test.csv"
    report_path.write_text(report, encoding="utf-8")
    matrix_df.to_csv(matrix_path, encoding="utf-8-sig")

    print("Test results:")
    print(f"  accuracy: {result['accuracy']:.4f}")
    print(f"  macro F1: {result['macro_f1']:.4f}")
    print(report)
    print(f"Classification report saved to: {report_path}")
    print(f"Confusion matrix saved to: {matrix_path}")


def main() -> int:
    args = parse_args()
    if not load_dependencies():
        return 1
    if not validate_args(args):
        return 1

    set_seed(args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    try:
        train_df = load_split_csv(args.train_csv, "train")
        val_df = load_split_csv(args.val_csv, "val")
        test_df = load_split_csv(args.test_csv, "test")
    except ValueError as exc:
        print(exc)
        return 1

    print_class_distribution(train_df, "Train distribution:")
    print_class_distribution(val_df, "Val distribution:")
    print_class_distribution(test_df, "Test distribution:")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    try:
        class_weights = class_weights_from_train(train_df, device)
    except ValueError as exc:
        print(exc)
        return 1

    train_loader = DataLoader(
        FireForestPatchDataset(train_df),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        FireForestPatchDataset(val_df),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )
    test_loader = DataLoader(
        FireForestPatchDataset(test_df),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )

    model = build_model(num_classes=len(EXPECTED_CLASSES), in_channels=EXPECTED_BAND_COUNT).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)

    metrics_rows: list[dict[str, float | int]] = []
    best_val_macro_f1 = -1.0
    best_model_path = args.output_dir / "best_model.pt"
    last_model_path = args.output_dir / "last_model.pt"
    metrics_path = args.output_dir / "metrics.csv"

    for epoch in range(1, args.epochs + 1):
        train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device, args.img_size)
        val_result = evaluate(model, val_loader, criterion, device, args.img_size)
        epoch_metrics = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_result["loss"],
            "val_accuracy": val_result["accuracy"],
            "val_macro_f1": val_result["macro_f1"],
        }

        if val_result["macro_f1"] > best_val_macro_f1:
            best_val_macro_f1 = val_result["macro_f1"]
            save_checkpoint(best_model_path, model, epoch, args, epoch_metrics)

        epoch_metrics["best_val_macro_f1"] = best_val_macro_f1
        metrics_rows.append(epoch_metrics)
        pd.DataFrame(metrics_rows).to_csv(metrics_path, index=False, encoding="utf-8-sig")
        save_checkpoint(last_model_path, model, epoch, args, epoch_metrics)

        print(
            f"Epoch {epoch}/{args.epochs} "
            f"train_loss={train_loss:.4f} "
            f"val_loss={val_result['loss']:.4f} "
            f"val_acc={val_result['accuracy']:.4f} "
            f"val_macro_f1={val_result['macro_f1']:.4f} "
            f"best_val_macro_f1={best_val_macro_f1:.4f}"
        )

    print(f"Best model saved to: {best_model_path}")
    print(f"Last model saved to: {last_model_path}")
    print(f"Metrics saved to: {metrics_path}")

    test_model(model, best_model_path, test_loader, criterion, device, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
