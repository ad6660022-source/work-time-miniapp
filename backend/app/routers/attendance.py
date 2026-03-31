import pytz
from fastapi import APIRouter, Request, Header, HTTPException
from datetime import datetime, timedelta

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/attendance", tags=["attendance"])
MOSCOW_TZ = pytz.timezone("Europe/Moscow")
CHECK_MINUTES = 5


@router.post("/check")
async def start_check(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    admin = await db.get_user(pool, tg_user["id"])
    if not admin or not admin["is_admin"]:
        raise HTTPException(403)

    active = await db.get_active_attendance_check(pool)
    if active:
        raise HTTPException(400, "Active check already exists")

    all_employees = await db.get_employees(pool)
    if not all_employees:
        raise HTTPException(400, "No employees")

    now = datetime.now(MOSCOW_TZ)
    expires_at = now + timedelta(minutes=CHECK_MINUTES)
    check = await db.create_attendance_check(pool, admin["id"], expires_at)

    # Инициатор автоматически отмечается
    await db.add_attendance_response(pool, check["id"], admin["id"])

    from app.bot import send_message_to_user
    for emp in all_employees:
        # Инициатору уведомление не нужно — он сам запустил
        if emp["id"] == admin["id"]:
            continue
        await db.create_notification(
            pool, emp["id"], "📍 Проверка присутствия! Откройте приложение и отметьтесь.", "attendance"
        )
        await send_message_to_user(
            emp["telegram_id"],
            f"📍 <b>Проверка присутствия!</b>\n\n"
            f"У вас {CHECK_MINUTES} минут. Откройте приложение и нажмите «Я на месте»."
        )

    return {"check_id": check["id"], "expires_at": expires_at.isoformat()}


@router.post("/respond")
async def respond(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    check = await db.get_active_attendance_check(pool)
    if not check:
        raise HTTPException(400, "No active check")

    now = datetime.now(MOSCOW_TZ)
    expires_at = check["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = MOSCOW_TZ.localize(expires_at)
    if now > expires_at:
        raise HTTPException(400, "Check expired")

    added = await db.add_attendance_response(pool, check["id"], user["id"])
    return {"status": "ok" if added else "already_responded"}


@router.get("/active")
async def get_active(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    check = await db.get_active_attendance_check(pool)
    if not check:
        return {"check": None}

    now = datetime.now(MOSCOW_TZ)
    expires_at = check["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = MOSCOW_TZ.localize(expires_at)

    seconds_left = max(0, int((expires_at - now).total_seconds()))
    responses = await db.get_attendance_responses(pool, check["id"])
    responded_ids = {r["id"] for r in responses}

    return {
        "check": {
            "id": check["id"],
            "seconds_left": seconds_left,
            "user_responded": user["id"] in responded_ids,
            "responses": [{"name": r["name"]} for r in responses] if user["is_admin"] else [],
        }
    }


@router.get("/notifications")
async def get_notifications(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    notifs = await db.get_notifications(pool, user["id"])
    unread = await db.get_unread_count(pool, user["id"])
    return {
        "notifications": [_serialize_notif(n) for n in notifs],
        "unread_count": unread,
    }


@router.post("/notifications/read")
async def mark_read(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)
    await db.mark_notifications_read(pool, user["id"])
    return {"status": "ok"}


def _serialize_notif(n: dict) -> dict:
    return {
        "id": n["id"], "text": n["text"], "type": n["type"],
        "is_read": n["is_read"],
        "created_at": n["created_at"].isoformat() if n.get("created_at") else None,
    }
