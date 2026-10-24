"""Train the tattoo price model on the prepared India image/location dataset.

Run ml/preprocessing/prepare_dataset.py first. The model predicts log per-sq-in rates
(min, mid, max); ml/pricing.py turns those into prices for any width x height.

Two held-out evaluations are reported before the final fit on all data:
  unseen locations   20% of locations are held out entirely
  size extrapolation train on sizes up to 4x4 in, test on 5x5 in
"""

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, TargetEncoder

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

from ml.pricing import (  # noqa: E402
    NUMERIC_FEATURES, ONE_HOT_FEATURES, RATE_TARGETS, TARGET_ENCODED_FEATURES, UNKNOWN, build_features, round_price,
)

PROCESSED_DIR = ROOT / "data" / "processed"
MODEL_PATH = ROOT / "saved_models" / "price_model_v2.joblib"
METRICS_PATH = ROOT / "saved_models" / "price_model_v2_metrics.json"
PRICE_BANDS = [0, 5_000, 20_000, np.inf]
PRICE_BAND_LABELS = ["< INR 5k", "INR 5k-20k", "> INR 20k"]


def make_model() -> Pipeline:
    preprocessor = ColumnTransformer([
        ("target", TargetEncoder(target_type="continuous", random_state=42), TARGET_ENCODED_FEATURES),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ONE_HOT_FEATURES),
        ("numeric", "passthrough", NUMERIC_FEATURES),
    ])
    regressor = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.08, max_leaf_nodes=31, random_state=42)
    return Pipeline([("preprocessor", preprocessor), ("model", regressor)])


def fit_rate_models(rates: pd.DataFrame) -> dict:
    models = {}
    for name in RATE_TARGETS:
        rows = rates[~rates[f"floored_{name}"]]
        model = make_model()
        print(
            f"  Training {name} rate model: {len(rows):,} rows "
            f"({len(rates) - len(rows):,} minimum-charge rows excluded)...",
            flush=True,
        )
        started = time.perf_counter()
        model.fit(build_features(rows), np.log(rows[f"rate_{name}"]), model__sample_weight=rows["weight"])
        print(f"  Finished {name} rate model in {time.perf_counter() - started:.1f}s", flush=True)
        models[name] = model
    return models


def predict_prices(models: dict, rows: pd.DataFrame, min_charge: pd.Series) -> pd.DataFrame:
    features = build_features(rows)
    rates = np.sort(np.column_stack([np.exp(models[name].predict(features)) for name in ("min", "mid", "max")]), axis=1)
    out = {}
    for index, name in enumerate(("min", "mid", "max")):
        raw = np.maximum(rates[:, index] * rows["area_sq_in"].to_numpy(), min_charge.to_numpy())
        out[name] = [round_price(value) for value in raw]
    return pd.DataFrame(out, index=rows.index)


def price_metrics(actual: pd.Series, predicted: pd.DataFrame, weight: pd.Series, low: pd.Series, high: pd.Series) -> dict:
    error = (predicted["mid"] - actual).abs()
    pct = error / actual * 100
    covered = (predicted["mid"] >= low) & (predicted["mid"] <= high)
    metrics = {
        "rows": int(weight.sum()),
        "mae_inr": float(np.average(error, weights=weight)),
        "mape_pct": float(np.average(pct, weights=weight)),
        "r2": float(r2_score(actual, predicted["mid"], sample_weight=weight)),
        "mid_within_dataset_range_pct": float(np.average(covered, weights=weight) * 100),
        "by_price_band": {},
    }
    bands = pd.cut(actual, PRICE_BANDS, labels=PRICE_BAND_LABELS)
    for label in PRICE_BAND_LABELS:
        mask = bands == label
        if mask.any():
            metrics["by_price_band"][label] = {
                "rows": int(weight[mask].sum()),
                "mae_inr": float(np.average(error[mask], weights=weight[mask])),
                "mape_pct": float(np.average(pct[mask], weights=weight[mask])),
            }
    return metrics


def fallback_min_charge(train_locations: pd.DataFrame, test_rows: pd.DataFrame) -> pd.Series:
    """Minimum charge for locations the model has never seen: the state median, else the overall median."""
    by_state = train_locations.groupby("state_ut")["minimum_studio_charge_inr"].median()
    overall = train_locations["minimum_studio_charge_inr"].median()
    return test_rows["state_ut"].map(by_state).fillna(overall)


def evaluate_unseen_locations(rates: pd.DataFrame, locations: pd.DataFrame) -> dict:
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_index, test_index = next(splitter.split(rates, groups=rates["location_key"]))
    train, test = rates.iloc[train_index], rates.iloc[test_index].copy()
    models = fit_rate_models(train)
    test["location_key"] = UNKNOWN
    train_locations = locations[locations["location_key"].isin(train["location_key"])]
    predicted = predict_prices(models, test, fallback_min_charge(train_locations, test))
    return price_metrics(test["accurate_price_inr"], predicted, test["weight"], test["min_price_inr"], test["max_price_inr"])


def evaluate_size_extrapolation(rates: pd.DataFrame) -> dict:
    train, test = rates[rates["area_sq_in"] <= 16], rates[rates["area_sq_in"] > 16]
    models = fit_rate_models(train)
    predicted = predict_prices(models, test, test["minimum_studio_charge_inr"])
    return price_metrics(test["accurate_price_inr"], predicted, test["weight"], test["min_price_inr"], test["max_price_inr"])


def print_metrics(title: str, metrics: dict) -> None:
    print(f"\n{title} (n={metrics['rows']:,})")
    print(f"  MAE: INR {metrics['mae_inr']:,.0f}   MAPE: {metrics['mape_pct']:.2f}%   R2: {metrics['r2']:.4f}")
    print(f"  Mid estimate inside the dataset min-max range: {metrics['mid_within_dataset_range_pct']:.1f}%")
    for label, band in metrics["by_price_band"].items():
        print(f"  {label:>8}: n={band['rows']:,}  MAE=INR {band['mae_inr']:,.0f}  MAPE={band['mape_pct']:.2f}%")


def train_model() -> None:
    print("Loading prepared training data...", flush=True)
    for name in ("rates.csv", "locations.csv", "images.csv"):
        if not (PROCESSED_DIR / name).is_file():
            raise FileNotFoundError(f"{PROCESSED_DIR / name} not found; run ml/preprocessing/prepare_dataset.py first.")
    rates = pd.read_csv(PROCESSED_DIR / "rates.csv")
    locations = pd.read_csv(PROCESSED_DIR / "locations.csv")
    images = pd.read_csv(PROCESSED_DIR / "images.csv")
    print(
        f"Loaded {len(rates):,} rate rows, {len(locations):,} locations, "
        f"and {len(images):,} images.",
        flush=True,
    )

    print("\nEvaluating held-out unseen locations...", flush=True)
    metrics = {"unseen_locations": evaluate_unseen_locations(rates, locations)}
    print("\nEvaluating size extrapolation...", flush=True)
    metrics["size_extrapolation"] = evaluate_size_extrapolation(rates)
    print("\nTraining final models on all available rate data...", flush=True)
    models = fit_rate_models(rates)
    predicted = predict_prices(models, rates, rates["minimum_studio_charge_inr"])
    metrics["training_fit"] = price_metrics(rates["accurate_price_inr"], predicted, rates["weight"], rates["min_price_inr"], rates["max_price_inr"])

    print(f"Rate rows: {len(rates):,} representing {int(rates['weight'].sum()):,} source rows")
    print_metrics("Held-out unseen locations", metrics["unseen_locations"])
    print_metrics("Size extrapolation (train <=4x4 in, test 5x5 in)", metrics["size_extrapolation"])
    print_metrics("Fit on all training data", metrics["training_fit"])

    bundle = {
        "version": 2,
        "models": models,
        "locations": locations.replace({np.nan: None}).to_dict("records"),
        "images": images.replace({np.nan: None}).to_dict("records"),
        "metrics": metrics,
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("\nSaving trained model and metrics...", flush=True)
    joblib.dump(bundle, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nModel saved to {MODEL_PATH}")
    print(f"Metrics saved to {METRICS_PATH}", flush=True)


if __name__ == "__main__":
    train_model()
