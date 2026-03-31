from fastapi import APIRouter, Header, Request
from pydantic import BaseModel

from app.auth import validate_init_data
from app.database import queries as db
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    name: str


@router.post("/register")
async def register(body: RegisterBody, x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    tg_id = tg_user["id"]

    existing = await db.get_user(pool, tg_id)
    if existing:
        return {"status": "exists", "user": _serialize(existing)}

    name = body.name.strip()
    if len(name) < 2:
        from fastapi import HTTPException
        raise HTTPException(400, "Name too short")

    # Auto-admin for FIRST_ADMIN_ID
    is_first_admin = tg_id == settings.FIRST_ADMIN_ID
    new_user = await db.create_user(pool, tg_id, tg_user.get("username", ""), name)
    if is_first_admin:
        await db.update_user(pool, new_user["id"],
                             is_approved=True, is_admin=True, position="Администратор")
        new_user = await db.get_user_by_id(pool, new_user["id"])
    else:
        # Notify admins via bot
        from app.bot import send_to_admins
        admins = await db.get_admins(pool)
        await send_to_admins(
            admins,
            f"🆕 <b>Новый сотрудник</b>\n\nИмя: <b>{name}</b>\n"
            f"Username: @{tg_user.get('username', '—')}\n\nОткройте приложение, чтобы одобрить."
        )

    return {"status": "ok", "user": _serialize(new_user)}


@router.get("/me")
async def get_me(x_init_data: str = Header(...), request: Request = None):
    pool = request.app.state.pool
    tg_user = validate_init_data(x_init_data)
    user = await db.get_user(pool, tg_user["id"])
    if not user:
        return {"status": "not_registered"}
    return {"status": "ok", "user": _serialize(user)}


def _serialize(user: dict) -> dict:
    return {
        "id": user["id"],
        "telegram_id": user["telegram_id"],
        "name": user["name"],
        "username": user.get("username"),
        "position": user.get("position"),
        "is_admin": user["is_admin"],
        "is_approved": user["is_approved"],
        "is_blocked": user["is_blocked"],
    }
