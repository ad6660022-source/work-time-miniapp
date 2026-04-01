import asyncpg
import pytz
from datetime import datetime, timedelta, date as date_type
from typing import Optional, List

MOSCOW_TZ = pytz.timezone("Europe/Moscow")


# ─── USERS ───────────────────────────────────────────────────────────────────

async def get_user(pool: asyncpg.Pool, telegram_id: int) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)
        return dict(row) if row else None


async def get_user_by_id(pool: asyncpg.Pool, user_id: int) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None


async def create_user(pool: asyncpg.Pool, telegram_id: int, username: str, name: str) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO users (telegram_id, username, name) VALUES ($1, $2, $3) RETURNING *",
            telegram_id, username or "", name
        )
        user = dict(row)
        await conn.execute(
            "INSERT INTO user_schedules (user_id) VALUES ($1) ON CONFLICT DO NOTHING", user["id"]
        )
        return user


async def get_admins(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE is_admin = TRUE AND is_blocked = FALSE"
        )
        return [dict(r) for r in rows]


async def get_employees(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE is_approved = TRUE AND is_blocked = FALSE ORDER BY name"
        )
        return [dict(r) for r in rows]


async def get_non_admin_employees(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE is_approved=TRUE AND is_blocked=FALSE AND is_admin=FALSE ORDER BY name"
        )
        return [dict(r) for r in rows]


async def get_pending_users(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM users WHERE is_approved=FALSE AND is_blocked=FALSE ORDER BY created_at"
        )
        return [dict(r) for r in rows]


async def get_all_users(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM users ORDER BY is_admin DESC, name")
        return [dict(r) for r in rows]


async def approve_user(pool: asyncpg.Pool, user_id: int, position: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET is_approved=TRUE, position=$1 WHERE id=$2", position, user_id
        )
        await conn.execute(
            "INSERT INTO user_schedules (user_id) VALUES ($1) ON CONFLICT DO NOTHING", user_id
        )


async def update_user(pool: asyncpg.Pool, user_id: int, **kwargs) -> None:
    if not kwargs:
        return
    sets = ", ".join(f"{k}=${i+2}" for i, k in enumerate(kwargs.keys()))
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE users SET {sets} WHERE id=$1", user_id, *kwargs.values()
        )


async def toggle_admin(pool: asyncpg.Pool, user_id: int) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT is_admin FROM users WHERE id=$1", user_id)
        new_val = not row["is_admin"]
        await conn.execute("UPDATE users SET is_admin=$1 WHERE id=$2", new_val, user_id)
        return new_val


async def toggle_block(pool: asyncpg.Pool, user_id: int) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT is_blocked FROM users WHERE id=$1", user_id)
        new_val = not row["is_blocked"]
        await conn.execute("UPDATE users SET is_blocked=$1 WHERE id=$2", new_val, user_id)
        return new_val


# ─── SCHEDULES ───────────────────────────────────────────────────────────────

async def get_schedule(pool: asyncpg.Pool, user_id: int) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM user_schedules WHERE user_id=$1", user_id)
        return dict(row) if row else None


async def update_schedule(
    pool: asyncpg.Pool, user_id: int,
    work_days: List[int], shift_start: str, shift_end: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO user_schedules (user_id, work_days, shift_start, shift_end)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id) DO UPDATE
               SET work_days=$2, shift_start=$3, shift_end=$4""",
            user_id, work_days, shift_start, shift_end
        )


# ─── SHIFTS ──────────────────────────────────────────────────────────────────

async def start_shift(pool: asyncpg.Pool, user_id: int) -> dict:
    now = datetime.now(MOSCOW_TZ)
    today = now.date()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT * FROM shifts WHERE user_id=$1 AND date=$2", user_id, today
        )
        if existing and existing["status"] == "closed":
            # Resume: preserve previously worked time
            prev_start = existing["start_time"]
            prev_end = existing["end_time"]
            if prev_start and prev_end:
                worked_seconds = int((prev_end - prev_start).total_seconds())
            else:
                worked_seconds = 0
            virtual_start = now - timedelta(seconds=worked_seconds)
            row = await conn.fetchrow(
                """UPDATE shifts SET start_time=$1, status='active', end_time=NULL
                   WHERE user_id=$2 AND date=$3
                   RETURNING *""",
                virtual_start, user_id, today
            )
        else:
            start_time = MOSCOW_TZ.localize(
                datetime(today.year, today.month, today.day, 9, 0, 0)
            ) if now.hour < 9 else now
            row = await conn.fetchrow(
                """INSERT INTO shifts (user_id, date, start_time, status)
                   VALUES ($1, $2, $3, 'active')
                   ON CONFLICT (user_id, date) DO UPDATE
                   SET start_time=EXCLUDED.start_time, status='active', end_time=NULL
                   RETURNING *""",
                user_id, today, start_time
            )
        return dict(row)


async def end_shift(pool: asyncpg.Pool, user_id: int) -> Optional[dict]:
    now = datetime.now(MOSCOW_TZ)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE shifts SET end_time=$1, status='closed'
               WHERE user_id=$2 AND date=$3 AND status='active'
               RETURNING *""",
            now, user_id, now.date()
        )
        return dict(row) if row else None


# ─── BREAKS ──────────────────────────────────────────────────────────────────

async def start_break(pool: asyncpg.Pool, shift_id: int, user_id: int, break_type: str) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO shift_breaks (shift_id, user_id, type)
               VALUES ($1, $2, $3) RETURNING *""",
            shift_id, user_id, break_type
        )
        return dict(row)


async def end_break(pool: asyncpg.Pool, break_id: int) -> Optional[dict]:
    now = datetime.now(MOSCOW_TZ)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE shift_breaks SET end_time=$1 WHERE id=$2 RETURNING *",
            now, break_id
        )
        return dict(row) if row else None


async def get_active_break(pool: asyncpg.Pool, shift_id: int) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM shift_breaks WHERE shift_id=$1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
            shift_id
        )
        return dict(row) if row else None


async def get_shift_breaks(pool: asyncpg.Pool, shift_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM shift_breaks WHERE shift_id=$1 ORDER BY start_time",
            shift_id
        )
        return [dict(r) for r in rows]


async def close_all_open_breaks(pool: asyncpg.Pool, shift_id: int) -> None:
    now = datetime.now(MOSCOW_TZ)
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE shift_breaks SET end_time=$1 WHERE shift_id=$2 AND end_time IS NULL",
            now, shift_id
        )


# ─── RATINGS ─────────────────────────────────────────────────────────────────

async def upsert_report_rating(
    pool: asyncpg.Pool, user_id: int, report_date: date_type, rating: float, rated_by: int
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO report_ratings (user_id, date, rating, rated_by, rated_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (user_id, date) DO UPDATE
               SET rating=$3, rated_by=$4, rated_at=NOW()""",
            user_id, report_date, rating, rated_by
        )


async def get_report_rating(pool: asyncpg.Pool, user_id: int, report_date: date_type) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM report_ratings WHERE user_id=$1 AND date=$2",
            user_id, report_date
        )
        return dict(row) if row else None


async def get_ratings_by_date(pool: asyncpg.Pool, report_date: date_type) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM report_ratings WHERE date=$1",
            report_date
        )
        return [dict(r) for r in rows]


async def get_employee_extended_stats(pool: asyncpg.Pool, user_id: int) -> dict:
    async with pool.acquire() as conn:
        # Задачи
        task_row = await conn.fetchrow(
            """SELECT
               COUNT(CASE WHEN ta.status='assigned'    THEN 1 END) as assigned,
               COUNT(CASE WHEN ta.status='in_progress' THEN 1 END) as in_progress,
               COUNT(CASE WHEN ta.status='done'        THEN 1 END) as done
               FROM task_assignments ta JOIN tasks t ON ta.task_id=t.id
               WHERE ta.user_id=$1 AND t.status='active'""",
            user_id
        )
        # Опоздания
        late_count = await conn.fetchval(
            "SELECT COUNT(*) FROM late_records WHERE user_id=$1 AND marked_late=TRUE", user_id
        )
        # Общее время опозданий (разница между реальным стартом смены и началом по расписанию)
        late_minutes = await conn.fetchval(
            """SELECT COALESCE(SUM(
                 GREATEST(0, EXTRACT(EPOCH FROM (
                   s.start_time AT TIME ZONE 'Europe/Moscow' -
                   (s.date + us.shift_start)::TIMESTAMP
                 )) / 60)
               ), 0)::INTEGER
               FROM late_records lr
               JOIN shifts s ON s.user_id=lr.user_id AND s.date=lr.date
               JOIN user_schedules us ON us.user_id=lr.user_id
               WHERE lr.user_id=$1 AND lr.marked_late=TRUE AND s.start_time IS NOT NULL""",
            user_id
        )
        # Смен в этом месяце
        shifts_month = await conn.fetchval(
            """SELECT COUNT(*) FROM shifts WHERE user_id=$1
               AND date >= DATE_TRUNC('month', CURRENT_DATE) AND status='closed'""",
            user_id
        )
        # Общее рабочее время (минус перерывы) за все время
        total_work_minutes = await conn.fetchval(
            """SELECT COALESCE(SUM(
                 EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 -
                 COALESCE((
                   SELECT SUM(EXTRACT(EPOCH FROM (
                     COALESCE(sb.end_time, s.end_time) - sb.start_time
                   )) / 60)
                   FROM shift_breaks sb
                   WHERE sb.shift_id=s.id
                 ), 0)
               ), 0)::INTEGER
               FROM shifts s
               WHERE s.user_id=$1 AND s.status='closed'
               AND s.end_time IS NOT NULL AND s.start_time IS NOT NULL""",
            user_id
        )
        # Средняя оценка отчётов
        avg_rating = await conn.fetchval(
            "SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM report_ratings WHERE user_id=$1",
            user_id
        )
        return {
            "assigned": task_row["assigned"],
            "in_progress": task_row["in_progress"],
            "done": task_row["done"],
            "late_count": int(late_count),
            "late_minutes": int(late_minutes),
            "shifts_month": int(shifts_month),
            "total_work_minutes": int(total_work_minutes),
            "avg_rating": float(avg_rating) if avg_rating else None,
        }


async def get_user_shifts_history(pool: asyncpg.Pool, user_id: int) -> list:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM shifts WHERE user_id=$1 ORDER BY date DESC LIMIT 60",
            user_id
        )
        return [dict(r) for r in rows]


async def delete_user_shifts_history(pool: asyncpg.Pool, user_id: int) -> int:
    today = datetime.now(MOSCOW_TZ).date()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM shifts WHERE user_id=$1 AND date < $2 AND status='closed'",
            user_id, today
        )
        return int(result.split()[-1])


async def get_today_shift(pool: asyncpg.Pool, user_id: int) -> Optional[dict]:
    today = datetime.now(MOSCOW_TZ).date()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM shifts WHERE user_id=$1 AND date=$2", user_id, today
        )
        return dict(row) if row else None


async def get_today_shift_overview(pool: asyncpg.Pool) -> List[dict]:
    today = datetime.now(MOSCOW_TZ).date()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.id, u.name, u.position, s.start_time, s.end_time, s.status
               FROM users u
               LEFT JOIN shifts s ON u.id=s.user_id AND s.date=$1
               WHERE u.is_approved=TRUE AND u.is_blocked=FALSE
               ORDER BY u.name""",
            today
        )
        return [dict(r) for r in rows]


async def auto_close_all_active_shifts(pool: asyncpg.Pool) -> List[int]:
    now = datetime.now(MOSCOW_TZ)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """UPDATE shifts SET end_time=$1, status='closed'
               WHERE date=$2 AND status='active' RETURNING user_id""",
            now, now.date()
        )
        return [r["user_id"] for r in rows]


# ─── TASKS ───────────────────────────────────────────────────────────────────

async def create_task(pool: asyncpg.Pool, text: str, created_by: int) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO tasks (text, created_by) VALUES ($1, $2) RETURNING *", text, created_by
        )
        return dict(row)


async def assign_task(pool: asyncpg.Pool, task_id: int, user_id: int) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO task_assignments (task_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            task_id, user_id
        )


async def get_user_tasks(pool: asyncpg.Pool, user_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT t.id, t.text, t.created_at, ta.status as assignment_status, ta.updated_at
               FROM tasks t JOIN task_assignments ta ON t.id=ta.task_id
               WHERE ta.user_id=$1 AND t.status='active'
               ORDER BY t.created_at DESC""",
            user_id
        )
        return [dict(r) for r in rows]


async def get_task_with_assignees(pool: asyncpg.Pool, task_id: int) -> Optional[dict]:
    async with pool.acquire() as conn:
        task = await conn.fetchrow("SELECT * FROM tasks WHERE id=$1", task_id)
        if not task:
            return None
        assignees = await conn.fetch(
            """SELECT u.id, u.name, u.position, ta.status
               FROM task_assignments ta JOIN users u ON ta.user_id=u.id
               WHERE ta.task_id=$1""",
            task_id
        )
        result = dict(task)
        result["assignees"] = [dict(a) for a in assignees]
        return result


async def update_task_assignment_status(
    pool: asyncpg.Pool, task_id: int, user_id: int, status: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE task_assignments SET status=$1, updated_at=NOW() WHERE task_id=$2 AND user_id=$3",
            status, task_id, user_id
        )


async def update_task(pool: asyncpg.Pool, task_id: int, text: str) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE tasks SET text=$1 WHERE id=$2 RETURNING *", text, task_id
        )
        return dict(row) if row else None


async def archive_task(pool: asyncpg.Pool, task_id: int) -> None:
    async with pool.acquire() as conn:
        await conn.execute("UPDATE tasks SET status='archived' WHERE id=$1", task_id)


async def archive_completed_tasks(pool: asyncpg.Pool) -> int:
    async with pool.acquire() as conn:
        result = await conn.execute(
            """UPDATE tasks SET status='archived'
               WHERE status='active'
               AND id IN (
                   SELECT ta.task_id FROM task_assignments ta
                   GROUP BY ta.task_id
                   HAVING COUNT(*) = COUNT(CASE WHEN ta.status='done' THEN 1 END)
               )
               AND EXISTS (SELECT 1 FROM task_assignments ta2 WHERE ta2.task_id=tasks.id)"""
        )
        return int(result.split()[-1])


async def get_user_tasks_all(pool: asyncpg.Pool, user_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT t.id, t.text, t.created_at, ta.status as assignment_status, ta.updated_at
               FROM tasks t JOIN task_assignments ta ON t.id=ta.task_id
               WHERE ta.user_id=$1
               ORDER BY t.created_at DESC""",
            user_id
        )
        return [dict(r) for r in rows]


async def get_all_active_tasks(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT t.id, t.text, t.created_at, u.name as creator_name,
               COUNT(CASE WHEN ta.status='assigned'    THEN 1 END) as cnt_assigned,
               COUNT(CASE WHEN ta.status='in_progress' THEN 1 END) as cnt_in_progress,
               COUNT(CASE WHEN ta.status='done'        THEN 1 END) as cnt_done
               FROM tasks t
               LEFT JOIN users u ON t.created_by=u.id
               LEFT JOIN task_assignments ta ON t.id=ta.task_id
               WHERE t.status='active'
               GROUP BY t.id, u.name ORDER BY t.created_at DESC"""
        )
        return [dict(r) for r in rows]


async def get_employee_task_stats(pool: asyncpg.Pool, user_id: int) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT
               COUNT(CASE WHEN ta.status='assigned'    THEN 1 END) as assigned,
               COUNT(CASE WHEN ta.status='in_progress' THEN 1 END) as in_progress,
               COUNT(CASE WHEN ta.status='done'        THEN 1 END) as done
               FROM task_assignments ta JOIN tasks t ON ta.task_id=t.id
               WHERE ta.user_id=$1 AND t.status='active'""",
            user_id
        )
        late = await conn.fetchval(
            "SELECT COUNT(*) FROM late_records WHERE user_id=$1 AND marked_late=TRUE", user_id
        )
        shifts_month = await conn.fetchval(
            """SELECT COUNT(*) FROM shifts WHERE user_id=$1
               AND date >= DATE_TRUNC('month', CURRENT_DATE) AND status='closed'""",
            user_id
        )
        return {
            "assigned": row["assigned"], "in_progress": row["in_progress"],
            "done": row["done"], "late_count": late, "shifts_month": shifts_month,
        }


# ─── REPORTS ─────────────────────────────────────────────────────────────────

async def get_user_reports_history(pool: asyncpg.Pool, user_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM daily_reports WHERE user_id=$1 ORDER BY date DESC LIMIT 60",
            user_id
        )
        return [dict(r) for r in rows]


async def upsert_report(
    pool: asyncpg.Pool, user_id: int, report_date: date_type,
    done: str, problems: str, plans: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO daily_reports (user_id, date, done, problems, plans)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (user_id, date) DO UPDATE
               SET done=$3, problems=$4, plans=$5""",
            user_id, report_date, done, problems, plans
        )


async def get_today_report(pool: asyncpg.Pool, user_id: int) -> Optional[dict]:
    today = datetime.now(MOSCOW_TZ).date()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM daily_reports WHERE user_id=$1 AND date=$2", user_id, today
        )
        return dict(row) if row else None


async def get_reports_by_date(pool: asyncpg.Pool, report_date: date_type) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT dr.*, u.name, u.position
               FROM daily_reports dr JOIN users u ON dr.user_id=u.id
               WHERE dr.date=$1 ORDER BY u.name""",
            report_date
        )
        return [dict(r) for r in rows]


async def get_available_report_dates(pool: asyncpg.Pool) -> List[date_type]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT date FROM daily_reports ORDER BY date DESC LIMIT 30"
        )
        return [r["date"] for r in rows]


async def get_users_without_report(pool: asyncpg.Pool) -> List[dict]:
    today = datetime.now(MOSCOW_TZ).date()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.* FROM users u
               WHERE u.is_approved=TRUE AND u.is_blocked=FALSE
               AND NOT EXISTS (
                   SELECT 1 FROM daily_reports dr
                   WHERE dr.user_id=u.id AND dr.date=$1 AND dr.plans IS NOT NULL
               )""",
            today
        )
        return [dict(r) for r in rows]


# ─── ATTENDANCE ───────────────────────────────────────────────────────────────

async def create_attendance_check(
    pool: asyncpg.Pool, initiated_by: int, expires_at: datetime
) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO attendance_checks (initiated_by, expires_at) VALUES ($1,$2) RETURNING *",
            initiated_by, expires_at
        )
        return dict(row)


async def add_attendance_response(pool: asyncpg.Pool, check_id: int, user_id: int) -> bool:
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO attendance_responses (check_id, user_id) VALUES ($1,$2)",
                check_id, user_id
            )
            return True
        except asyncpg.UniqueViolationError:
            return False


async def get_attendance_responses(pool: asyncpg.Pool, check_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.id, u.name, ar.responded_at
               FROM attendance_responses ar JOIN users u ON ar.user_id=u.id
               WHERE ar.check_id=$1""",
            check_id
        )
        return [dict(r) for r in rows]


async def get_active_attendance_check(pool: asyncpg.Pool) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM attendance_checks WHERE is_closed=FALSE ORDER BY created_at DESC LIMIT 1"
        )
        return dict(row) if row else None


async def close_attendance_check(pool: asyncpg.Pool, check_id: int) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE attendance_checks SET is_closed=TRUE WHERE id=$1", check_id
        )


# ─── LATE RECORDS ────────────────────────────────────────────────────────────

async def get_late_record(pool: asyncpg.Pool, user_id: int, check_date: date_type) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM late_records WHERE user_id=$1 AND date=$2", user_id, check_date
        )
        return dict(row) if row else None


async def upsert_late_record(
    pool: asyncpg.Pool, user_id: int, check_date: date_type, **kwargs
) -> None:
    if not kwargs:
        return
    cols = list(kwargs.keys())
    vals = list(kwargs.values())
    inserts = ", ".join(f"${i+3}" for i in range(len(cols)))
    updates = ", ".join(f"{c}=${i+3}" for i, c in enumerate(cols))
    async with pool.acquire() as conn:
        await conn.execute(
            f"""INSERT INTO late_records (user_id, date, {', '.join(cols)})
                VALUES ($1, $2, {inserts})
                ON CONFLICT (user_id, date) DO UPDATE SET {updates}""",
            user_id, check_date, *vals
        )


# ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

async def create_notification(
    pool: asyncpg.Pool, user_id: int, text: str, notif_type: str = "info"
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO notifications (user_id, text, type) VALUES ($1,$2,$3)",
            user_id, text, notif_type
        )


async def get_notifications(pool: asyncpg.Pool, user_id: int) -> List[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM notifications WHERE user_id=$1
               ORDER BY created_at DESC LIMIT 50""",
            user_id
        )
        return [dict(r) for r in rows]


async def mark_notifications_read(pool: asyncpg.Pool, user_id: int) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE notifications SET is_read=TRUE WHERE user_id=$1", user_id
        )


async def get_unread_count(pool: asyncpg.Pool, user_id: int) -> int:
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE", user_id
        )
