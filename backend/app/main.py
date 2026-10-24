from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import status
from pathlib import Path
import random
import joblib
import os
import sys
import pandas as pd

from app.schemas.api_schemas import (
    PricePredictionRequest,
    PricePredictionResult,
    LocationOption,
    HealthInputSchema,
    HealthAssessmentResult,
)
from app.services.agents.health_agent import HealthAgent

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from ml.pricing import TattooPricer, validate_dimensions  # noqa: E402

app = FastAPI(title="Tattoo AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reference_dataset_path = os.getenv(
    "TATTOO_IMAGE_DATASET",
    str(PROJECT_ROOT / "ml" / "data" / "Tattoo_img_200"),
)
if os.path.isdir(reference_dataset_path):
    app.mount("/reference-dataset", StaticFiles(directory=reference_dataset_path), name="reference-dataset")

# Load the ML model bundle written by ml/train.py
model_path = os.getenv("TATTOO_PRICE_MODEL", str(PROJECT_ROOT / "ml" / "saved_models" / "price_model_v2.joblib"))
try:
    pricer = TattooPricer(joblib.load(model_path))
    print("Price prediction model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load model at {model_path}. Error: {e}")
    pricer = None

# Initialize AI Agents
health_agent = HealthAgent()

COLOR_LABELS = {"Black_Gray": "Black and grey", "Colored": "Color"}


def require_pricer() -> TattooPricer:
    if pricer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The tattoo price prediction model is unavailable.",
        )
    return pricer


@app.get("/")
def read_root():
    return {"message": "Welcome to the Tattoo AI API"}

@app.get("/api/locations", response_model=list[LocationOption])
def list_locations():
    locations = require_pricer().locations
    return [
        LocationOption(
            name=row["location_name"],
            state=row["state_ut"],
            location_type=row["location_type"],
            parent_city=None if pd.isna(row.get("parent_city")) else row.get("parent_city"),
        )
        for row in locations.to_dict("records")
    ]

@app.post("/api/price/predict", response_model=PricePredictionResult)
def predict_price(request: PricePredictionRequest):
    if request.country.strip().upper() not in {"IN", "INDIA"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Price predictions are currently available only for Indian cities.",
        )
    if not request.city.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter an Indian city to get a price prediction.",
        )
    size_errors = validate_dimensions(request.width_in, request.height_in, request.complexity, request.placement)
    if size_errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=" ".join(size_errors))

    model = require_pricer()
    location = model.resolve_location(request.city, request.state, request.location_type)
    estimate = model.predict(location, request.width_in, request.height_in, request.complexity, request.color)

    if location["known"]:
        place = location["location_name"]
        if pd.notna(location.get("parent_city")) and location.get("parent_city"):
            place += f", {location['parent_city']}"
        location_factor = (
            f"Location: {place}, {location['state_ut']} "
            f"(base rate ₹{location['per_sq_in_rate_min_inr']:,.0f}-{location['per_sq_in_rate_max_inr']:,.0f} per sq in)"
        )
    else:
        location_factor = f"Location: {request.city.strip()} is not in the dataset; estimated from similar locations"
    factors = [
        f"Size: {request.width_in:g} x {request.height_in:g} in ({estimate['area_sq_in']:g} sq in)",
        f"Complexity: {request.complexity}",
        f"Color: {COLOR_LABELS[request.color]}",
        location_factor,
        f"Studio minimum charge: ₹{estimate['minimum_charge']:,.0f}",
    ]
    if estimate["extrapolated"]:
        factors.append("Larger than the 5 x 5 in designs in the training data; price is scaled by area")

    return PricePredictionResult(
        predicted_price_min=estimate["price_min"],
        predicted_price_mid=estimate["price_mid"],
        predicted_price_max=estimate["price_max"],
        width_in=request.width_in,
        height_in=request.height_in,
        area_sq_in=estimate["area_sq_in"],
        location_matched=location["known"],
        extrapolated=estimate["extrapolated"],
        factors=factors,
    )

@app.post("/api/health-analysis", response_model=HealthAssessmentResult)
def analyze_health(request: HealthInputSchema):
    result = health_agent.analyze(request)
    return result

@app.get("/api/images/random")
def get_random_reference_images(request: Request):
    if not os.path.isdir(reference_dataset_path):
        raise HTTPException(status_code=503, detail="The tattoo reference image dataset is unavailable.")
    images = require_pricer().images

    image_files = [
        filename for filename in images.index
        if os.path.isfile(os.path.join(reference_dataset_path, filename))
    ]
    if len(image_files) < 6:
        raise HTTPException(
            status_code=503,
            detail="The tattoo reference dataset does not contain six images with complexity and color labels.",
        )

    selected_images = random.sample(image_files, 6)
    metadata = {}
    for filename in selected_images:
        row = images.loc[filename]
        metadata[filename] = {
            "complexity": row["complexity"],
            "color": row["color"],
            "min_width_in": float(row["min_width_in"]),
            "min_height_in": float(row["min_height_in"]),
            "pixel_width": int(row["pixel_width"]),
            "pixel_height": int(row["pixel_height"]),
        }
    return {
            "images": [str(request.url_for("reference-dataset", path=filename)) for filename in selected_images],
        "metadata": metadata,
    }
