# AEVOTRON — техническая спецификация и архитектура
Версия: 0.2 · Статус: self-hosted backend в Preview; production-релиз не выполнен

## 1. Цель продукта

Единая платформа доступа к каталогу ИИ-моделей через унифицированный API. Базовая модель раннего запуска — BYOK (Bring Your Own Key): пользователь подключает собственные учётные данные поддерживаемого поставщика. AEVOTRON не финансирует чужие API-вызовы и не перепродаёт ключи поставщиков.

## 2. Текущий объём MVP

Реализовано в self-hosted ветке:
- Публичный лендинг и интерфейс workspace.
- Регистрация и вход по email/паролю, подтверждение email, восстановление пароля.
- TOTP MFA.
- Workspace и серверная проверка принадлежности данных пользователю.
- Подключение, проверка и отзыв OpenAI API credential.
- Создание и отзыв AEVOTRON API keys; полный ключ показывается только один раз.
- Каталог доступных моделей OpenAI, usage summary и metadata-only events.
- Базовый OpenAI-compatible endpoint `POST /v1/chat/completions` без streaming.
- PostgreSQL, миграции, Docker Compose и Nginx gateway.

Пока не входит в реализованный MVP:
- Дополнительные provider adapters (Anthropic, Google и другие).
- Streaming, tool calls, embeddings, image/audio/video и другие multimodal-запросы.
- Платёжный процессинг, кошельки, кредиты и platform-funded API usage.
- Полная совместимость со всеми расширениями OpenAI API.
- Полная browser-level E2E-проверка всех пользовательских сценариев.

## 3. Роли и доступ

- Anonymous: публичные страницы и документация.
- User: собственный workspace, подключённые провайдеры, API keys и usage.
- Admin: административные функции каталога и поддержки — отдельный этап.

Все пользовательские операции авторизуются на сервере. Идентификатор владельца нельзя принимать из клиентского запроса как источник полномочий. Доступ к workspace и связанным сущностям проверяется по подтверждённой сессии и членству.

## 4. Архитектура

### Frontend
- React 19 + TanStack Start.
- Vite/Nitro для SSR и серверных proxy routes.
- UI и routes расположены в `src/`.
- Поддерживаемые языки интерфейса: English, Русский, 简体中文.

### Backend
- Отдельный Node.js API: `backend/src/server.js`.
- PostgreSQL и SQL migrations: `backend/migrations/`.
- Криптографические примитивы: `backend/src/security.js`.
- Email delivery через SMTP: `backend/src/mailer.js`.
- Same-origin API: `/api/v1/*`; gateway: `/v1/chat/completions`.

### Локальная инфраструктура
- Docker Compose запускает PostgreSQL, backend API, Nitro frontend и Nginx gateway.
- PostgreSQL и backend не публикуются напрямую на host ports.
- Nginx слушает `127.0.0.1:3000` и проксирует frontend/API.
- Vercel Preview использует `API_INTERNAL_URL` для связи с отдельно размещённым backend.

## 5. Основные сущности

- `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `mfa_factors`, `mfa_challenges`.
- `workspaces`, `workspace_members`.
- `provider_connections`, `models`, `api_keys`.
- `usage_events`, `audit_events`, `rate_limit_buckets`, `api_key_rate_limits`.

Секреты провайдеров и TOTP хранятся в зашифрованном виде. В таблице API keys хранится HMAC digest и короткий prefix, но не полный токен. Usage/audit events не должны содержать prompt или completion text.

## 6. API контракт

### `POST /v1/chat/completions`

Headers:
- `Authorization: Bearer mh_live_...`
- `Content-Type: application/json`

Поддерживается текстовый non-streaming Chat Completions request. Ограничения текущей реализации: тело до 64 KB, до 50 сообщений, ограничение `max_tokens`; `stream: true` отклоняется. Upstream сейчас фиксирован на OpenAI API.

### Основные пользовательские endpoints

- `/api/v1/auth/*` — регистрация, сессия, email verification, password reset и MFA.
- `/api/v1/workspaces/*` — создание и чтение workspace.
- `/api/v1/api-keys` — управление ключами AEVOTRON.
- `/api/v1/providers/*` — подключение и проверка OpenAI credential.
- `/api/v1/models` и `/api/v1/providers/openai/models` — список доступных моделей.
- `/api/v1/usage/*` — сводка и события использования.

## 7. Безопасность

- Пароли: scrypt с индивидуальной случайной солью и фиксированными параметрами проверки.
- Сессии: случайные opaque tokens; в БД хранится SHA-256 hash. Cookie: HttpOnly, SameSite=Lax, Secure в HTTPS/production.
- MFA: TOTP с одноразовыми, ограниченными по времени login challenges.
- Provider credentials и TOTP secrets: AES-256-GCM с AAD, привязанным к контексту пользователя/workspace/provider.
- AEVOTRON API keys: случайные 256-bit secrets; в БД хранится HMAC-SHA-256 digest.
- `AEVOTRON_MASTER_KEY`: Base64 от ровно 32 случайных байт; хранить отдельно от репозитория и резервировать безопасно.
- `IP_HASH_SALT`: отдельный случайный секрет для псевдонимизации IP в rate-limit buckets.
- Auth и API-key rate limits используют PostgreSQL.
- SQL-запросы параметризуются; workspace ownership проверяется на сервере.
- Usage/audit events append-only; prompt/completion content не записывается.
- Не логировать Authorization, cookies, provider credentials, API keys и содержимое запросов.

RLS в PostgreSQL пока не является реализованной границей безопасности: изоляция сейчас обеспечивается серверными проверками ownership/membership и SQL predicates. Не заявлять наличие RLS до отдельной реализации и тестирования.

## 8. Региональные и юридические ограничения

- Доступность провайдера зависит от его действующих Terms, страны пользователя и типа аккаунта.
- Не обходить геоблокировки, санкционные, KYC, экспортные или платёжные ограничения.
- До публичного запуска отдельно определить оператора персональных данных, цели/состав обработки, сроки хранения, трансграничную передачу, локализацию и необходимые уведомления/согласия.
- Платежи, налоги, валютные схемы и коммерческие условия требуют отдельной юридической и финансовой проверки.

## 9. Этапы разработки

### M0 — UI scaffold
Выполнено: навигация, лендинг, dashboard, каталог, provider cards, API keys, usage, документация и responsive layout.

### M1 — Auth + data model
Базовая реализация выполнена: email/password auth, email verification, password reset, TOTP MFA, sessions, workspace и PostgreSQL schema. Нужны расширенные integration tests и проверка конкурентных сценариев.

### M2 — Provider connections
Выполнена базовая интеграция OpenAI: connect/test/revoke и model discovery. Другие провайдеры не реализованы.

### M3 — API gateway
Выполнен базовый non-streaming Chat Completions gateway, API-key auth, ограничения запросов и usage metadata. Нужны дополнительные contract/integration tests и отказоустойчивость.

### M4 — Hardening & private beta
В процессе: browser-level E2E, email/MFA/password-reset integration tests, API-key lifecycle tests, dependency review, backup/restore, monitoring, abuse controls и эксплуатационные инструкции.

### M5 — Commercial readiness
Не начат: региональная матрица провайдеров, legal review, billing ledger, refunds/disputes, налоги и support operations.

## 10. Критерии приёмки перед production

- Anonymous не может читать или изменять workspace data.
- User A не может получить данные User B прямым вызовом backend endpoint.
- Provider credential не возвращается после сохранения и не попадает в логи.
- Отозванный AEVOTRON API key перестаёт работать.
- MFA challenges, email verification и password reset tokens одноразовые и имеют срок действия.
- Валидный API key маршрутизирует запрос к подключённому provider; невалидные ключи/модели/лимиты дают предсказуемые ошибки.
- Usage events создаются без сохранения prompt/completion content.
- Auth, backend security, lint, production build и Docker smoke tests проходят.
- Browser-level tests покрывают регистрацию, вход, MFA, восстановление пароля, подключение провайдера и жизненный цикл API keys.
- Проверены резервное копирование и восстановление PostgreSQL и master key.

## 11. Текущий статус релиза

Ветка `feat/self-hosted-backend` предназначена для Preview и миграции. Она не опубликована в Vercel Production. Не выполнять merge/promote и не менять production domains, DNS или production environment variables без отдельного разрешения.

Перед production необходимо развернуть self-hosted API, настроить `API_INTERNAL_URL`, SMTP и HTTPS cookies, выполнить browser-level integration tests и проверить операционные процедуры. Текущий Docker smoke test подтверждает запуск сервисов, доступность HTML/assets/routes и отказ анонимной сессии, но не заменяет полный E2E.
