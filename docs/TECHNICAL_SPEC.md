# ModelHub — Техническое задание и архитектура MVP
Версия: 0.1 · Статус: UI scaffold готов, backend в разработке

## 1. Цель продукта
Единая платформа доступа к каталогу ИИ-моделей через унифицированный API. Рынки: РФ и международный. Основная модель раннего запуска — BYOK (Bring Your Own Key): пользователь подключает собственные учётные данные поддерживаемого поставщика. ModelHub не финансирует чужие API-вызовы и не перепродаёт ключи поставщиков.

## 2. Область MVP
### Включено
- Публичная главная/панель workspace.
- Каталог моделей и фильтрация.
- Разделы Providers, API keys, Usage & logs, Quickstart, API reference.
- Пользовательская регистрация и авторизация (через встроенную auth платформы; необходимо подключить к интерфейсу).
- Подключение ключей провайдеров только через защищённые серверные формы.
- Генерация и отзыв собственных ключей ModelHub.
- Единый OpenAI-compatible endpoint: POST /v1/chat/completions.
- Маршрутизация к одному из подключённых провайдеров.
- Учёт запросов, latency, usage, ошибок и приблизительной стоимости.
- Административные настройки каталога, статусов интеграций и лимитов.

### Не входит в MVP
- Платёжный процессинг и кошельки.
- Автоматическая продажа токенов / кредитов.
- Обход геоблокировок, санкций, KYC или ограничений поставщиков.
- Гарантированная доступность каждой модели из каждой страны.
- Обучение и хостинг собственных крупных моделей.
- Сложная балансировка нагрузки и автоматический failover между несовместимыми моделями.

## 3. Роли и доступ
- Anonymous: просмотр публичного каталога и документации.
- User: собственный workspace, провайдерские подключения, API keys, usage/logs.
- Admin: каталог, глобальные настройки, поддержка и аудит.
Все записи с пользовательскими данными принадлежат конкретному user/workspace. Любой доступ проверяется на сервере; скрытие кнопки в UI не является контролем доступа.

## 4. Основные пользовательские сценарии
1. Пользователь регистрируется и создаёт workspace.
2. Выбирает провайдера из доступных для его страны/аккаунта.
3. Добавляет API credential через серверную форму. Секрет никогда не возвращается в браузер после сохранения.
4. Создаёт ModelHub API key. Полное значение показывается только один раз; в БД хранится только криптографический hash.
5. Отправляет запрос на POST /v1/chat/completions с ModelHub key и именем модели.
6. Gateway проверяет ключ, статус, лимиты, владельца подключения и доступность модели.
7. Gateway преобразует запрос в формат провайдера, выполняет запрос, нормализует ответ и пишет событие usage без содержимого prompt по умолчанию.
8. Пользователь видит метрики и redacted logs в панели.

## 5. Архитектура
### Frontend
- React 19 + TanStack Start, JavaScript.
- Серверный рендеринг публичных страниц.
- Персональные страницы — только после проверки сессии; не кешировать персональные данные публично.
- UI: Dashboard, Model catalog, Providers, API keys, Usage & logs, Quickstart, API reference, Preferences.

### Backend
- Отдельный Node.js API в `backend/`, PostgreSQL и same-origin proxy routes TanStack Start / Nitro.
- PostgreSQL-подобное хранилище сущностей.
- Provider adapters: один адаптер на провайдера, общий внутренний контракт.
- Gateway endpoint: POST /v1/chat/completions.
- Секреты в server-side secret storage / encrypted fields; никогда в VITE_* и клиентских данных.
- Логи с redaction; request/response bodies не сохранять по умолчанию.

### Поток запроса
Client -> ModelHub API key -> auth + quota -> workspace ownership -> model registry -> provider connection -> provider adapter -> upstream API -> response normalization -> usage event.

### Внутренний контракт адаптера
- validateModel(model)
- buildRequest(messages, options, credential)
- execute(request, abortSignal)
- normalizeResponse(providerResponse)
- extractUsage(providerResponse)
Ошибки upstream преобразуются в безопасный единый формат без раскрытия секретов или внутренних заголовков.

## 6. Предлагаемые сущности БД
### Workspace
id, owner_user_id, name, region, created_at

### WorkspaceMember
id, workspace_id, user_id, role (owner/admin/member), created_at

### ProviderConnection
id, workspace_id, provider_code, display_name, credential_ciphertext, credential_key_version, status, last_tested_at, created_at, updated_at
Секрет шифруется на сервере с ключом из secret storage. Если безопасное шифрование недоступно в выбранном backend, не сохранять ключи и временно использовать прямой режим BYOK через безопасный server-side secret mechanism.

### Model
id, provider_code, provider_model_id, display_name, modality, context_window, capabilities_json, status, region_availability_json, pricing_reference, created_at, updated_at

### ApiKey
id, workspace_id, name, key_prefix, key_hash, scopes_json, last_used_at, expires_at, revoked_at, created_at
Полное значение ключа показывается только при создании.

### UsageEvent
id, workspace_id, api_key_id, model_id, provider_code, request_id, input_tokens, output_tokens, latency_ms, status_code, error_code, estimated_cost, created_at
Не хранить prompt/completion по умолчанию. Ввести короткий retention для диагностических метаданных.

### AuditEvent
id, workspace_id, actor_user_id, action, target_type, target_id, metadata_redacted_json, created_at

## 7. API контракт
### POST /v1/chat/completions
Headers:
- Authorization: Bearer mh_live_...
- Content-Type: application/json

Request:
{
  "model": "provider/model-id",
  "messages": [{"role":"user","content":"Hello"}],
  "temperature": 0.7,
  "max_tokens": 512,
  "stream": false
}

Response: OpenAI-compatible choices/usage envelope. В первой версии stream=true возвращает 400 с понятным кодом unsupported_streaming, пока потоковая передача не реализована. Не обещать совместимость со всеми расширениями поставщиков.

Ошибки:
- 401 invalid_api_key
- 403 model_not_allowed / provider_not_connected
- 404 model_not_found
- 429 rate_limit_exceeded / quota_exceeded
- 502 upstream_provider_error
- 504 upstream_timeout

### GET /v1/models
Возвращает только модели, разрешённые для текущего workspace и доступные через активные подключения.

## 8. Безопасность
- Хэшировать ModelHub keys (SHA-256 с pepper либо HMAC-SHA-256); pepper только в server secret storage.
- Не логировать Authorization, provider credentials, cookies, полные prompt/response.
- Ограничить размер тела, число сообщений, max_tokens и timeout.
- Rate limit на API key и workspace.
- Защита от SSRF: не разрешать произвольные upstream URL без allowlist; для OpenAI-compatible custom endpoints — HTTPS only, блокировать loopback/private/link-local IP, проверять DNS/IP после разрешения.
- Проверять принадлежность всех workspace records текущему пользователю.
- RLS включить на каждой таблице пользовательских данных.
- Ротация/отзыв ключей, аудит административных действий.
- CSP, безопасные заголовки, CSRF-защита для cookie-auth flows.
- Не выводить stack traces и upstream bodies клиенту.

## 9. РФ и международный рынок
- Поддерживать конфигурацию региона workspace и провайдеров.
- Перед подключением каждого поставщика проверять его действующие Terms, санкционные/экспортные ограничения, допустимость страны пользователя и способа оплаты.
- Не обещать доступность моделей там, где поставщик её не разрешает.
- Отдельно определить оператора персональных данных, цели/состав обработки, сроки хранения, трансграничную передачу, локализацию и необходимые уведомления/согласия по применимому праву РФ и стран клиентов.
- Платежи, налоги, валютный контроль и юридическое лицо не включать в MVP до отдельной проверки специалистом.
- Не использовать прокси, фиктивные адреса или чужие аккаунты для обхода ограничений.

## 10. Этапы разработки
### M0 — UI scaffold (выполнено)
- Навигация, dashboard, каталог, provider cards, API keys, usage, docs.
- Responsive layout.
- Lint и production build проходят.

### M1 — Auth + data model
- Подключить встроенную авторизацию.
- Создать Workspace, ProviderConnection, Model, ApiKey, UsageEvent, AuditEvent.
- Проверить RLS и тесты изоляции между двумя пользователями.

### M2 — Provider connections
- Начать с одного провайдера с официальным API и разрешённой географией.
- Secure credential handling, test connection, revoke.
- Не активировать другие интеграции без отдельной проверки условий.

### M3 — API gateway
- Реализовать auth middleware для ModelHub key, model registry, adapter, нормализацию ошибок.
- Request limits, timeout, redaction, usage accounting.
- Contract tests с mock upstream.

### M4 — hardening & private beta
- Rate limit, SSRF protections, audit logs, abuse controls.
- Integration tests, dependency audit, backup/restore test.
- Закрытая бета с тестовыми пользователями и без платёжного процессинга.

### M5 — commercial readiness
- Региональная матрица провайдеров и legal review.
- Выбор платёжного провайдера, налогообложения и валютных схем.
- Лимиты, billing ledger, refunds/disputes и support operations.

## 11. Критерии приёмки MVP
- Anonymous не может читать/изменять workspace data.
- User A не может получить данные User B даже прямым вызовом backend endpoint.
- Секрет провайдера не возвращается после сохранения и не попадает в логи.
- Отозванный ModelHub key немедленно перестаёт работать.
- Запрос с валидным ключом маршрутизируется к выбранному mock/provider adapter.
- Usage event создаётся для успеха и ошибки; секреты и prompt не записываются.
- Лимиты и таймауты проверяются на сервере.
- Невалидные модели и неподключённые провайдеры дают предсказуемые ошибки.
- lint, build и тесты проходят.

## 12. Ограничения текущего прототипа
Текущая версия — интерактивный UI scaffold. Каталог содержит демонстрационные записи, а API URL и формы подключения являются макетами. Пока нет реальной регистрации, постоянной БД, безопасного хранения provider credentials, API key issuance или рабочего gateway. Не отправляйте реальные ключи и production traffic до реализации M1–M4.