import os
import json
from typing import Type, TypeVar, Any
from pydantic import BaseModel

# Try to import openai, fallback gracefully if not installed
try:
    from openai import OpenAI
    has_openai = True
except ImportError:
    has_openai = False

T = TypeVar('T', bound=BaseModel)

class BaseAgent:
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.api_key = os.getenv("OPENAI_API_KEY")
        
        if has_openai and self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def run(self, user_prompt: str, response_model: Type[T]) -> T:
        """
        Runs the LLM with structured output matching the provided Pydantic model.
        """
        if not self.client:
            print("Warning: OPENAI_API_KEY not set or openai not installed. Returning mock data.")
            return self._generate_mock_response(response_model)

        try:
            response = self.client.beta.chat.completions.parse(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format=response_model,
            )
            return response.choices[0].message.parsed
        except Exception as e:
            print(f"Error calling LLM API: {e}")
            return self._generate_mock_response(response_model)

    def _generate_mock_response(self, response_model: Type[T]) -> T:
        """Fallback mock generator based on the schema if API fails or is unset"""
        # This is a very simplistic mock just to keep the pipeline from breaking
        schema = response_model.model_json_schema()
        mock_data = {}
        for prop, details in schema.get('properties', {}).items():
            if details.get('type') == 'string':
                mock_data[prop] = "Mock text due to missing API key"
            elif details.get('type') == 'array':
                mock_data[prop] = ["Mock item 1", "Mock item 2"]
            else:
                mock_data[prop] = None
        
        return response_model.model_validate(mock_data)
