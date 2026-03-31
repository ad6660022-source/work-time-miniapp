import hashlib
import hmac
import json
from urllib.parse import unquote, parse_qsl
from fastapi import Header, HTTPException, Depends
import asyncpg

from app.config import settings
from app.database import queries as db


def validate_init_data(init_data: str) -> dict:
    """Validate Telegram WebApp initData and return user dict."""
    params = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", "")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(params.items())
    )

    secret_key = hmac.new(
        b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256
    ).digest()

    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if computed_hash != received_hash:
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")

    user_json = params.get("user", "{}")
    return json.loads(unquote(user_json))


async def get_current_user(
    x_init_data: str = Header(...),
    pool: asyncpg.Pool = Depends(lambda: None),  # overridden in main
) -> dict:
    tg_user = validate_init_data(x_init_data)
    tg_id = tg_user.get("id")
    if not tg_id:
        raise HTTPException(status_code=401, detail="No user id in initData")
    return tg_user


async def get_db_user(
    x_init_data: str = Header(...),
    pool: asyncpg.Pool = Depends(lambda: None),
) -> dict:
    tg_user = validate_init_data(x_init_data)
    tg_id = tg_user.get("id")
    user = await db.get_user(pool, tg_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if user["is_blocked"]:
        raise HTTPException(status_code=403, detail="User is blocked")
    return user


async def get_admin_user(
    x_init_data: str = Header(...),
    pool: asyncpg.Pool = Depends(lambda: None),
) -> dict:
    tg_user = validate_init_data(x_init_data)
    tg_id = tg_user.get("id")
    user = await db.get_user(pool, tg_id)
    if not user or not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    if user["is_blocked"]:
        raise HTTPException(status_code=403, detail="User is blocked")
    return user
