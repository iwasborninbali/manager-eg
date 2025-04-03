# EG App Structure Documentation

## Application Flow Diagram

```mermaid
flowchart LR
    A["Переход на /"] --> B{Авторизован?}
    B -- "Нет" --> C["Страница входа / регистрации"]
    C --> B
    B -- "Да" --> D["Определение роли пользователя\n(profiles table)"]

    subgraph "Роли и их доступ"
        subgraph "CEO Role"
            CEO["CEO:\n• Проекты (создание, просмотр, редактирование)\n• Счета (загрузка, просмотр)\n• Бюджеты (редактирование)\n• Зарплаты (управление)"]
            CEO --> PM["Управление проектами:\n• Создание (CreateProjectDialog)\n• Просмотр (ProjectViewDialog)\n• Редактирование (EditProjectDialog)\n• Назначение менеджеров"]
            CEO --> IM["Управление счетами:\n• Загрузка (InvoiceUploadDialog)\n• Просмотр статусов\n• Контроль бюджета"]
        end

        D --> CEO
        D --> CFO["CFO:\n• Счета (InvoicesSection)\n• Бюджеты (BudgetsSection)"]
        D --> Manager["Менеджер:\n• Проекты (только просмотр)"]
        D --> Supply["Supply Manager:\n• Счета (загрузка, просмотр)"]
        D --> OtherUser["Обычный пользователь:\n• Базовый дашборд"]
    end

    subgraph "Дашборд (layout.tsx)"
        HEADER["Header:\n• Логотип\n• UserProfile (Logout)"]
        NAV["BottomNav\n(кроме CFO)"]
        
        SECTIONS["Секции (зависят от роли):\n• Projects\n• Invoices\n• Budgets\n• Salaries"]
        
        HEADER --> SECTIONS
        NAV --> SECTIONS
    end

    CEO --> HEADER
    CFO --> HEADER
    Manager --> HEADER
    Supply --> HEADER
    OtherUser --> HEADER

    subgraph "Дополнительные проверки"
        CP["Проверка профиля:\n• Имя\n• Фамилия"]
        CP -- "Не заполнено" --> EP["complete-profile"]
        CP -- "Заполнено" --> HEADER
    end

    style A fill:#DDF
    style B fill:#FCE
    style C fill:#FCE
    style D fill:#EFC
    style CEO fill:#CFC,stroke:#333,stroke-width:2px
    style CFO fill:#CFC
    style Manager fill:#CFC
    style Supply fill:#CFC
    style OtherUser fill:#CFC
    style HEADER fill:#EFE
    style NAV fill:#EFE
    style SECTIONS fill:#EFE
    style PM fill:#DFE
    style IM fill:#DFE
    style CP fill:#FCE
    style EP fill:#FCE
```

## Описание структуры

### Основные потоки:

1. **Вход в систему**:
   - При переходе на главную страницу проверяется авторизация
   - Неавторизованные пользователи направляются на страницу входа/регистрации
   - После успешной авторизации определяется роль пользователя через таблицу profiles

2. **Роль CEO (основные возможности)**:
   - **Проекты**:
     * Создание новых проектов (CreateProjectDialog)
     * Просмотр и редактирование (ProjectViewDialog, EditProjectDialog)
     * Назначение/смена менеджеров проектов
     * Изменение статусов проектов
   - **Счета**:
     * Загрузка новых счетов (InvoiceUploadDialog)
     * Просмотр статусов и сумм
     * Контроль бюджета проекта
   - **Бюджеты**: управление через BudgetsSection
   - **Зарплаты**: управление через SalariesSection

3. **Интерфейс дашборда**:
   - Header с логотипом и UserProfile
   - BottomNav для всех ролей кроме CFO
   - Секции отображаются в зависимости от роли
   - По умолчанию для CEO показывается Projects

4. **Другие роли**:
   - CFO: доступ к счетам и бюджетам (без BottomNav)
   - Менеджер: только просмотр проектов
   - Supply Manager: работа со счетами
   - Обычный пользователь: базовый доступ

5. **Дополнительные проверки**:
   - Проверка заполненности профиля
   - Перенаправление на complete-profile при необходимости

### База данных и хранилище:
- Таблица profiles: хранение ролей и данных пользователей
- Таблица projects: проекты и их параметры
- Таблица invoices: счета и их статусы
- Storage: хранение файлов счетов 