from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class HealthInputSchema(BaseModel):
    medical_conditions: bool = False
    skin_conditions: bool = False
    allergies: bool = False
    diabetes: bool = False
    immune_condition: bool = False
    healing_issues: bool = False
    medications: bool = False
    additional_notes: Optional[str] = None

class TattooRequestSchema(BaseModel):
    country: str
    city: str
    skin_tone: str
    size_category: str
    size_custom_width: Optional[float] = None
    size_custom_height: Optional[float] = None
    body_part: str
    ink_color: str
    design_type: str
    design_text: Optional[str] = None
    health: HealthInputSchema

class HealthAssessmentResult(BaseModel):
    category: str # e.g. "Lower concern", "Caution", "Medical consultation recommended"
    factors: List[str]
    explanation: str
    sources: List[str]

class ColorRecommendationResult(BaseModel):
    recommended_colors: List[Dict[str, str]]
    reasoning: str

class PlacementRecommendationResult(BaseModel):
    recommendations: List[Dict[str, str]]

class MeaningResult(BaseModel):
    interpretations: List[str]
    cultural_context: Optional[str] = None

class PricePredictionResult(BaseModel):
    predicted_price_min: float
    predicted_price_max: float
    predicted_price_mid: float
    factors: List[str]

class FullAnalysisResult(BaseModel):
    request_id: str
    health_assessment: Optional[HealthAssessmentResult] = None
    price_prediction: Optional[PricePredictionResult] = None
    color_recommendations: Optional[ColorRecommendationResult] = None
    placement_recommendations: Optional[PlacementRecommendationResult] = None
    tattoo_meaning: Optional[MeaningResult] = None
    generated_concepts: Optional[List[Dict[str, Any]]] = None
