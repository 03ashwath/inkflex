from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship
import uuid
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)

    requests = relationship("TattooRequest", back_populates="user")

class TattooRequest(Base):
    __tablename__ = 'tattoo_requests'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.id'), nullable=True)
    
    country = Column(String(100))
    city = Column(String(100))
    
    skin_tone = Column(String(50))
    
    size_category = Column(String(50))
    size_custom_width = Column(Float, nullable=True)
    size_custom_height = Column(Float, nullable=True)
    
    body_part = Column(String(100))
    ink_color = Column(String(100))
    
    design_type = Column(String(50)) # 'upload', 'text', 'none'
    design_text = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="requests")
    health_input = relationship("HealthInput", back_populates="request", uselist=False)
    result = relationship("AIResult", back_populates="request", uselist=False)

class HealthInput(Base):
    __tablename__ = 'health_inputs'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey('tattoo_requests.id'))
    
    medical_conditions = Column(Boolean, default=False)
    skin_conditions = Column(Boolean, default=False)
    allergies = Column(Boolean, default=False)
    diabetes = Column(Boolean, default=False)
    immune_condition = Column(Boolean, default=False)
    healing_issues = Column(Boolean, default=False)
    medications = Column(Boolean, default=False)
    additional_notes = Column(String, nullable=True)

    request = relationship("TattooRequest", back_populates="health_input")

class AIResult(Base):
    __tablename__ = 'ai_results'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey('tattoo_requests.id'))
    
    health_assessment = Column(JSON, nullable=True)
    
    predicted_price_min = Column(Float, nullable=True)
    predicted_price_max = Column(Float, nullable=True)
    predicted_price_mid = Column(Float, nullable=True)
    price_factors = Column(JSON, nullable=True)
    
    color_recommendations = Column(JSON, nullable=True)
    placement_recommendations = Column(JSON, nullable=True)
    tattoo_meaning = Column(JSON, nullable=True)
    generated_concepts = Column(JSON, nullable=True)

    request = relationship("TattooRequest", back_populates="result")
