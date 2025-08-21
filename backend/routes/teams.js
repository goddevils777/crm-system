const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

// Получение всех команд
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        t.*,
        COUNT(DISTINCT u.id) as buyers_count,
        COUNT(DISTINCT c.id) as cards_count
      FROM teams t
      LEFT JOIN users u ON t.id = u.team_id AND u.role = 'buyer'
      LEFT JOIN cards c ON t.id = c.team_id AND c.status != 'deleted'
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    const result = await db.query(query);
    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Ошибка получения команд:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание команды (только админ и менеджер)
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name } = req.body;

    // Простая валидация
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Название команды обязательно' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Название команды слишком длинное (максимум 100 символов)' });
    }

    const trimmedName = name.trim();

    // Проверяем уникальность названия
    const existingTeam = await db.query('SELECT id FROM teams WHERE name = $1', [trimmedName]);
    if (existingTeam.rows.length > 0) {
      return res.status(400).json({ error: 'Команда с таким названием уже существует' });
    }

    const result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [trimmedName]
    );

    res.status(201).json({ team: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение одной команды
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    
    const query = `
      SELECT 
        t.*,
        COUNT(DISTINCT u.id) as buyers_count,
        COUNT(DISTINCT c.id) as cards_count,
        COALESCE(SUM(CASE WHEN c.status != 'deleted' THEN c.balance ELSE 0 END), 0) as total_balance
      FROM teams t
      LEFT JOIN users u ON t.id = u.team_id AND u.role = 'buyer'
      LEFT JOIN cards c ON t.id = c.team_id AND c.status != 'deleted'
      WHERE t.id = $1
      GROUP BY t.id
    `;

    const result = await db.query(query, [teamId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Редактирование команды (только админ и менеджер)
router.put('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name } = req.body;

    // Простая валидация
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Название команды обязательно' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Название команды слишком длинное (максимум 100 символов)' });
    }

    const trimmedName = name.trim();

    // Проверяем существование команды
    const checkResult = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    // Проверяем уникальность названия (исключая текущую команду)
    const existingTeam = await db.query('SELECT id FROM teams WHERE name = $1 AND id != $2', [trimmedName, teamId]);
    if (existingTeam.rows.length > 0) {
      return res.status(400).json({ error: 'Команда с таким названием уже существует' });
    }

    // Обновляем команду
    const result = await db.query(
      'UPDATE teams SET name = $1 WHERE id = $2 RETURNING *',
      [trimmedName, teamId]
    );

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Ошибка редактирования команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление команды (только админ)
router.delete('/:id', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const teamId = req.params.id;

    // Проверяем существование команды
    const checkResult = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    const team = checkResult.rows[0];

    // Проверяем есть ли связанные карты
    const cardsResult = await db.query('SELECT COUNT(*) as count FROM cards WHERE team_id = $1 AND status != $2', [teamId, 'deleted']);
    const cardsCount = parseInt(cardsResult.rows[0].count);

    if (cardsCount > 0) {
      return res.status(400).json({ error: `Нельзя удалить команду "${team.name}". У неё есть ${cardsCount} активных карт.` });
    }

    // Проверяем есть ли связанные пользователи
    const usersResult = await db.query('SELECT COUNT(*) as count FROM users WHERE team_id = $1', [teamId]);
    const usersCount = parseInt(usersResult.rows[0].count);

    if (usersCount > 0) {
      return res.status(400).json({ error: `Нельзя удалить команду "${team.name}". В ней есть ${usersCount} пользователей.` });
    }

    // Удаляем команду
    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);

    res.json({ message: `Команда "${team.name}" успешно удалена` });
  } catch (error) {
    console.error('Ошибка удаления команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;