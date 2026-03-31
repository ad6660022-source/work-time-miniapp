import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    FIRST_ADMIN_ID: int = int(os.getenv("FIRST_ADMIN_ID", "0"))
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "")
    TIMEZONE: str = os.getenv("TIMEZONE", "Europe/Moscow")


settings = Settings()
