from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/settings", tags=["settings"])

ALLOWED_KEYS = {
    "group_chat_id",
    "notify_tasks",
    "notify_attendance",
    "notify_announcements",
    "notify_reports",
}


class SettingsBody(BaseModel):
    group_chat_id: Optional[str] = None
    notify_tasks: Optional[bool] = None
    notify_attendance: Optional[bool] = None
    notify_announcements: Optional[bool] = None
    notify_reports: Optional[bool] = None


@router.get("")
async def get_settings(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)

    raw = await db.get_all_settings(pool)
    return {
        "group_chat_id":        raw.get("group_chat_id", ""),
        "notify_tasks":         raw.get("notify_tasks", "true") == "true",
        "notify_attendance":    raw.get("notify_attendance", "true") == "true",
        "notify_announcements": raw.get("notify_announcements", "true") == "true",
        "notify_reports":       raw.get("notify_reports", "true") == "true",
    }


@router.post("")
async def save_settings(
    body: SettingsBody,
    x_init_data: str = Header(...),
    request: Request = None,
):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)

    if body.group_chat_id is not None:
        await db.set_setting(pool, "group_chat_id", body.group_chat_id.strip())
    if body.notify_tasks is not None:
        await db.set_setting(pool, "notify_tasks", "true" if body.notify_tasks else "false")
    if body.notify_attendance is not None:
        await db.set_setting(pool, "notify_attendance", "true" if body.notify_attendance else "false")
    if body.notify_announcements is not None:
        await db.set_setting(pool, "notify_announcements", "true" if body.notify_announcements else "false")
    if body.notify_reports is not None:
        await db.set_setting(pool, "notify_reports", "true" if body.notify_reports else "false")

    return {"status": "ok"}
