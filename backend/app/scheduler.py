import logging
import pytz
import asyncpg
from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta

from app.database import queries as db

logger = logging.getLogger(__name__)
MOSCOW_TZ = pytz.timezone("Europe/Moscow")


async def job_lateness(pool: asyncpg.Pool, threshold_minute: int, notify_admin: bool):
    today = datetime.now(MOSCOW_TZ).date()
    weekday = today.weekday()
    employees = await db.get_employees(pool)

    for emp in employees:
        sched = await db.get_schedule(pool, emp["id"])
        if not sched:
            continue
        work_days = list(sched["work_days"]) if sched.get("work_days") else []
        if weekday not in work_days:
            continue
        shift = await db.get_today_shift(pool, emp["id"])
        if shift:
            continue

        late = await db.get_late_record(pool, emp["id"], today)

        from app.bot import send_message_to_user

        try:
            if threshold_minute == 9 * 60 + 5 and (not late or not late.get("notified_905")):
                await db.upsert_late_record(pool, emp["id"], today, notified_905=True)
                await db.create_notification(pool, emp["id"], "⚠️ Рабочий день начался! Не забудьте начать смену.", "late")
                await send_message_to_user(emp["telegram_id"],
                    "⚠️ <b>Напоминание</b>\n\nРабочий день начался!\nОткройте приложение и нажмите «Начать смену».")

            elif threshold_minute == 9 * 60 + 10 and (not late or not late.get("notified_910")):
                await db.upsert_late_record(pool, emp["id"], today, notified_910=True)
                await db.create_notification(pool, emp["id"], "⏰ Повторное напоминание: начните смену!", "late")
                await send_message_to_user(emp["telegram_id"],
                    "⏰ <b>Второе напоминание</b>\n\nВы ещё не начали смену!\nОткройте приложение.")

            elif threshold_minute == 9 * 60 + 15 and notify_admin and (not late or not late.get("marked_late")):
                await db.upsert_late_record(pool, emp["id"], today, marked_late=True)
                await db.create_notification(pool, emp["id"], "🔴 Опоздание зафиксировано.", "late")
                admins = await db.get_admins(pool)
                for admin in admins:
                    await db.create_notification(
                        pool, admin["id"],
                        f"🔴 {emp['name']} опоздал — не начал смену в 9:15", "late"
                    )
                    await send_message_to_user(admin["telegram_id"],
                        f"🔴 <b>Опоздание</b>\n\n<b>{emp['name']}</b> не начал смену в 9:15")
        except Exception as e:
            logger.warning(f"Lateness job error for {emp['id']}: {e}")


async def job_close_shifts(pool: asyncpg.Pool):
    closed_ids = await db.auto_close_all_active_shifts(pool)
    from app.bot import send_message_to_user
    for uid in closed_ids:
        user = await db.get_user_by_id(pool, uid)
        if not user:
            continue
        await db.create_notification(
            pool, uid, "🌆 Смена завершена. Напишите отчёт о работе!", "shift"
        )
        await send_message_to_user(
            user["telegram_id"],
            "🌆 <b>Рабочий день завершён!</b>\n\nОткройте приложение и напишите отчёт."
        )


async def job_missing_reports(pool: asyncpg.Pool):
    missing = await db.get_users_without_report(pool)
    if not missing:
        return
    names = ", ".join(u["name"] for u in missing)
    admins = await db.get_admins(pool)
    from app.bot import send_message_to_user
    for admin in admins:
        await db.create_notification(
            pool, admin["id"], f"📋 Не сдали отчёт: {names}", "report"
        )
        await send_message_to_user(
            admin["telegram_id"],
            f"📋 <b>Отчёты не сданы</b>\n\n" +
            "\n".join(f"• {u['name']}" for u in missing)
        )


async def job_attendance_expiry(pool: asyncpg.Pool):
    check = await db.get_active_attendance_check(pool)
    if not check:
        return
    now = datetime.now(MOSCOW_TZ)
    expires_at = check["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = MOSCOW_TZ.localize(expires_at)
    if now < expires_at:
        return

    await db.close_attendance_check(pool, check["id"])
    responses = await db.get_attendance_responses(pool, check["id"])
    responded_ids = {r["id"] for r in responses}
    employees = await db.get_non_admin_employees(pool)
    absent = [e for e in employees if e["id"] not in responded_ids]

    lines = [f"📍 <b>Результаты проверки</b>\n"]
    lines.append(f"На месте ({len(responses)}/{len(employees)}):")
    for r in responses:
        lines.append(f"  ✅ {r['name']}")
    if absent:
        lines.append(f"\nНе ответили ({len(absent)}):")
        for e in absent:
            lines.append(f"  ❌ {e['name']}")
    text = "\n".join(lines)

    initiator = await db.get_user_by_id(pool, check["initiated_by"])
    admins = await db.get_admins(pool)
    from app.bot import send_message_to_user
    for admin in admins:
        await db.create_notification(pool, admin["id"], f"📍 Проверка завершена. На месте: {len(responses)}/{len(employees)}", "attendance")
        await send_message_to_user(admin["telegram_id"], text)


def setup_scheduler(pool: asyncpg.Pool) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=MOSCOW_TZ)
    scheduler.add_job(job_lateness, CronTrigger(hour=9, minute=5, timezone=MOSCOW_TZ),
                      args=[pool, 9*60+5, False], id="late_905")
    scheduler.add_job(job_lateness, CronTrigger(hour=9, minute=10, timezone=MOSCOW_TZ),
                      args=[pool, 9*60+10, False], id="late_910")
    scheduler.add_job(job_lateness, CronTrigger(hour=9, minute=15, timezone=MOSCOW_TZ),
                      args=[pool, 9*60+15, True], id="late_915")
    scheduler.add_job(job_close_shifts, CronTrigger(hour=18, minute=55, timezone=MOSCOW_TZ),
                      args=[pool], id="close_shifts")
    scheduler.add_job(job_missing_reports, CronTrigger(hour=19, minute=30, timezone=MOSCOW_TZ),
                      args=[pool], id="missing_reports")
    scheduler.add_job(job_attendance_expiry, CronTrigger(minute="*", timezone=MOSCOW_TZ),
                      args=[pool], id="attendance_expiry")
    return scheduler
