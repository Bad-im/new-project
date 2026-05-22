from __future__ import annotations

import secrets


ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "123"
ADMIN_TOKEN = "fireforest-admin-token"


def authenticate_admin(username: str, password: str) -> bool:
    return secrets.compare_digest(username, ADMIN_USERNAME) and secrets.compare_digest(
        password,
        ADMIN_PASSWORD,
    )


def is_admin_token(authorization: str | None) -> bool:
    if not authorization:
        return False

    scheme, _, token = authorization.partition(" ")
    return scheme.lower() == "bearer" and secrets.compare_digest(token, ADMIN_TOKEN)
