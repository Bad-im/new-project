from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.auth_service import ADMIN_TOKEN, authenticate_admin


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest) -> JSONResponse:
    if not authenticate_admin(payload.username, payload.password):
        return JSONResponse(
            status_code=401,
            content={
                "status": "error",
                "message": "Неверный логин или пароль.",
            },
        )

    return JSONResponse(
        content={
            "status": "ok",
            "token": ADMIN_TOKEN,
            "role": "admin",
            "username": payload.username,
        },
    )
