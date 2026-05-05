from fastapi import APIRouter

from app.schemas.prediction import GeoJSONFeatureCollection
from app.services.model_service import predict_fire_hazard

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=GeoJSONFeatureCollection)
def predict() -> GeoJSONFeatureCollection:
    return predict_fire_hazard()
