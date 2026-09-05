from typing import Dict, Any
from model_service import ModelService

class ApiController:
    def __init__(self):
        self.service = ModelService()

    def handle_prediction_request(self, request_payload: Dict[str, Any]) -> Dict[str, Any]:
        """API endpoint controller handling incoming JSON payload."""
        text = request_payload.get("text", "")
        return self.service.predict_sentiment(text)

    def health_check(self) -> Dict[str, str]:
        """Controller endpoint for health diagnostics."""
        return {"status": "ok"}
