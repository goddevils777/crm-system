-- Добавляем поле telegram в таблицу users
ALTER TABLE users ADD COLUMN telegram VARCHAR(100);

-- Создаем индекс для быстрого поиска по telegram
CREATE INDEX idx_users_telegram ON users(telegram);

-- Обновляем существующих пользователей (опционально)
UPDATE users SET telegram = '@' || username WHERE telegram IS NULL;