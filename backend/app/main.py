from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.districts import router as districts_router
from app.api.health import router as health_router
from app.api.prediction import router as prediction_router
from app.api.weather import router as weather_router

app = FastAPI(
    title="Fire Hazard Classification API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):517[0-9]",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "FireForest Monitor API",
        "status": "ok",
        "docs": "/docs",
    }


app.include_router(health_router)
app.include_router(prediction_router)
app.include_router(weather_router)
app.include_router(districts_router)
