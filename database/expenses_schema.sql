-- Таблица расходов
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'cards_opening', 'cards_renewal', 'employees', 'second_banks', 
        'sim_cards', 'accounts', 'proxy', 'antidetect', 'other', 
        'card_topups', 'office', 'utilities'
    )),
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',
    description TEXT,
    team_id INTEGER REFERENCES teams(id),
    user_id INTEGER REFERENCES users(id),
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_team ON expenses(team_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);