from typing import Any, Literal

from pydantic import BaseModel, Field


class HazardProperties(BaseModel):
    hazard_class: int = Field(ge=1, le=5)
    hazard_name: str
    district: str
    area_ha: float
    image_date: str


class GeoJSONGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list[Any]


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"]
    properties: HazardProperties
    geometry: GeoJSONGeometry


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[GeoJSONFeature]
