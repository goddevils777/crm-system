-- Создаем таблицу баеров команды
CREATE TABLE team_buyers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    telegram VARCHAR(100),
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    invitation_token VARCHAR(255) UNIQUE,
    is_registered BOOLEAN DEFAULT FALSE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_team_buyers_team_id ON team_buyers(team_id);
CREATE INDEX idx_team_buyers_token ON team_buyers(invitation_token);
CREATE INDEX idx_team_buyers_user_id ON team_buyers(user_id);