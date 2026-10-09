"""Prepare the tattoo pricing dataset for model training.

Supports the archived v3 dataset as well as the current India training file.
"""

from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
LEGACY_SOURCE = DATA_DIR / "tattoo_price_dataset_v3.csv"
CURRENT_SOURCE = DATA_DIR / "tattoo_price_training_india_100k_clean.csv"
OUTPUT = DATA_DIR / "tattoo_price_model_ready_v4.csv"

FEATURES = [
    "area_sq_in",
    "placement",
    "country",
    "city",
    "style",
    "complexity_score",
    "color_type",
    "artist_level",
    "design_type",
]
TARGET = "price_usd"


def _normalize_legacy_dataset(df: pd.DataFrame) -> pd.DataFrame:
    out = df[FEATURES + [TARGET]].copy()

    for column in [
        "placement",
        "country",
        "city",
        "style",
        "color_type",
        "artist_level",
        "design_type",
    ]:
        out[column] = out[column].astype("string").str.strip()

    for column in ["area_sq_in", "complexity_score", TARGET]:
        out[column] = pd.to_numeric(out[column], errors="coerce")

    out = out.replace([np.inf, -np.inf], np.nan).dropna()
    out = out[
        (out["area_sq_in"] > 0)
        & out["complexity_score"].between(1, 5)
        & (out[TARGET] > 0)
    ].drop_duplicates().reset_index(drop=True)
    return out


def _normalize_current_dataset(df: pd.DataFrame) -> pd.DataFrame:
    size_to_placement = {
        "tiny": "Wrist",
        "small": "Wrist",
        "medium": "Forearm",
        "large": "Forearm",
        "small-custom": "Forearm",
        "medium-custom": "Forearm",
        "large-standalone": "Forearm",
        "half-sleeve": "Half Sleeve",
        "full-sleeve": "Full Sleeve",
        "full-back": "Back",
    }
    complexity_map = {"Simple": 1, "Medium": 2, "Complex": 3, "Intricate": 4}

    out = pd.DataFrame({
        "area_sq_in": pd.to_numeric(df["area_sq_in"], errors="coerce"),
        "placement": df["size_id"].map(size_to_placement).fillna("Forearm"),
        "country": "India",
        "city": df["city"].astype("string").str.strip(),
        "style": np.where(df["color"].astype("string").str.contains("Gray|Black", case=False, na=False), "Blackwork", "Realism"),
        "complexity_score": df["complexity"].map(complexity_map).fillna(2),
        "color_type": np.where(df["color"].astype("string").str.contains("Gray|Black", case=False, na=False), "Black and grey", "Color"),
        "artist_level": "Established",
        "design_type": np.where(df["size_id"].astype("string").str.contains("custom|standalone", case=False, na=False), "Custom design", "Flash design"),
        "price_usd": pd.to_numeric(df["price_inr"], errors="coerce") / 83.0,
    })

    out = out.replace([np.inf, -np.inf], np.nan).dropna()
    out = out[
        (out["area_sq_in"] > 0)
        & out["complexity_score"].between(1, 5)
        & (out["price_usd"] > 0)
    ].drop_duplicates().reset_index(drop=True)
    return out


def prepare_dataset(source=None, output=OUTPUT):
    output = Path(output)
    if source is None:
        source = LEGACY_SOURCE if LEGACY_SOURCE.exists() else CURRENT_SOURCE
    source = Path(source)

    if not source.exists():
        raise FileNotFoundError(f"Training dataset not found: {source}")

    df = pd.read_csv(source)
    if {"price_usd"}.issubset(df.columns):
        out = _normalize_legacy_dataset(df)
    elif {"price_inr"}.issubset(df.columns):
        out = _normalize_current_dataset(df)
    else:
        raise ValueError(f"Could not prepare dataset '{source}' because it does not match the expected price schema.")

    output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output, index=False)
    print(f"Prepared {len(out):,} rows -> {output}")


if __name__ == "__main__":
    prepare_dataset()
