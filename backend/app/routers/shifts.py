import pytz
from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/shifts", tags=["shifts"])
MOSCOW_TZ = pytz.timezone("Europe/Moscow")


def _fmt(dt) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = MOSCOW_TZ.localize(dt)
    return dt.astimezone(MOSCOW_TZ).strftime("%H:%M")


def _fmt_iso(dt) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = MOSCOW_TZ.localize(dt)
    return dt.astimezone(MOSCOW_TZ).isoformat()


def _serialize_shift(shift: dict, active_break: dict = None) -> dict:
    if not shift:
        return None
    start = shift.get("start_time")
    end = shift.get("end_time")
    duration = None
    if start and end:
        delta = end - start
        duration = int(delta.total_seconds() / 60)
    result = {
        "id": shift["id"],
        "date": str(shift["date"]),
        "start_time": _fmt(start),
        "end_time": _fmt(end),
        "status": shift["status"],
        "duration_minutes": duration,
    }
    if active_break:
        result["active_break"] = {
            "id": active_break["id"],
            "type": active_break["type"],
            "start_time": _fmt_iso(active_break["start_time"]),
        }
    else:
        result["active_break"] = None
    return result


class BreakBody(BaseModel):
    type: str = "break"  # "lunch" или "break"


@router.get("/today")
async def get_today(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)
    shift = await db.get_today_shift(pool, user["id"])
    active_break = None
    if shift and shift["status"] == "active":
        active_break = await db.get_active_break(pool, shift["id"])
    return {"shift": _serialize_shift(shift, active_break)}


@router.post("/start")
async def start_shift(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_approved"]:
        raise HTTPException(403)

    now = datetime.now(MOSCOW_TZ)
    if now.hour >= 19:
        raise HTTPException(400, "Рабочий день уже закончился (после 19:00)")

    existing = await db.get_today_shift(pool, user["id"])
    if existing and existing["status"] == "active":
        raise HTTPException(400, "Shift already active")

    shift = await db.start_shift(pool, user["id"])
    return {"shift": _serialize_shift(shift)}


@router.post("/end")
async def end_shift(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    shift = await db.get_today_shift(pool, user["id"])
    if shift:
        await db.close_all_open_breaks(pool, shift["id"])

    ended = await db.end_shift(pool, user["id"])
    if not ended:
        raise HTTPException(400, "No active shift")

    await db.create_notification(pool, user["id"], "Смена завершена. Не забудьте написать отчёт!", "shift")
    return {"shift": _serialize_shift(ended)}


@router.post("/break/start")
async def start_break(body: BreakBody, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_approved"]:
        raise HTTPException(403)

    shift = await db.get_today_shift(pool, user["id"])
    if not shift or shift["status"] != "active":
        raise HTTPException(400, "No active shift")

    existing_break = await db.get_active_break(pool, shift["id"])
    if existing_break:
        raise HTTPException(400, "Break already active")

    if body.type not in ("lunch", "break"):
        raise HTTPException(400, "Invalid break type")

    brk = await db.start_break(pool, shift["id"], user["id"], body.type)
    return {
        "break": {
            "id": brk["id"],
            "type": brk["type"],
            "start_time": _fmt_iso(brk["start_time"]),
        }
    }


@router.post("/break/end")
async def end_break(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    shift = await db.get_today_shift(pool, user["id"])
    if not shift or shift["status"] != "active":
        raise HTTPException(400, "No active shift")

    active_break = await db.get_active_break(pool, shift["id"])
    if not active_break:
        raise HTTPException(400, "No active break")

    brk = await db.end_break(pool, active_break["id"])
    return {"status": "ok", "break": {"id": brk["id"], "type": brk["type"]}}


@router.get("/overview")
async def get_overview(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)

    overview = await db.get_today_shift_overview(pool)
    now = datetime.now(MOSCOW_TZ)

    result = []
    for s in overview:
        result.append({
            "id": s["id"],
            "name": s["name"],
            "position": s.get("position"),
            "status": s.get("status"),
            "start_time": _fmt(s.get("start_time")),
            "end_time": _fmt(s.get("end_time")),
        })
    return {"overview": result, "date": str(now.date()), "time": now.strftime("%H:%M")}
