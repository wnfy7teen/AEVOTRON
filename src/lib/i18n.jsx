import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LanguageContext = createContext({ language: "en", setLanguage: () => {}, t: (value) => value });

const dictionaries = {
  ru: {
    "Sign in":"Войти","Get started":"Начать","UNIFIED AI INFRASTRUCTURE":"ЕДИНАЯ ИНФРАСТРУКТУРА ИИ",
    "One API.":"Один API.","Every model.":"Для любой модели.","One API. Every model.":"Один API. Любая модель.",
    "Connect AI providers through one consistent interface. Route requests, manage credentials, and understand usage from a single workspace.":"Подключайте ИИ-провайдеров через единый интерфейс. Маршрутизируйте запросы, управляйте учётными данными и отслеживайте использование из одного рабочего пространства.",
    "Create your workspace":"Создать рабочее пространство","BYOK-first architecture · No platform-funded API usage in the initial release":"Архитектура BYOK · На первом этапе платформа не оплачивает использование API",
    "Gateway architecture":"Архитектура шлюза","Preview":"Предпросмотр","Provider credentials remain server-side":"Учётные данные провайдеров хранятся только на сервере",
    "One model interface":"Единый интерфейс моделей","A consistent API surface across supported model providers.":"Единый API-интерфейс для поддерживаемых провайдеров моделей.",
    "Credentials under control":"Учётные данные под контролем","BYOK-first design with server-side secret handling and scoped access.":"Подход BYOK, серверное хранение секретов и разграничение доступа.",
    "Built for developers":"Создано для разработчиков","OpenAI-compatible requests, usage records, and practical documentation.":"Запросы, совместимые с OpenAI, учёт использования и практическая документация.",
    "Availability depends on provider terms and regional access":"Доступность зависит от условий провайдеров и региона",
    "WORKSPACE":"РАБОЧЕЕ ПРОСТРАНСТВО","DEVELOPERS":"РАЗРАБОТЧИКАМ","SETTINGS":"НАСТРОЙКИ",
    "Overview":"Обзор","Model catalog":"Каталог моделей","API keys":"API-ключи","Usage & logs":"Использование и журналы",
    "Quickstart":"Быстрый старт","API reference":"Справочник API","Providers":"Провайдеры","Preferences":"Предпочтения",
    "Personal workspace":"Личное рабочее пространство","Loading workspace…":"Загрузка рабочего пространства…","Workspace unavailable":"Рабочее пространство недоступно",
    "Free plan":"Бесплатный тариф","Personal account":"Личный аккаунт","Global":"Глобально","Help":"Помощь",
    "AI INFRASTRUCTURE, SIMPLIFIED":"ИНФРАСТРУКТУРА ИИ — ПРОСТО","Connect provider":"Подключить провайдера",
    "Connect your providers once. Build with the models you need.":"Подключите провайдеров один раз и работайте с нужными моделями.",
    "Requests this month":"Запросов за месяц","Models available":"Доступно моделей","Avg. latency":"Средняя задержка","Your API spend":"Расходы на API",
    "Ready when you are":"Готово к работе","Across 6 model families":"В 6 семействах моделей","No requests yet":"Запросов пока нет","BYOK · no platform markup":"BYOK · без наценки платформы",
    "Get started":"Начало работы","Three steps to your first API call.":"Три шага до первого вызова API.","0 of 3 complete":"Выполнено: 0 из 3",
    "Connect a provider":"Подключите провайдера","Add your own API key. It stays private and is never shown in the browser again.":"Добавьте собственный API-ключ. Он останется конфиденциальным и больше не будет отображаться в браузере.",
    "Add provider":"Добавить провайдера","Create a ModelHub key":"Создайте ключ ModelHub","Generate a single key for your apps and services to authenticate requests.":"Создайте единый ключ для аутентификации запросов ваших приложений и сервисов.",
    "Create API key":"Создать API-ключ","Make your first request":"Выполните первый запрос","Use our OpenAI-compatible endpoint with any supported model.":"Используйте совместимую с OpenAI конечную точку с любой поддерживаемой моделью.",
    "View quickstart":"Открыть быстрый старт","Popular models":"Популярные модели","Start exploring the catalog":"Начните изучать каталог","View all":"Показать все",
    "Quick API example":"Пример API-запроса","OpenAI-compatible interface":"Интерфейс, совместимый с OpenAI","Copied":"Скопировано","Copy example":"Копировать пример",
    "Your keys, your control.":"Ваши ключи — под вашим контролем.","ModelHub is designed around BYOK. This demo does not collect or transmit secrets.":"ModelHub построен на принципе BYOK. Эта демонстрационная версия не собирает и не передаёт секреты.",
    "DISCOVER":"ОБЗОР","Explore model families and choose the right engine for your workload.":"Изучайте семейства моделей и выбирайте подходящую модель для своих задач.",
    "Search models or providers...":"Поиск моделей или провайдеров...","All models":"Все модели","Sort":"Сортировать",
    "MODEL":"МОДЕЛЬ","CONTEXT":"КОНТЕКСТ","ACCESS":"ДОСТУП","No models match your search.":"По вашему запросу модели не найдены.",
    "Context window":"Контекстное окно","Speed":"Скорость","Pricing":"Стоимость","Bring your own provider key to use this model.":"Для использования модели добавьте собственный ключ провайдера.",
    "INTEGRATIONS":"ИНТЕГРАЦИИ","Provider connections":"Подключения провайдеров","Connect your own accounts. Credentials are not shared with other workspaces.":"Подключите собственные аккаунты. Учётные данные не передаются другим рабочим пространствам.",
    "Bring Your Own Key (BYOK)":"Использование собственного ключа (BYOK)","For the zero-budget MVP, ModelHub routes requests using your own provider credentials. No prepaid balance or platform-funded API usage is required.":"В MVP без бюджета ModelHub отправляет запросы с использованием ваших учётных данных провайдера. Предоплата и оплата API со стороны платформы не требуются.",
    "Not connected":"Не подключено","Configure":"Настроить","Provider setup":"Настройка провайдера","Connection form is a UI placeholder in this first scaffold.":"Форма подключения пока является макетом интерфейса.",
    "Provider API key":"API-ключ провайдера","Secure storage is not enabled yet":"Защищённое хранилище пока не подключено","Do not paste a real API key here.":"Не вставляйте сюда настоящий API-ключ.",
    "ACCESS CONTROL":"УПРАВЛЕНИЕ ДОСТУПОМ","Manage credentials used by your applications to access ModelHub.":"Управляйте учётными данными, с помощью которых приложения обращаются к ModelHub.",
    "Create key":"Создать ключ","No API keys yet":"Пока нет API-ключей","Key creation is disabled until hashed storage, one-time secret display and revocation are implemented.":"Создание ключей будет доступно после реализации хешированного хранения, однократного показа секрета и отзыва ключей.",
    "Coming in backend milestone":"Появится в следующем этапе разработки backend",
    "OBSERVABILITY":"МОНИТОРИНГ","Monitor requests, latency, token counts and provider errors.":"Отслеживайте запросы, задержки, количество токенов и ошибки провайдеров.",
    "Chat":"Чат","Audio":"Аудио","Image":"Изображения","Fast":"Быстро","Medium":"Средне","Varies":"Зависит от модели",
    "Planned":"Запланировано","Enabled":"Включено","Enable":"Включить","Disable":"Отключить","Replace":"Заменить","Done":"Готово","Cancel":"Отмена",
    "Email":"Электронная почта","Password":"Пароль","Confirm password":"Подтвердите пароль","New password":"Новый пароль",
    "Forgot password?":"Забыли пароль?","Forgot your password?":"Забыли пароль?","Reset password":"Сбросить пароль","Resetting...":"Сброс...",
    "Send reset link":"Отправить ссылку для сброса","Sending...":"Отправка...","Back to sign in":"Вернуться ко входу",
    "Continue":"Продолжить","Continue with Google":"Продолжить с Google","Continue with":"Продолжить через","or":"или",
    "Create account":"Создать аккаунт","Already have an account?":"Уже есть аккаунт?","Don't have an account?":"Нет аккаунта?",
    "Full name":"Полное имя","Name":"Имя","Register":"Зарегистрироваться","Sign in to continue":"Войдите, чтобы продолжить",
    "Invalid reset link":"Недействительная ссылка для сброса","This password reset link is missing or invalid":"Ссылка для сброса пароля отсутствует или недействительна",
    "Request a new link":"Запросить новую ссылку","The link you used appears to be incomplete. Please request a new password reset email.":"Похоже, ссылка неполная. Запросите новое письмо для сброса пароля.",
    "Enter your new password below":"Введите новый пароль ниже","Passwords do not match":"Пароли не совпадают","Failed to reset password":"Не удалось сбросить пароль",
    "Verify your identity":"Подтвердите личность","Verify":"Подтвердить","Verifying...":"Проверка...","Back to Login":"Вернуться ко входу",
    "Two-factor authentication":"Двухфакторная аутентификация","Remember this device for 30 days":"Запомнить это устройство на 30 дней",
    "Authenticator app":"Приложение-аутентификатор","Text messages":"SMS-сообщения","Enable":"Включить","Replace":"Заменить",
    "Send Code":"Отправить код","Verify & Disable":"Подтвердить и отключить","Enter a code from your authenticator app":"Введите код из приложения-аутентификатора",
    "Cancel":"Отмена","Authorize access":"Разрешить доступ","Loading…":"Загрузка…","Access granted":"Доступ разрешён","Access denied":"Доступ запрещён",
    "Reconnect required":"Требуется повторное подключение","Deny":"Отклонить","Approve":"Разрешить","Show less":"Свернуть",
    "Search...":"Поиск...","No match":"Совпадений нет","Copy key":"Копировать ключ","Copy to clipboard":"Копировать в буфер обмена",
    "Verification failed. Please try again.":"Не удалось подтвердить. Попробуйте ещё раз.","Your sign-in expired.":"Срок действия сеанса истёк.",
    "Sign in again":"Войти снова","Standard message and data rates may apply.":"Могут применяться стандартные тарифы на сообщения и передачу данных.",
    "Enter the code from your authenticator app":"Введите код из приложения-аутентификатора","Enter the code sent to":"Введите код, отправленный на",
    "Sending code to":"Отправка кода на","Set up your authenticator app":"Настроить приложение-аутентификатор","Enter your phone number":"Введите номер телефона",
    "Add an extra layer of protection when signing in. You'll be asked for a code each time you sign in.":"Добавьте дополнительный уровень защиты. При каждом входе потребуется код.",
    "Country code":"Код страны","Remember this device for 30 days":"Запомнить это устройство на 30 дней",
    "Provider connections":"Подключения провайдеров","API reference":"Справочник API","Preferences":"Настройки",
    "Language":"Язык","English":"Английский","Russian":"Русский","Chinese (Simplified)":"Китайский (упрощённый)",
    "One API. Every model.":"Один API. Любая модель.",
    "Three steps to your first API call.":"Три шага до первого вызова API.",
    "Across 6 model families":"В 6 семействах моделей","Input + output":"Входящие + исходящие","All time":"За всё время",
    "No traffic yet":"Трафика пока нет","No activity recorded":"Активность пока не зарегистрирована",
    "Once the gateway backend is connected, every request will be recorded here with redacted metadata.":"После подключения backend шлюза здесь будут отображаться все запросы с обезличенными метаданными.",
    "One endpoint and a familiar request format to get started.":"Одна конечная точка и привычный формат запросов для начала работы.",
    "Chat completions":"Завершение чата","Compatible request shape for chat models. The public endpoint is a planned interface; live routing is not enabled in this scaffold.":"Совместимый формат запросов для чат-моделей. Публичная конечная точка пока является планируемым интерфейсом; маршрутизация ещё не включена.",
    "Demo only: do not send production traffic or real credentials to this placeholder endpoint.":"Только демонстрация: не отправляйте рабочий трафик или реальные учётные данные на эту тестовую конечную точку.",
    "Workspace settings and regional defaults will be available here.":"Настройки рабочего пространства и региональные параметры появятся здесь.",
    "All systems operational":"Все системы работают","Built for developers":"Создано для разработчиков",
    "Provider connections":"Подключения провайдеров","Connect your own accounts. Credentials are not shared with other workspaces.":"Подключите собственные аккаунты. Учётные данные не передаются другим рабочим пространствам.",
    "GPT models, embeddings, audio":"Модели GPT, эмбеддинги, аудио","Claude models":"Модели Claude","Gemini models":"Модели Gemini",
    "DeepSeek chat models":"Чат-модели DeepSeek","Any compatible endpoint":"Любая совместимая конечная точка",
    "Not connected":"Не подключено","Open weights":"Открытые веса","Multilingual":"Многоязычность","Reasoning":"Рассуждение","Tools":"Инструменты",
    "Coding":"Программирование","Multimodal":"Мультимодальность","Transcription":"Транскрибация","Image generation":"Генерация изображений",
    "Provider pricing":"Цены провайдера","Provider API key":"API-ключ провайдера","Secure storage is not enabled yet":"Защищённое хранилище пока не подключено",
    "Personal workspace":"Личное рабочее пространство","Personal account":"Личный аккаунт","Free plan":"Бесплатный тариф",
    "Workspace":"Рабочее пространство","Global":"Глобально","Connect":"Подключить","Configure":"Настроить",
    "Search models or providers...":"Поиск моделей или провайдеров...","No models match your search.":"По вашему запросу модели не найдены.",
    "No API keys yet":"Пока нет API-ключей","No activity recorded":"Активность пока не зарегистрирована",
    "Requests":"Запросы","Tokens":"Токены","Error rate":"Частота ошибок","Requests this month":"Запросов за месяц",
    "Models available":"Доступно моделей","Avg. latency":"Средняя задержка","Your API spend":"Расходы на API",
    "ModelHub is designed around BYOK. This demo does not collect or transmit secrets.":"ModelHub построен на принципе BYOK. Эта демонстрационная версия не собирает и не передаёт секреты.",
    "OpenAI-compatible":"Совместимо с OpenAI","Provider":"Провайдер","Chat model":"Чат-модель","Quickstart":"Быстрый старт",
    "Copy cURL":"Копировать cURL","Sort":"Сортировать","All models":"Все модели","Input":"Вход","Output":"Выход",
    "Preferences":"Настройки","API reference":"Справочник API","Usage & logs":"Использование и журналы",
    "The public endpoint is a planned interface":"Публичная конечная точка пока запланирована",
    "Create key":"Создать ключ","Create API key":"Создать API-ключ","Available after secure key storage is implemented":"Будет доступно после реализации защищённого хранения ключей",
    "Connection form is a UI placeholder in this first scaffold.":"Форма подключения пока является макетом интерфейса.",
    "Do not paste a real API key here.":"Не вставляйте сюда настоящий API-ключ.",
    "Connect provider":"Подключить провайдера","View all":"Показать все","Popular models":"Популярные модели",
    "Quick API example":"Пример API-запроса","OpenAI-compatible interface":"Интерфейс, совместимый с OpenAI",
    "Your keys, your control.":"Ваши ключи — под вашим контролем.","DISCOVER":"ОБЗОР","INTEGRATIONS":"ИНТЕГРАЦИИ",
    "ACCESS CONTROL":"УПРАВЛЕНИЕ ДОСТУПОМ","OBSERVABILITY":"МОНИТОРИНГ","DEVELOPERS":"РАЗРАБОТЧИКАМ",
    "AI INFRASTRUCTURE, SIMPLIFIED":"ИНФРАСТРУКТУРА ИИ — ПРОСТО","WORKSPACE":"РАБОЧЕЕ ПРОСТРАНСТВО","SETTINGS":"НАСТРОЙКИ",
    "Overview":"Обзор","Model catalog":"Каталог моделей","API keys":"API-ключи","Providers":"Провайдеры",
    "Quickstart":"Быстрый старт","API reference":"Справочник API","Preferences":"Настройки",
    "Model catalog":"Каталог моделей","Provider connections":"Подключения провайдеров","Usage & logs":"Использование и журналы"
  },
  zh: {
    "Sign in":"登录","Get started":"开始使用","UNIFIED AI INFRASTRUCTURE":"统一 AI 基础设施",
    "One API.":"一个 API。","Every model.":"连接所有模型。","One API. Every model.":"一个 API，连接所有模型。",
    "Connect AI providers through one consistent interface. Route requests, manage credentials, and understand usage from a single workspace.":"通过统一接口连接 AI 服务提供商。在一个工作空间中路由请求、管理凭据并查看使用情况。",
    "Create your workspace":"创建工作空间","BYOK-first architecture · No platform-funded API usage in the initial release":"优先采用 BYOK 架构 · 初始版本不由平台承担 API 使用费用",
    "Gateway architecture":"网关架构","Preview":"预览","Provider credentials remain server-side":"服务商凭据仅保留在服务器端",
    "One model interface":"统一模型接口","A consistent API surface across supported model providers.":"为受支持的模型服务商提供统一的 API 接口。",
    "Credentials under control":"凭据安全可控","BYOK-first design with server-side secret handling and scoped access.":"优先采用 BYOK 设计，服务端管理密钥并实施权限控制。",
    "Built for developers":"专为开发者打造","OpenAI-compatible requests, usage records, and practical documentation.":"兼容 OpenAI 的请求格式、用量记录和实用文档。",
    "Availability depends on provider terms and regional access":"可用性取决于服务商条款和地区访问情况",
    "WORKSPACE":"工作空间","DEVELOPERS":"开发者","SETTINGS":"设置",
    "Overview":"概览","Model catalog":"模型目录","API keys":"API 密钥","Usage & logs":"用量与日志",
    "Quickstart":"快速开始","API reference":"API 参考","Providers":"服务提供商","Preferences":"偏好设置",
    "Personal workspace":"个人工作空间","Loading workspace…":"正在加载工作空间…","Workspace unavailable":"工作空间不可用",
    "Free plan":"免费计划","Personal account":"个人账户","Global":"全球","Help":"帮助",
    "AI INFRASTRUCTURE, SIMPLIFIED":"让 AI 基础设施更简单","Connect provider":"连接服务商",
    "Connect your providers once. Build with the models you need.":"只需连接一次服务商，即可使用所需模型。",
    "Requests this month":"本月请求数","Models available":"可用模型","Avg. latency":"平均延迟","Your API spend":"API 支出",
    "Ready when you are":"随时可用","Across 6 model families":"涵盖 6 个模型系列","No requests yet":"尚无请求","BYOK · no platform markup":"BYOK · 平台不加价",
    "Get started":"开始使用","Three steps to your first API call.":"只需三个步骤即可发起首次 API 调用。","0 of 3 complete":"已完成 0/3",
    "Connect a provider":"连接服务商","Add your own API key. It stays private and is never shown in the browser again.":"添加您自己的 API 密钥。密钥将保持私密，不会再次显示在浏览器中。",
    "Add provider":"添加服务商","Create a ModelHub key":"创建 ModelHub 密钥","Generate a single key for your apps and services to authenticate requests.":"为您的应用和服务生成一个统一密钥，用于请求身份验证。",
    "Create API key":"创建 API 密钥","Make your first request":"发起首次请求","Use our OpenAI-compatible endpoint with any supported model.":"使用兼容 OpenAI 的接口调用任何受支持的模型。",
    "View quickstart":"查看快速开始","Popular models":"热门模型","Start exploring the catalog":"开始浏览模型目录","View all":"查看全部",
    "Quick API example":"API 快速示例","OpenAI-compatible interface":"兼容 OpenAI 的接口","Copied":"已复制","Copy example":"复制示例",
    "Your keys, your control.":"密钥由您掌控。","ModelHub is designed around BYOK. This demo does not collect or transmit secrets.":"ModelHub 采用 BYOK 模式。本演示不会收集或传输任何密钥。",
    "DISCOVER":"探索","Explore model families and choose the right engine for your workload.":"探索不同模型系列，为您的工作负载选择合适的模型。",
    "Search models or providers...":"搜索模型或服务商...","All models":"所有模型","Sort":"排序",
    "MODEL":"模型","CONTEXT":"上下文","ACCESS":"访问权限","No models match your search.":"没有找到匹配的模型。",
    "Context window":"上下文窗口","Speed":"速度","Pricing":"价格","Bring your own provider key to use this model.":"请提供您自己的服务商密钥以使用此模型。",
    "INTEGRATIONS":"集成","Provider connections":"服务商连接","Connect your own accounts. Credentials are not shared with other workspaces.":"连接您自己的账户。凭据不会与其他工作空间共享。",
    "Bring Your Own Key (BYOK)":"自带密钥（BYOK）","For the zero-budget MVP, ModelHub routes requests using your own provider credentials. No prepaid balance or platform-funded API usage is required.":"在零预算 MVP 阶段，ModelHub 使用您自己的服务商凭据转发请求。无需预充值，也无需平台承担 API 费用。",
    "Not connected":"未连接","Configure":"配置","Provider setup":"服务商设置","Connection form is a UI placeholder in this first scaffold.":"此初始版本中的连接表单仅为界面占位。",
    "Provider API key":"服务商 API 密钥","Secure storage is not enabled yet":"尚未启用安全存储","Do not paste a real API key here.":"请勿在此处粘贴真实 API 密钥。",
    "ACCESS CONTROL":"访问控制","Manage credentials used by your applications to access ModelHub.":"管理应用访问 ModelHub 时使用的凭据。",
    "Create key":"创建密钥","No API keys yet":"暂无 API 密钥","Key creation is disabled until hashed storage, one-time secret display and revocation are implemented.":"在实现哈希存储、密钥仅显示一次及撤销功能之前，密钥创建功能暂不可用。",
    "Coming in backend milestone":"将在后端开发阶段推出","OBSERVABILITY":"可观测性","Monitor requests, latency, token counts and provider errors.":"监控请求、延迟、令牌数量和服务商错误。",
    "Chat":"聊天","Audio":"音频","Image":"图像","Fast":"快","Medium":"中等","Varies":"因模型而异",
    "Planned":"计划中","Enabled":"已启用","Enable":"启用","Disable":"禁用","Replace":"替换","Done":"完成","Cancel":"取消",
    "Email":"电子邮箱","Password":"密码","Confirm password":"确认密码","New password":"新密码","Forgot password?":"忘记密码？",
    "Forgot your password?":"忘记密码？","Reset password":"重置密码","Resetting...":"正在重置...","Send reset link":"发送重置链接",
    "Sending...":"正在发送...","Back to sign in":"返回登录","Continue":"继续","Continue with Google":"使用 Google 继续",
    "Continue with":"使用以下方式继续","or":"或","Create account":"创建账户","Already have an account?":"已有账户？","Don't have an account?":"还没有账户？",
    "Full name":"姓名","Name":"姓名","Register":"注册","Sign in to continue":"登录以继续",
    "Invalid reset link":"重置链接无效","This password reset link is missing or invalid":"此密码重置链接缺失或无效",
    "Request a new link":"申请新链接","The link you used appears to be incomplete. Please request a new password reset email.":"您使用的链接似乎不完整。请重新申请密码重置邮件。",
    "Enter your new password below":"请在下方输入新密码","Passwords do not match":"两次输入的密码不一致","Failed to reset password":"密码重置失败",
    "Verify your identity":"验证您的身份","Verify":"验证","Verifying...":"正在验证...","Back to Login":"返回登录",
    "Two-factor authentication":"双重身份验证","Remember this device for 30 days":"记住此设备 30 天",
    "Authenticator app":"身份验证器应用","Text messages":"短信","Send Code":"发送验证码","Verify & Disable":"验证并禁用",
    "Enter a code from your authenticator app":"请输入身份验证器应用中的验证码","Cancel":"取消","Authorize access":"授权访问",
    "Loading…":"正在加载…","Access granted":"已授予访问权限","Access denied":"已拒绝访问","Reconnect required":"需要重新连接",
    "Deny":"拒绝","Approve":"批准","Show less":"收起","Search...":"搜索...","No match":"没有匹配项",
    "Copy key":"复制密钥","Copy to clipboard":"复制到剪贴板","Verification failed. Please try again.":"验证失败，请重试。",
    "Your sign-in expired.":"登录状态已过期。","Sign in again":"重新登录","Standard message and data rates may apply.":"可能会产生标准短信和数据费用。",
    "Enter the code from your authenticator app":"请输入身份验证器应用中的验证码","Enter the code sent to":"请输入发送至以下号码的验证码",
    "Sending code to":"正在向以下号码发送验证码","Set up your authenticator app":"设置身份验证器应用","Enter your phone number":"输入您的电话号码",
    "Add an extra layer of protection when signing in. You'll be asked for a code each time you sign in.":"增加一层登录保护。每次登录时，您都需要输入验证码。",
    "Country code":"国家/地区代码","Language":"语言","English":"英语","Russian":"俄语","Chinese (Simplified)":"简体中文",
    "One API. Every model.":"一个 API，连接所有模型。",
    "Three steps to your first API call.":"只需三个步骤即可发起首次 API 调用。",
    "Across 6 model families":"涵盖 6 个模型系列","Input + output":"输入 + 输出","All time":"全部时间",
    "No traffic yet":"暂无流量","No activity recorded":"暂无活动记录",
    "Once the gateway backend is connected, every request will be recorded here with redacted metadata.":"连接网关后，所有请求都将在此记录，并对元数据进行脱敏处理。",
    "One endpoint and a familiar request format to get started.":"使用一个接口和熟悉的请求格式即可开始。",
    "Chat completions":"聊天补全","Compatible request shape for chat models. The public endpoint is a planned interface; live routing is not enabled in this scaffold.":"适用于聊天模型的兼容请求格式。公共接口仍在规划中，当前版本尚未启用实时路由。",
    "Demo only: do not send production traffic or real credentials to this placeholder endpoint.":"仅供演示：请勿向此占位接口发送生产流量或真实凭据。",
    "Workspace settings and regional defaults will be available here.":"工作空间设置和区域默认选项将在此提供。",
    "All systems operational":"所有系统运行正常","Built for developers":"专为开发者打造",
    "GPT models, embeddings, audio":"GPT 模型、嵌入和音频","Claude models":"Claude 模型","Gemini models":"Gemini 模型",
    "DeepSeek chat models":"DeepSeek 聊天模型","Any compatible endpoint":"任何兼容接口",
    "Not connected":"未连接","Open weights":"开放权重","Multilingual":"多语言","Reasoning":"推理","Tools":"工具",
    "Coding":"编程","Multimodal":"多模态","Transcription":"语音转录","Image generation":"图像生成",
    "Provider pricing":"服务商定价","Provider API key":"服务商 API 密钥","Secure storage is not enabled yet":"尚未启用安全存储",
    "Personal workspace":"个人工作空间","Personal account":"个人账户","Free plan":"免费计划",
    "Workspace":"工作空间","Global":"全球","Connect":"连接","Configure":"配置",
    "Search models or providers...":"搜索模型或服务商...","No models match your search.":"没有找到匹配的模型。",
    "No API keys yet":"暂无 API 密钥","No activity recorded":"暂无活动记录",
    "Requests":"请求数","Tokens":"令牌","Error rate":"错误率","Requests this month":"本月请求数",
    "Models available":"可用模型","Avg. latency":"平均延迟","Your API spend":"API 支出",
    "ModelHub is designed around BYOK. This demo does not collect or transmit secrets.":"ModelHub 采用 BYOK 模式。本演示不会收集或传输任何密钥。",
    "OpenAI-compatible":"兼容 OpenAI","Provider":"服务商","Chat model":"聊天模型","Quickstart":"快速开始",
    "Copy cURL":"复制 cURL","Sort":"排序","All models":"所有模型","Input":"输入","Output":"输出",
    "Preferences":"偏好设置","API reference":"API 参考","Usage & logs":"用量与日志",
    "Create key":"创建密钥","Create API key":"创建 API 密钥","Available after secure key storage is implemented":"安全密钥存储功能实现后开放",
    "Connection form is a UI placeholder in this first scaffold.":"此初始版本中的连接表单仅为界面占位。",
    "Do not paste a real API key here.":"请勿在此处粘贴真实 API 密钥。",
    "Connect provider":"连接服务商","View all":"查看全部","Popular models":"热门模型",
    "Quick API example":"API 快速示例","OpenAI-compatible interface":"兼容 OpenAI 的接口",
    "Your keys, your control.":"密钥由您掌控。","DISCOVER":"探索","INTEGRATIONS":"集成",
    "ACCESS CONTROL":"访问控制","OBSERVABILITY":"可观测性","DEVELOPERS":"开发者",
    "AI INFRASTRUCTURE, SIMPLIFIED":"让 AI 基础设施更简单","WORKSPACE":"工作空间","SETTINGS":"设置",
    "Overview":"概览","Model catalog":"模型目录","API keys":"API 密钥","Providers":"服务提供商",
    "Quickstart":"快速开始","API reference":"API 参考","Preferences":"偏好设置",
    "Provider connections":"服务商连接","Usage & logs":"用量与日志"
  }
};

const supported = ["en", "ru", "zh"];
const translateText = (value, language) => {
  if (language === "en" || !value) return value;
  const dictionary = dictionaries[language];
  const trimmed = value.trim();
  if (dictionary[trimmed]) return value.replace(trimmed, dictionary[trimmed]);
  let result = value;
  for (const [source, target] of Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length)) {
    if (result.includes(source)) result = result.replaceAll(source, target);
  }
  return result;
};

const originalText = new WeakMap();
const originalAttributes = new WeakMap();

function applyTranslations(language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    if (!node.parentElement?.closest("[data-no-translate]")) {
      const next = translateText(originalText.get(node), language);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  });
  document.querySelectorAll("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      const key = attribute;
      let originals = originalAttributes.get(element);
      if (!originals) { originals = {}; originalAttributes.set(element, originals); }
      if (originals[key] === undefined) originals[key] = element.getAttribute(attribute);
      const value = originals[key];
      if (value) {
        const next = translateText(value, language);
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
      }
    });
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  useEffect(() => {
    const saved = window.localStorage.getItem("aevotron-language");
    const initial = supported.includes(saved) ? saved : "en";
    setLanguageState(initial);
    applyTranslations(initial);
  }, []);
  useEffect(() => {
    applyTranslations(language);
    const observer = new MutationObserver(() => applyTranslations(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);
  const setLanguage = (next) => {
    if (!supported.includes(next)) return;
    window.localStorage.setItem("aevotron-language", next);
    setLanguageState(next);
  };
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (value) => translateText(value, language),
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      <label className="sr-only" htmlFor="aevotron-language">Language</label>
      <select
        id="aevotron-language"
        aria-label="Language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur focus:outline-none focus:ring-2 focus:ring-cyan-300"
      >
        <option value="en">English</option>
        <option value="ru">Русский</option>
        <option value="zh">简体中文</option>
      </select>
    </div>
  );
}
