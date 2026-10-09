from app.services.agents.base_agent import BaseAgent
from app.schemas.api_schemas import HealthAssessmentResult, HealthInputSchema
import json

HEALTH_SYSTEM_PROMPT = """You are a specialized AI designed to analyze user-provided health information in the context of getting a tattoo.

YOUR MOST IMPORTANT RULE:
You are NOT a doctor. You cannot provide a medical diagnosis. You must evaluate the provided health information strictly as a preliminary risk assessment for getting a tattoo.

You must categorize the risk into one of three categories:
1. "Lower concern"
2. "Caution"
3. "Medical consultation recommended"

You must identify potentially relevant tattoo-related concerns, explain why the condition matters, and clearly recommend consulting a qualified healthcare professional when appropriate.

Output MUST conform to the exact JSON schema requested.
"""

class HealthAgent(BaseAgent):
    def __init__(self):
        super().__init__(system_prompt=HEALTH_SYSTEM_PROMPT)

    def analyze(self, health_input: HealthInputSchema) -> HealthAssessmentResult:
        user_prompt = f"Please analyze the following health input for a potential tattoo client:\n{health_input.model_dump_json()}"
        
        # Override mock for this specific agent to show a good demo if API key is missing
        if not self.client:
            print("Using manual mock for Health Agent")
            
            category = "Lower concern"
            factors = []
            
            if health_input.diabetes or health_input.immune_condition:
                category = "Medical consultation recommended"
                if health_input.diabetes:
                    factors.append("Diabetes")
                if health_input.immune_condition:
                    factors.append("Immune System Condition")
            elif health_input.skin_conditions or health_input.allergies or health_input.healing_issues:
                category = "Caution"
                if health_input.skin_conditions: factors.append("Skin Condition")
                if health_input.healing_issues: factors.append("Poor Wound Healing")

            return HealthAssessmentResult(
                category=category,
                factors=factors if factors else ["No major conditions reported"],
                explanation="This is a generated mock explanation since no OpenAI API key is provided. In production, this would explain that tattooing involves breaking the skin barrier and certain conditions may affect healing.",
                sources=["General dermatological best practices (mocked)"]
            )

        return self.run(user_prompt=user_prompt, response_model=HealthAssessmentResult)
