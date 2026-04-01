from fastapi import APIRouter, Request, Header, HTTPException
from pydantic import BaseModel

from app.auth import validate_init_data
from app.database import queries as db

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


class AnnouncementBody(BaseModel):
    text: str


@router.post("")
async def send_announcement(
    body: AnnouncementBody,
    x_init_data: str = Header(...),
    request: Request = None,
):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user or not user["is_admin"]:
        raise HTTPException(403)

    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Empty text")

    users = await db.get_employees(pool)  # все одобренные, не заблокированные

    from app.bot import send_message_to_user

    sent = 0
    for u in users:
        if u["id"] == user["id"]:
            continue  # не отправляем самому себе
        await db.create_notification(
            pool, u["id"],
            f"📢 {user['name']}: {text}",
            "announcement"
        )
        await send_message_to_user(
            u["telegram_id"],
            f"📢 <b>Объявление от {user['name']}:</b>\n\n{text}"
        )
        sent += 1

    return {"sent": sent}
