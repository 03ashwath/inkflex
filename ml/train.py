import os

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

DATA_PATH = os.getenv(
    "TATTOO_PRICE_DATASET_READY",
    r"C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\tattoo_price_training_india_100k_clean.csv",
)
ALT_DATA_PATH = os.getenv(
    "TATTOO_PRICE_DATASET_RAW",
    r"C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\tattoo_price_training_india_100k_clean.csv",
)
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "saved_models", "price_prediction_model.joblib"
)

NUMERICAL_FEATURES = ["area_sq_in", "complexity_score"]
CATEGORICAL_FEATURES = ["country", "city", "placement", "style", "color_type", "artist_level", "design_type"]
MODEL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES

def print_price_group_metrics(actual, predictions):
    results = pd.DataFrame({"actual": actual.to_numpy(), "predicted": predictions})
    results["absolute_error"] = (results["actual"] - results["predicted"]).abs()
    results["absolute_percentage_error"] = results["absolute_error"] / results["actual"] * 100
    results["price_group"] = pd.cut(results["actual"], bins=[0, 250, 1000, np.inf], labels=["Low (<$250)", "Medium ($250-$1,000)", "High (>$1,000)"], include_lowest=True)
    print("\nPrice-group error analysis:")
    for group in results["price_group"].cat.categories:
        group_data = results[results["price_group"] == group]
        if group_data.empty:
            print(f"{group}: no test records")
            continue
        absolute_error = group_data["absolute_error"]
        print(f"{group}: n={len(group_data):,}, MAE=${absolute_error.mean():.2f}, RMSE=${np.sqrt(np.mean(absolute_error ** 2)):.2f}, Median AE=${absolute_error.median():.2f}, MAPE={group_data['absolute_percentage_error'].mean():.2f}%")

def train_model() -> None:
    if not os.path.isfile(DATA_PATH):
        raise FileNotFoundError(f"Training dataset not found: {DATA_PATH}")
    data = pd.read_csv(DATA_PATH)

    if {"price_usd"}.issubset(data.columns):
        required_columns = set(MODEL_FEATURES + ["price_usd"])
        missing_columns = required_columns.difference(data.columns)
        if missing_columns:
            raise ValueError(f"Training dataset is missing required columns: {sorted(missing_columns)}")
        training_data = data[MODEL_FEATURES + ["price_usd"]].copy()
    else:
        size_to_placement = {
            'tiny': 'Wrist',
            'small': 'Wrist',
            'medium': 'Forearm',
            'large': 'Forearm',
            'small-custom': 'Forearm',
            'medium-custom': 'Forearm',
            'large-standalone': 'Forearm',
            'half-sleeve': 'Half Sleeve',
            'full-sleeve': 'Full Sleeve',
            'full-back': 'Back',
        }
        complexity_map = {'Simple': 1, 'Medium': 2, 'Complex': 3, 'Intricate': 4}
        training_data = pd.DataFrame({
            'area_sq_in': pd.to_numeric(data['area_sq_in'], errors='coerce'),
            'country': 'India',
            'city': data['city'].astype('string').str.strip(),
            'placement': data['size_id'].map(size_to_placement).fillna('Forearm'),
            'style': np.where(data['color'].astype('string').str.contains('Gray|Black', case=False, na=False), 'Blackwork', 'Realism'),
            'complexity_score': data['complexity'].map(complexity_map).fillna(2),
            'color_type': np.where(data['color'].astype('string').str.contains('Gray|Black', case=False, na=False), 'Black and grey', 'Color'),
            'artist_level': 'Established',
            'design_type': np.where(data['size_id'].astype('string').str.contains('custom|standalone', case=False, na=False), 'Custom design', 'Flash design'),
            'price_usd': pd.to_numeric(data['price_inr'], errors='coerce') / 83.0,
        })
        training_data = training_data[MODEL_FEATURES + ['price_usd']].copy()

    training_data['price_usd'] = pd.to_numeric(training_data['price_usd'], errors='coerce')
    training_data = training_data.replace([np.inf, -np.inf], np.nan).dropna()
    training_data = training_data[training_data['price_usd'] > 0]
    if training_data.empty:
        raise ValueError("Training dataset has no valid positive USD prices.")
    features = training_data[MODEL_FEATURES]
    target = training_data["price_usd"]
    preprocessor = ColumnTransformer(transformers=[("numeric", "passthrough", NUMERICAL_FEATURES), ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES)])
    model = Pipeline(steps=[("preprocessor", preprocessor), ("model", RandomForestRegressor(n_estimators=200, min_samples_leaf=3, max_features=0.8, n_jobs=-1, random_state=42))])
    X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    overall_mae = mean_absolute_error(y_test, predictions)
    overall_rmse = np.sqrt(mean_squared_error(y_test, predictions))
    overall_r2 = r2_score(y_test, predictions)
    print(f"Training records: {len(training_data):,}")
    print(f"Mean absolute error (USD): {overall_mae:.2f}")
    print(f"Root mean squared error (USD): {overall_rmse:.2f}")
    print(f"R-squared: {overall_r2:.4f}")
    print(f"RMSE/MAE ratio: {overall_rmse / overall_mae:.2f}")
    print_price_group_metrics(y_test, predictions)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

if __name__ == "__main__":
    train_model()
