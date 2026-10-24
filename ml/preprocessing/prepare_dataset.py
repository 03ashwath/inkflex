"""Prepare the India image/location tattoo price dataset for model training.

Reads ml/data/tattoo_price_dataset_india_image_location.csv and writes three files to
ml/data/processed/:
  rates.csv      per-sq-in rate targets, deduplicated (rows differ only by image)
  locations.csv  one row per location with its published/proxy rates and minimum charge
  images.csv     per-image complexity, color, minimum readable size and pixel size
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))

from ml.pricing import RATE_TARGETS, location_key  # noqa: E402

DATA_DIR = ROOT / "data"
SOURCE = DATA_DIR / "tattoo_price_dataset_india_image_location.csv"
IMAGE_DIR = DATA_DIR / "Tattoo_img_200"
OUTPUT_DIR = DATA_DIR / "processed"

LOCATION_COLUMNS = [
    "location_key", "location_name", "location_type", "state_ut", "district", "parent_city",
    "per_sq_in_rate_min_inr", "per_sq_in_rate_max_inr", "minimum_studio_charge_inr", "price_source_type",
]
GROUP_COLUMNS = ["location_key", "location_name", "location_type", "state_ut", "parent_city", "complexity", "color", "area_sq_in"]


def load_source(source: Path) -> pd.DataFrame:
    if not source.exists():
        raise FileNotFoundError(f"Training dataset not found: {source}")
    df = pd.read_csv(source, low_memory=False)
    required = set(LOCATION_COLUMNS[1:] + ["image_name", "complexity", "color", "tattoo_width_in", "tattoo_height_in",
                                            "area_sq_in", "minimum_width_in", "minimum_height_in", *RATE_TARGETS.values()])
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    for column in ["location_name", "location_type", "state_ut", "district", "parent_city", "complexity", "color", "image_name"]:
        df[column] = df[column].astype("string").str.strip()
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=["area_sq_in", *RATE_TARGETS.values()])
    df = df[(df["area_sq_in"] > 0) & (df["accurate_price_inr"] > 0)]
    df["location_key"] = [location_key(n, t, s) for n, t, s in zip(df["location_name"], df["location_type"], df["state_ut"])]
    return df


def build_rates(df: pd.DataFrame) -> pd.DataFrame:
    """One row per location/complexity/color/size with per-sq-in rates.

    A rate is marked as floored when the price sat at the minimum studio charge (within rounding),
    because the per-inch rate is not observable for those rows.
    """
    rates = df[GROUP_COLUMNS + list(RATE_TARGETS.values()) + ["minimum_studio_charge_inr"]].copy()
    for name, price_column in RATE_TARGETS.items():
        rates[f"rate_{name}"] = rates[price_column] / rates["area_sq_in"]
        rates[f"floored_{name}"] = rates[price_column] <= rates["minimum_studio_charge_inr"] + 50
    aggregations = {column: "mean" for column in rates.columns if column not in GROUP_COLUMNS}
    grouped = rates.groupby(GROUP_COLUMNS, dropna=False).agg(aggregations)
    grouped["weight"] = rates.groupby(GROUP_COLUMNS, dropna=False).size()
    grouped = grouped.reset_index()
    for name in RATE_TARGETS:
        grouped[f"floored_{name}"] = grouped[f"floored_{name}"] > 0.5
    return grouped


def build_images(df: pd.DataFrame, image_dir: Path) -> pd.DataFrame:
    images = df.groupby("image_name").agg(
        complexity=("complexity", "first"),
        color=("color", "first"),
        min_width_in=("minimum_width_in", "first"),
        min_height_in=("minimum_height_in", "first"),
        label_variants=("complexity", "nunique"),
    ).reset_index()
    if (images["label_variants"] > 1).any():
        raise ValueError("Some images have more than one complexity label.")
    sizes = []
    for name in images["image_name"]:
        path = image_dir / name
        if path.is_file():
            with Image.open(path) as image:
                sizes.append(image.size)
        else:
            sizes.append((np.nan, np.nan))
    images["pixel_width"], images["pixel_height"] = zip(*sizes)
    return images.drop(columns="label_variants")


def prepare_dataset(source: Path = SOURCE, image_dir: Path = IMAGE_DIR, output_dir: Path = OUTPUT_DIR) -> None:
    df = load_source(Path(source))
    output_dir.mkdir(parents=True, exist_ok=True)

    rates = build_rates(df)
    locations = df[LOCATION_COLUMNS].drop_duplicates("location_key").sort_values("location_key")
    images = build_images(df, Path(image_dir))

    rates.to_csv(output_dir / "rates.csv", index=False)
    locations.to_csv(output_dir / "locations.csv", index=False)
    images.to_csv(output_dir / "images.csv", index=False)
    missing_files = images["pixel_width"].isna().sum()
    print(f"Source rows: {len(df):,}")
    print(f"Rate rows: {len(rates):,} (floored mid rates: {rates['floored_mid'].sum():,})")
    print(f"Locations: {len(locations):,}")
    print(f"Images: {len(images):,} ({missing_files} without a file in {image_dir})")
    print(f"Wrote {output_dir}")


if __name__ == "__main__":
    prepare_dataset()
