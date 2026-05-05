from app.schemas.prediction import GeoJSONFeatureCollection
from app.services.geodata_service import get_demo_hazard_geojson


def predict_fire_hazard() -> GeoJSONFeatureCollection:
    # Later this function will load satellite data and run a PyTorch model.
    return get_demo_hazard_geojson()
