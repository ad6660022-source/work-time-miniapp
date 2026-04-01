"""
Aiogram bot running as background task alongside FastAPI.
Handles: /start (sends Mini App button), notifications to users.
"""
import logging
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from app.config import settings

logger = logging.getLogger(__name__)

_bot: Bot | None = None


def get_bot() -> Bot | None:
    return _bot


async def send_message_to_user(telegram_id: int, text: str) -> None:
    bot = get_bot()
    if not bot:
        return
    try:
        await bot.send_message(telegram_id, text)
    except Exception as e:
        logger.warning(f"Failed to send message to {telegram_id}: {e}")


async def send_to_admins(admins: list, text: str) -> None:
    for admin in admins:
        await send_message_to_user(admin["telegram_id"], text)


async def send_to_group(chat_id: str, text: str) -> None:
    """Отправить сообщение в группу. chat_id — строка вида '-1001234567890'."""
    if not chat_id:
        return
    bot = get_bot()
    if not bot:
        return
    try:
        await bot.send_message(int(chat_id), text)
    except Exception as e:
        logger.warning(f"Failed to send group message to {chat_id}: {e}")


async def run_bot(pool) -> None:
    global _bot

    _bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    dp = Dispatcher(storage=MemoryStorage())

    @dp.message(CommandStart())
    async def cmd_start(message: Message):
        from app.database import queries as db
        user = await db.get_user(pool, message.from_user.id)

        webapp_url = settings.WEBAPP_URL or "https://example.com"
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="📱 Открыть приложение",
                web_app=WebAppInfo(url=webapp_url)
            )
        ]])

        if not user:
            text = (
                "👋 <b>Добро пожаловать!</b>\n\n"
                "Откройте приложение, чтобы зарегистрироваться."
            )
        elif user["is_blocked"]:
            text = "🔒 Ваш аккаунт заблокирован."
            kb = None
        elif not user["is_approved"]:
            text = (
                f"⏳ <b>{user['name']}</b>, ваша заявка ожидает одобрения.\n\n"
                "Администратор скоро рассмотрит её."
            )
            kb = None
        elif user["is_admin"]:
            text = f"👑 <b>Панель администратора</b>\n\nДобро пожаловать, <b>{user['name']}</b>!"
        else:
            text = f"👋 Привет, <b>{user['name']}</b>!\n\nОткройте приложение для работы."

        await message.answer(text, reply_markup=kb)

    logger.info("Bot started")
    try:
        await dp.start_polling(_bot, skip_updates=True)
    finally:
        await _bot.session.close()
        _bot = None
