# Деплой Mini App на Railway

## 1. Подготовка бота в @BotFather

1. Откройте @BotFather → `/newbot` (или используйте существующий)
2. `/mybots` → выберите бота → **Bot Settings → Menu Button**
3. Укажите URL: `https://ваш-домен.up.railway.app`
4. Текст кнопки: `Открыть приложение`

---

## 2. Загрузить на GitHub

```bash
cd "work-time-miniapp"
git init
git add .
git commit -m "Initial mini app"
git remote add origin https://github.com/YOU/work-time-miniapp.git
git push -u origin main
```

---

## 3. Создать проект на Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Выбрать ваш репозиторий

---

## 4. Добавить PostgreSQL

В проекте: **New → Database → Add PostgreSQL**

---

## 5. Переменные окружения

В Railway → Variables:

| Переменная | Значение |
|---|---|
| `BOT_TOKEN` | Токен бота от @BotFather |
| `DATABASE_URL` | Автоматически из Railway PostgreSQL |
| `FIRST_ADMIN_ID` | Ваш Telegram ID (получить у @userinfobot) |
| `WEBAPP_URL` | `https://ВАШ-ДОМЕН.up.railway.app` |
| `TIMEZONE` | `Europe/Moscow` |

> После первого деплоя Railway покажет домен — вернитесь и заполните `WEBAPP_URL`, затем нажмите **Redeploy**

---

## 6. Первый запуск

1. Напишите боту `/start`
2. Нажмите **«Открыть приложение»**
3. Вы сразу попадёте как администратор (по `FIRST_ADMIN_ID`)
4. Другие пользователи регистрируются через Mini App — вводят имя, вы одобряете из раздела «Команда»

---

## Структура приложения

```
Сотрудник:           Администратор:
├─ Главная (смена)   ├─ Дашборд + проверка на месте
├─ Задачи            ├─ Команда (одобрение, график, блок)
├─ Прогресс          ├─ Задачи (создание, назначение)
├─ Отчёт             ├─ Отчёты (история по датам)
└─ Уведомления       └─ Уведомления
```

---

## Локальная разработка

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example .env  # заполнить значения
uvicorn app.main:app --reload

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev
```

Фронтенд проксирует `/api` на `localhost:8000` через vite.config.ts.
