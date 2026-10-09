from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import status
import random
import joblib
import os
import csv
import pandas as pd
import urllib.parse
import numpy as np

from app.schemas.api_schemas import PricePredictionResult, HealthInputSchema, HealthAssessmentResult
from app.services.agents.health_agent import HealthAgent
from pydantic import BaseModel

app = FastAPI(title="Tattoo AI API", version="1.0.0")
api_base_url = f"http://localhost:{os.getenv('PORT', '8001')}"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reference_dataset_path = os.getenv(
    "TATTOO_IMAGE_DATASET",
    r"C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\Tattoo_img_200",
)
reference_image_metadata_path = os.getenv(
    "TATTOO_IMAGE_METADATA",
    r"C:\Users\Vikheyath R Bangera\Desktop\Reserch paper dataset\tattoo_200_image.csv",
)
if os.path.isdir(reference_dataset_path):
    app.mount("/reference-dataset", StaticFiles(directory=reference_dataset_path), name="reference-dataset")

# Load the ML model
model_path = os.path.join(os.path.dirname(__file__), '../../ml/saved_models/price_prediction_model.joblib')
try:
    price_model = joblib.load(model_path)
    print("Price prediction model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load model at {model_path}. Error: {e}")
    price_model = None

# Initialize AI Agents
health_agent = HealthAgent()

class PricePredictionRequest(BaseModel):
    country: str
    city: str
    size_sq_inches: float
    body_part: str
    tattoo_style: str
    complexity: int
    is_color: int
    color_count: int
    shading_level: int
    ink_brand: str = "No Preference"
    artist_level: str = "Established"
    design_type: str = "Custom design"

@app.get("/")
def read_root():
    return {"message": "Welcome to the Tattoo AI API"}

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
    if price_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The tattoo price prediction model is unavailable.",
        )

    country = "India"
    complexity_score = (
        request.complexity
        if request.complexity <= 4
        else min(4, max(1, round(1 + (request.complexity - 1) / 3)))
    )
    color_type = (
        "Black and grey"
        if not request.is_color
        else "Single color"
        if request.color_count <= 1
        else "Color"
    )
    placement_aliases = {
        "arm": "Upper Arm",
        "left upper arm": "Upper Arm",
        "right upper arm": "Upper Arm",
        "left bicep": "Upper Arm",
        "right bicep": "Upper Arm",
        "full sleeve": "Upper Arm",
        "half sleeve": "Upper Arm",
        "left forearm": "Forearm",
        "right forearm": "Forearm",
        "left inner forearm": "Forearm",
        "right inner forearm": "Forearm",
        "left outer forearm": "Forearm",
        "right outer forearm": "Forearm",
        "upper back": "Back",
        "lower back": "Back",
        "full back": "Back",
        "left upper back": "Back",
        "right upper back": "Back",
        "left lower back": "Back",
        "right lower back": "Back",
        "left shoulder blade": "Back",
        "right shoulder blade": "Back",
        "along the spine": "Back",
        "left side of back": "Back",
        "right side of back": "Back",
        "chest": "Chest & Torso",
        "chest and torso": "Chest & Torso",
        "upper chest": "Chest & Torso",
        "lower chest": "Chest & Torso",
        "left chest": "Chest & Torso",
        "right chest": "Chest & Torso",
        "center chest": "Chest & Torso",
        "upper abdomen": "Chest & Torso",
        "lower abdomen": "Chest & Torso",
        "left side of torso": "Chest & Torso",
        "right side of torso": "Chest & Torso",
        "finger": "Fingers",
        "left fingers": "Fingers",
        "right fingers": "Fingers",
        "left knuckles": "Fingers",
        "right knuckles": "Fingers",
        "left palm": "Hand",
        "right palm": "Hand",
        "left hand": "Hand",
        "right hand": "Hand",
        "left thigh": "Thigh",
        "right thigh": "Thigh",
        "left calf": "Calf",
        "right calf": "Calf",
        "left shin": "Calf",
        "right shin": "Calf",
        "left foot": "Foot",
        "right foot": "Foot",
        "top of left foot": "Foot",
        "top of right foot": "Foot",
        "left heel": "Foot",
        "right heel": "Foot",
        "left toes": "Foot",
        "right toes": "Foot",
        "front of neck": "Neck",
        "left side of neck": "Neck",
        "right side of neck": "Neck",
        "back of neck": "Neck",
        "behind left ear": "Neck",
        "behind right ear": "Neck",
        "ribs": "Ribs",
        "left ribs": "Ribs",
        "right ribs": "Ribs",
        "left wrist": "Wrist",
        "right wrist": "Wrist",
        "left ankle": "Ankle",
        "right ankle": "Ankle",
        "left knee": "Knee",
        "right knee": "Knee",
        "sternum": "Chest & Torso",
        "half leg": "Calf",
        "full leg": "Calf",
    }
    style_aliases = {
        "3d effect": "3D",
        "black and grey": "Blackwork",
    }
    design_type_aliases = {
        "semi-custom": "Custom from reference",
        "fully custom": "Custom design",
    }
    input_data = pd.DataFrame(
        [
            {
                "area_sq_in": request.size_sq_inches,
                "complexity_score": complexity_score,
                "country": country,
                "city": request.city,
                "placement": placement_aliases.get(
                    request.body_part.strip().lower(), request.body_part.strip()
                ),
                "style": style_aliases.get(
                    request.tattoo_style.strip().lower(), request.tattoo_style.strip()
                ),
                "color_type": color_type,
                "artist_level": request.artist_level,
                "design_type": design_type_aliases.get(
                    request.design_type.strip().lower(), request.design_type
                ),
            }
        ]
    )

    ink_premiums = {
        "Kuro Sumi": 50,
        "Xtreme Ink": 30,
        "Eternal Ink": 20,
        "Dynamic Color": 20,
        "Intenze Tattoo Ink": 20,
    }
    ink_brand = request.ink_brand
    ink_premium = ink_premiums.get(ink_brand, 0)
    predicted_price = price_model.predict(input_data)[0] + ink_premium
    forest = price_model.named_steps["model"]
    transformed_input = price_model.named_steps["preprocessor"].transform(input_data)
    tree_predictions = [tree.predict(transformed_input)[0] for tree in forest.estimators_]
    min_price = max(0, round(float(np.percentile(tree_predictions, 10)) + ink_premium, 2))
    max_price = max(
        min_price, round(float(np.percentile(tree_predictions, 90)) + ink_premium, 2)
    )

    return PricePredictionResult(
        predicted_price_mid=round(predicted_price, 2),
        predicted_price_min=min_price,
        predicted_price_max=max_price,
        factors=[
            f"Size: {request.size_sq_inches} sq inches",
            f"Complexity: {request.complexity}",
            f"Location: {request.city}, {country}",
            f"Color: {color_type}",
        ]
    )

@app.post("/api/health-analysis", response_model=HealthAssessmentResult)
def analyze_health(request: HealthInputSchema):
    result = health_agent.analyze(request)
    return result

@app.get("/api/images/random")
def get_random_reference_images():
    if not os.path.isdir(reference_dataset_path):
        raise HTTPException(status_code=503, detail="The tattoo reference image dataset is unavailable.")

    try:
        with open(reference_image_metadata_path, newline="", encoding="utf-8-sig") as metadata_file:
            reader = csv.DictReader(metadata_file)
            required_columns = {"image_name", "complexity", "color"}
            if not reader.fieldnames or not required_columns.issubset(reader.fieldnames):
                raise HTTPException(
                    status_code=503,
                    detail="The tattoo reference image metadata file has an invalid format.",
                )

            image_metadata = {}
            for row in reader:
                filename = (row.get("image_name") or "").strip()
                complexity = (row.get("complexity") or "").strip()
                color = (row.get("color") or "").strip()
                if not filename or complexity not in {"Simple", "Medium", "Complex"} or color not in {"Black_Gray", "Colored"}:
                    raise HTTPException(
                        status_code=503,
                        detail="The tattoo reference image metadata contains an invalid entry.",
                    )
                image_metadata[filename] = {"complexity": complexity, "color": color}
    except OSError as error:
        raise HTTPException(
            status_code=503,
            detail="The tattoo reference image metadata file is unavailable.",
        ) from error

    allowed_extensions = ('.png', '.jpg', '.jpeg', '.webp', '.gif')
    image_files = [
        filename for filename in os.listdir(reference_dataset_path)
        if filename.lower().endswith(allowed_extensions)
        and os.path.isfile(os.path.join(reference_dataset_path, filename))
        and filename in image_metadata
    ]
    if len(image_files) < 6:
        raise HTTPException(
            status_code=503,
            detail="The tattoo reference dataset does not contain six images with complexity and color labels.",
        )

    selected_images = random.sample(image_files, 6)
    return {
        "images": [f"{api_base_url}/reference-dataset/{urllib.parse.quote(filename)}" for filename in selected_images],
        "metadata": {filename: image_metadata[filename] for filename in selected_images},
    }
