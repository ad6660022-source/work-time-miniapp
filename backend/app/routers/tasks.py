from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel
from typing import List

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class CreateTaskBody(BaseModel):
    text: str
    assignee_ids: List[int]


@router.get("/my")
async def get_my_tasks(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)
    tasks = await db.get_user_tasks(pool, user["id"])
    return {"tasks": [_serialize(t) for t in tasks]}


@router.get("/all")
async def get_all_tasks(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    tasks = await db.get_all_active_tasks(pool)
    return {"tasks": [_serialize_admin(t) for t in tasks]}


@router.get("/{task_id}")
async def get_task(task_id: int, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)
    task = await db.get_task_with_assignees(pool, task_id)
    if not task:
        raise HTTPException(404)
    return {"task": _serialize_detail(task)}


@router.post("")
async def create_task(body: CreateTaskBody, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)
    if not body.text.strip():
        raise HTTPException(400, "Empty task text")
    if not body.assignee_ids:
        raise HTTPException(400, "No assignees")

    task = await db.create_task(pool, body.text.strip(), user["id"])
    for uid in body.assignee_ids:
        await db.assign_task(pool, task["id"], uid)
        assignee = await db.get_user_by_id(pool, uid)
        if assignee:
            await db.create_notification(
                pool, uid,
                f"📌 Новая задача: {body.text[:80]}{'…' if len(body.text) > 80 else ''}",
                "task"
            )
            from app.bot import send_message_to_user
            await send_message_to_user(
                assignee["telegram_id"],
                f"📌 <b>Новая задача!</b>\n\n{body.text}\n\nОткройте приложение для просмотра."
            )

    return {"task": _serialize_detail(await db.get_task_with_assignees(pool, task["id"]))}


@router.patch("/{task_id}/status")
async def update_status(
    task_id: int, body: dict, x_init_data: str = Header(...), request: Request = None
):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        raise HTTPException(404)

    new_status = body.get("status")
    if new_status not in ("in_progress", "done"):
        raise HTTPException(400, "Invalid status")

    await db.update_task_assignment_status(pool, task_id, user["id"], new_status)

    if new_status == "done":
        task = await db.get_task_with_assignees(pool, task_id)
        admins = await db.get_admins(pool)
        preview = task["text"][:80] + "…" if len(task["text"]) > 80 else task["text"]
        for admin in admins:
            await db.create_notification(
                pool, admin["id"],
                f"✅ {user['name']} выполнил задачу: {preview}", "task_done"
            )
            from app.bot import send_message_to_user
            await send_message_to_user(
                admin["telegram_id"],
                f"✅ <b>Задача выполнена!</b>\n\nИсполнитель: <b>{user['name']}</b>\n"
                f"Задача: {preview}\n\nТребуется проверка ☝️"
            )

    return {"status": "ok"}


def _serialize(t: dict) -> dict:
    return {
        "id": t["id"], "text": t["text"],
        "assignment_status": t["assignment_status"],
        "created_at": t["created_at"].isoformat() if t.get("created_at") else None,
    }


def _serialize_admin(t: dict) -> dict:
    return {
        "id": t["id"], "text": t["text"],
        "creator_name": t.get("creator_name"),
        "cnt_assigned": t.get("cnt_assigned", 0),
        "cnt_in_progress": t.get("cnt_in_progress", 0),
        "cnt_done": t.get("cnt_done", 0),
        "created_at": t["created_at"].isoformat() if t.get("created_at") else None,
    }


def _serialize_detail(t: dict) -> dict:
    return {
        "id": t["id"], "text": t["text"],
        "assignees": [
            {"id": a["id"], "name": a["name"], "position": a.get("position"), "status": a["status"]}
            for a in t.get("assignees", [])
        ],
        "created_at": t["created_at"].isoformat() if t.get("created_at") else None,
    }
