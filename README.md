# Web1C Shop - Интернет-магазин с интеграцией 1С:УТ 11.5

[![Docker](https://img.shields.io/badge/docker-compose-ready-blue.svg)](https://docs.docker.com/compose/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Mantine](https://img.shields.io/badge/Mantine-7-fa7f7f?logo=mantine)](https://mantine.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.9-2D3748?logo=prisma)](https://www.prisma.io/)

Многопользовательская платформа для веб-торговли с полной синхронизацией товаров, заказов и партнёров с 1С:Управление Торговлей 11.5 через OData.

## 🚀 Быстрый старт

### 1. Настройка окружения

```bash
# Скопируйте файл окружения
copy .env.example .env
```

Отредактируйте `.env`:
```ini
# 1C Connection
ONEC_URL=http://your-1c-server:8080/hs/odata
ONEC_USER=odata_user
ONEC_PASSWORD=your_password

# Database
POSTGRES_PASSWORD=web1c_secret

# Security
JWT_SECRET=your_secret_key_here
```

### 2. Запуск

```bash
# Сборка и запуск
docker compose up -d --build

# Инициализация БД
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

### 3. Вход

- **URL:** http://localhost
- **Email:** `admin@web1c.local`
- **Пароль:** `admin123`

⚠️ **Смените пароль после первого входа!**

## 📋 Документация

- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт и решение проблем
- [DOCS.md](DOCS.md) - Полная документация

## 🔧 Разработка

```bash
# Запуск с hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Доступ к app
docker compose exec app sh

# Логи
docker compose logs -f app
docker compose logs -f worker
```

## 🛠 Технологии

| Компонент | Технология |
|-----------|------------|
| Frontend | Next.js 14 + React 18 |
| UI | Mantine v7 |
| Backend | Next.js API Routes |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.9 |
| Queue | Redis + BullMQ |
| 1C Integration | OData v2 |
| PDF | @react-pdf/renderer |
| Excel | xlsx |

## 📦 Что внутри

- ✅ Синхронизация товаров и групп
- ✅ Загрузка изображений товаров
- ✅ Обновление остатков и цен
- ✅ Поиск партнёров по ИНН в 1С
- ✅ История заказов из 1С
- ✅ Резервирование товаров
- ✅ Печать накладных с штрих-кодом
- ✅ Склеивание контрагентов

## 🔐 Роли

| Роль | Возможности |
|------|-------------|
| **Администратор** | Синхронизация, управление партнёрами, настройка 1С подключения |
| **Партнёр** | Просмотр заказов, создание новых, история отгрузок |
| **Покупатель** | Корзина, упрощённые заказы |

## 📞 Поддержка

При проблемах смотрите:
1. [QUICKSTART.md](QUICKSTART.md) - Решение частых проблем
2. Логи: `docker compose logs -f`
3. Статус: `docker compose ps`

---

**Лицензия:** MIT  
**Версия:** 1.0.0
