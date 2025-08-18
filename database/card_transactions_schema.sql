-- Таблица истории операций с картами
CREATE TABLE card_transactions (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('balance_update', 'topup', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',
    balance_before DECIMAL(15,2),
    balance_after DECIMAL(15,2),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_card_transactions_card_id ON card_transactions(card_id);
CREATE INDEX idx_card_transactions_date ON card_transactions(transaction_date);
CREATE INDEX idx_card_transactions_type ON card_transactions(transaction_type);