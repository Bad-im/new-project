from fastapi import APIRouter, HTTPException

from app.services.district_boundary_service import (
    DistrictBoundaryError,
    get_districts_geojson,
    get_districts_list,
)

router = APIRouter(prefix="/districts", tags=["districts"])


@router.get("")
def list_district_boundaries() -> list[dict]:
    try:
        return get_districts_list()
    except DistrictBoundaryError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/geojson")
def get_district_boundaries_geojson() -> dict:
    try:
        return get_districts_geojson()
    except DistrictBoundaryError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
