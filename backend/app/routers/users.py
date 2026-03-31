from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/users", tags=["users"])


class ApproveBody(BaseModel):
    position: str


class ScheduleBody(BaseModel):
    work_days: List[int]
    shift_start: str
    shift_end: str


@router.get("")
async def list_users(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    users = await db.get_all_users(pool)
    return {"users": [_serialize(u) for u in users]}


@router.get("/employees")
async def list_employees(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    employees = await db.get_non_admin_employees(pool)
    return {"employees": [_serialize(e) for e in employees]}


@router.get("/pending")
async def list_pending(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    pending = await db.get_pending_users(pool)
    return {"pending": [_serialize(u) for u in pending]}


@router.post("/{user_id}/approve")
async def approve(user_id: int, body: ApproveBody, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    admin = await db.get_user(pool, tg_user["id"])
    if not admin or not admin["is_admin"]:
        raise HTTPException(403)
    await db.approve_user(pool, user_id, body.position.strip())
    target = await db.get_user_by_id(pool, user_id)
    if target:
        await db.create_notification(
            pool, user_id,
            f"🎉 Ваша заявка одобрена! Должность: {body.position}", "approval"
        )
        from app.bot import send_message_to_user
        await send_message_to_user(
            target["telegram_id"],
            f"🎉 <b>Заявка одобрена!</b>\n\nДолжность: <b>{body.position}</b>\n"
            f"Добро пожаловать! Откройте приложение через бота."
        )
    return {"status": "ok"}


@router.patch("/{user_id}")
async def update_user(user_id: int, body: dict, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    admin = await db.get_user(pool, tg_user["id"])
    if not admin or not admin["is_admin"]:
        raise HTTPException(403)

    allowed = {"position", "is_admin", "is_blocked"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if updates:
        await db.update_user(pool, user_id, **updates)

    target = await db.get_user_by_id(pool, user_id)
    return {"user": _serialize(target) if target else None}


@router.get("/{user_id}/stats")
async def get_stats(user_id: int, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    stats = await db.get_employee_task_stats(pool, user_id)
    return {"stats": stats}


@router.get("/{user_id}/schedule")
async def get_schedule(user_id: int, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    sched = await db.get_schedule(pool, user_id)
    if not sched:
        return {"schedule": None}
    return {"schedule": {
        "work_days": list(sched["work_days"]) if sched["work_days"] else [],
        "shift_start": str(sched["shift_start"])[:5],
        "shift_end": str(sched["shift_end"])[:5],
    }}


@router.put("/{user_id}/schedule")
async def update_schedule(
    user_id: int, body: ScheduleBody,
    x_init_data: str = Header(...), request: Request = None
):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    admin = await db.get_user(pool, tg_user["id"])
    if not admin or not admin["is_admin"]:
        raise HTTPException(403)
    await db.update_schedule(pool, user_id, body.work_days, body.shift_start, body.shift_end)
    return {"status": "ok"}


def _serialize(u: dict) -> dict:
    return {
        "id": u["id"], "name": u["name"],
        "username": u.get("username"), "position": u.get("position"),
        "is_admin": u["is_admin"], "is_approved": u["is_approved"],
        "is_blocked": u["is_blocked"],
        "created_at": u["created_at"].isoformat() if u.get("created_at") else None,
    }
