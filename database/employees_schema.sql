-- Таблица сотрудников для расходов
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    salary_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    salary_currency VARCHAR(3) DEFAULT 'UAH',
    team_id INTEGER REFERENCES teams(id),
    is_active BOOLEAN DEFAULT TRUE,
    hire_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_employees_team_id ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);

-- Добавляем поле employee_id в таблицу расходов для связи с конкретным сотрудником
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON expenses(employee_id);