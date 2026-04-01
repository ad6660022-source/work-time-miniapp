import pytz
from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, date as date_type

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/reports", tags=["reports"])
MOSCOW_TZ = pytz.timezone("Europe/Moscow")


class ReportBody(BaseModel):
    done: str
    problems: str
    plans: str


class RatingBody(BaseModel):
    rating: float


@router.post("")
async def submit_report(body: ReportBody, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_approved"]:
        raise HTTPException(403)

    today = datetime.now(MOSCOW_TZ).date()
    await db.upsert_report(
        pool, user["id"], today,
        body.done or "—", body.problems or "—", body.plans or "—"
    )

    admins = await db.get_admins(pool)
    for admin in admins:
        if admin["id"] == user["id"]:
            continue
        await db.create_notification(
            pool, admin["id"],
            f"📝 Новый отчёт от {user['name']}", "report"
        )
        from app.bot import send_message_to_user
        await send_message_to_user(
            admin["telegram_id"],
            f"📝 <b>Отчёт от {user['name']}</b>\n"
            f"<i>{user.get('position') or '—'}</i>\n\n"
            f"✅ <b>Сделано:</b>\n{body.done or '—'}\n\n"
            f"⚠️ <b>Проблемы:</b>\n{body.problems or '—'}\n\n"
            f"📅 <b>Планы:</b>\n{body.plans or '—'}"
        )

    return {"status": "ok"}


@router.get("/today")
async def get_today(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)
    report = await db.get_today_report(pool, user["id"])
    return {"report": _serialize(report) if report else None}


@router.get("/dates")
async def get_dates(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    dates = await db.get_available_report_dates(pool)
    return {"dates": [str(d) for d in dates]}


@router.get("/{date}")
async def get_by_date(date: str, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    try:
        d = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "Invalid date")
    reports = await db.get_reports_by_date(pool, d)
    ratings = await db.get_ratings_by_date(pool, d)
    ratings_map = {r["user_id"]: r for r in ratings}
    return {"reports": [_serialize_admin(r, ratings_map.get(r["user_id"])) for r in reports]}


@router.post("/{date}/{user_id}/rate")
async def rate_report(
    date: str, user_id: int, body: RatingBody,
    x_init_data: str = Header(...), request: Request = None
):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    admin = await db.get_user(pool, tg_user["id"])
    if not admin or not admin["is_admin"]:
        raise HTTPException(403)

    # Проверяем допустимость оценки: от 1 до 5 с шагом 0.5
    valid_ratings = [round(x * 0.5, 1) for x in range(2, 11)]  # 1.0, 1.5, ... 5.0
    if round(body.rating, 1) not in valid_ratings:
        raise HTTPException(400, "Rating must be 1.0–5.0 in 0.5 steps")

    try:
        d = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "Invalid date")

    report = await db.get_today_report(pool, user_id) if date == str(datetime.now(MOSCOW_TZ).date()) else None
    await db.upsert_report_rating(pool, user_id, d, body.rating, admin["id"])
    return {"status": "ok", "rating": body.rating}


def _serialize(r: dict) -> dict:
    return {
        "done": r.get("done"), "problems": r.get("problems"), "plans": r.get("plans"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }


def _serialize_admin(r: dict, rating: dict = None) -> dict:
    return {
        "user_id": r.get("user_id"),
        "name": r.get("name"), "position": r.get("position"),
        "done": r.get("done"), "problems": r.get("problems"), "plans": r.get("plans"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        "rating": float(rating["rating"]) if rating else None,
        "rated_by": rating.get("rated_by") if rating else None,
    }
