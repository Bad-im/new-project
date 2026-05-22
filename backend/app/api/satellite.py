from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, UploadFile
from fastapi.responses import JSONResponse

from app.services.auth_service import is_admin_token
from app.services.satellite_model import analyze_geotiff
from app.services.satellite_storage import (
    SatelliteStorageError,
    delete_all_satellite_analyses,
    delete_satellite_analysis,
    get_satellite_analysis,
    list_satellite_analyses,
    save_satellite_analysis,
)


router = APIRouter(prefix="/api/satellite", tags=["satellite"])


@router.post("/analyze")
def analyze_satellite_image(
    file: UploadFile = File(...),
    image_date: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    if not is_admin_token(authorization):
        return JSONResponse(
            status_code=403,
            content={
                "status": "error",
                "message": "Запуск спутникового анализа доступен только администратору.",
            },
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".tif", ".tiff"}:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "Загрузите GeoTIFF в формате .tif или .tiff.",
            },
        )

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = Path(temp_file.name)

        result = analyze_geotiff(temp_path)
        saved = save_satellite_analysis(
            source_path=temp_path,
            original_filename=file.filename or "uploaded.tif",
            image_date=image_date,
            result=result,
        )
        result["analysis_id"] = saved["analysis_id"]
        return JSONResponse(content=result)
    except (FileNotFoundError, ValueError) as exc:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": str(exc),
            },
        )
    except RuntimeError as exc:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(exc),
            },
        )
    finally:
        file.file.close()
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


@router.get("/analyses")
def get_satellite_analyses() -> JSONResponse:
    return JSONResponse(content=list_satellite_analyses())


@router.get("/analyses/{analysis_id}")
def get_satellite_analysis_detail(analysis_id: str) -> JSONResponse:
    try:
        return JSONResponse(content=get_satellite_analysis(analysis_id))
    except FileNotFoundError as exc:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": str(exc),
            },
        )
    except SatelliteStorageError as exc:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(exc),
            },
        )


@router.delete("/analyses")
def delete_all_satellite_analysis_results(
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    if not is_admin_token(authorization):
        return JSONResponse(
            status_code=403,
            content={
                "status": "error",
                "message": "Удаление спутниковых анализов доступно только администратору.",
            },
        )

    deleted_count = delete_all_satellite_analyses()
    return JSONResponse(
        content={
            "status": "ok",
            "deleted_count": deleted_count,
        }
    )


@router.delete("/analyses/{analysis_id}")
def delete_satellite_analysis_result(
    analysis_id: str,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    if not is_admin_token(authorization):
        return JSONResponse(
            status_code=403,
            content={
                "status": "error",
                "message": "Удаление спутникового анализа доступно только администратору.",
            },
        )

    try:
        delete_satellite_analysis(analysis_id)
        return JSONResponse(
            content={
                "status": "ok",
                "analysis_id": analysis_id,
            }
        )
    except FileNotFoundError as exc:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": str(exc),
            },
        )
