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


def _is_workday(sched, weekday: int) -> bool:
    if sched and sched.get("work_days"):
        return weekday in list(sched["work_days"])
    return weekday in [0, 1, 2, 3, 4]  # default Mon–Fri


async def job_lateness(pool: asyncpg.Pool, threshold_minute: int, notify_admin: bool):
    today = datetime.now(MOSCOW_TZ).date()
    weekday = today.weekday()
    employees = await db.get_employees(pool)
    from app.bot import send_message_to_user, send_to_group

    late_names = []  # для отправки в группу на 9:15

    for emp in employees:
        sched = await db.get_schedule(pool, emp["id"])
        if not _is_workday(sched, weekday):
            continue
        shift = await db.get_today_shift(pool, emp["id"])
        if shift:
            continue

        late = await db.get_late_record(pool, emp["id"], today)

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
                late_names.append(emp["name"])
        except Exception as e:
            logger.warning(f"Lateness job error for {emp['id']}: {e}")

    # Одно сообщение в группу со всеми опоздавшими
    if notify_admin and late_names and await db.get_setting(pool, "notify_late") == "true":
        group_id = await db.get_setting(pool, "group_chat_id")
        if group_id:
            names_str = "\n".join(f"  🔴 {n}" for n in late_names)
            await send_to_group(group_id, f"🔴 <b>Опоздания на 9:15</b>\n\n{names_str}")


async def job_close_shifts(pool: asyncpg.Pool):
    today = datetime.now(MOSCOW_TZ).date()
    weekday = today.weekday()
    employees = await db.get_employees(pool)
    any_working = any(_is_workday(await db.get_schedule(pool, e["id"]), weekday) for e in employees)
    if not any_working:
        return

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
    today = datetime.now(MOSCOW_TZ).date()
    weekday = today.weekday()

    missing_all = await db.get_users_without_report(pool)
    if not missing_all:
        return

    # Фильтруем: только те, у кого сегодня рабочий день по графику
    missing = []
    for u in missing_all:
        sched = await db.get_schedule(pool, u["id"])
        if _is_workday(sched, weekday):
            missing.append(u)

    if not missing:
        return

    admins = await db.get_admins(pool)
    from app.bot import send_message_to_user, send_to_group
    text = f"📋 <b>Отчёты не сданы</b>\n\n" + "\n".join(f"• {u['name']}" for u in missing)
    names = ", ".join(u["name"] for u in missing)
    for admin in admins:
        await db.create_notification(pool, admin["id"], f"📋 Не сдали отчёт: {names}", "report")
        await send_message_to_user(admin["telegram_id"], text)

    # В группу
    if await db.get_setting(pool, "notify_reports") == "true":
        group_id = await db.get_setting(pool, "group_chat_id")
        if group_id:
            await send_to_group(group_id, text)


async def job_reports_summary(pool: asyncpg.Pool):
    """Сводка отчётов за день в группу в 19:05."""
    if await db.get_setting(pool, "notify_reports") != "true":
        return
    group_id = await db.get_setting(pool, "group_chat_id")
    if not group_id:
        return

    today = datetime.now(MOSCOW_TZ).date()
    weekday = today.weekday()

    # Проверяем: есть ли хоть один сотрудник у которого сегодня рабочий день
    employees = await db.get_employees(pool)
    any_working = any(_is_workday(await db.get_schedule(pool, e["id"]), weekday) for e in employees)
    if not any_working:
        return
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT done, problems, plans FROM daily_reports WHERE date=$1",
            today
        )

    if not rows:
        return

    done_items    = [r["done"]     for r in rows if r["done"]     and r["done"]     != "—"]
    problem_items = [r["problems"] for r in rows if r["problems"] and r["problems"] != "—"]
    plan_items    = [r["plans"]    for r in rows if r["plans"]    and r["plans"]    != "—"]

    lines = [f"📊 <b>Итоги дня {today.strftime('%d.%m.%Y')}:</b>\n"]
    if done_items:
        lines.append("✅ <b>Что сделано:</b>")
        for item in done_items:
            lines.append(f"— {item}")
    if problem_items:
        lines.append("\n⚠️ <b>Проблемы:</b>")
        for item in problem_items:
            lines.append(f"— {item}")
    if plan_items:
        lines.append("\n📅 <b>Планы на завтра:</b>")
        for item in plan_items:
            lines.append(f"— {item}")

    from app.bot import send_to_group
    await send_to_group(group_id, "\n".join(lines))


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
    employees = await db.get_employees(pool)
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
    from app.bot import send_message_to_user, send_to_group
    for admin in admins:
        await db.create_notification(pool, admin["id"], f"📍 Проверка завершена. На месте: {len(responses)}/{len(employees)}", "attendance")
        await send_message_to_user(admin["telegram_id"], text)

    # Итог проверки в группу
    if await db.get_setting(pool, "notify_attendance") == "true":
        group_id = await db.get_setting(pool, "group_chat_id")
        await send_to_group(group_id, text)


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
    scheduler.add_job(job_reports_summary, CronTrigger(hour=19, minute=5, timezone=MOSCOW_TZ),
                      args=[pool], id="reports_summary")
    scheduler.add_job(job_attendance_expiry, CronTrigger(minute="*", timezone=MOSCOW_TZ),
                      args=[pool], id="attendance_expiry")
    return scheduler
