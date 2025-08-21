-- Добавляем связь карты с баером
ALTER TABLE cards ADD COLUMN buyer_id INTEGER REFERENCES users(id);

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_cards_buyer_id ON cards(buyer_id);