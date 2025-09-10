const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Получение всех подрядчиков
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query; // opening или renewal
    
    let query = 'SELECT * FROM card_contractors WHERE is_active = TRUE';
    let params = [];
    
    if (type) {
      query += ' AND type = $1';
      params.push(type);
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await db.query(query, params);
    
    res.json({
      contractors: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка получения подрядчиков:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание нового подрядчика
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Название и тип обязательны' });
    }

    if (!['opening', 'renewal'].includes(type)) {
      return res.status(400).json({ error: 'Тип должен быть opening или renewal' });
    }

    const result = await db.query(
      'INSERT INTO card_contractors (name, type) VALUES ($1, $2) RETURNING *',
      [name, type]
    );

    res.status(201).json({
      message: 'Подрядчик создан успешно',
      contractor: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания подрядчика:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// Удаление подрядчика
router.delete('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const contractorId = req.params.id;

    // Проверяем существование подрядчика
    const checkResult = await db.query('SELECT id FROM card_contractors WHERE id = $1', [contractorId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Подрядчик не найден' });
    }

    // Мягкое удаление
    await db.query('UPDATE card_contractors SET is_active = FALSE WHERE id = $1', [contractorId]);

    res.json({ message: 'Подрядчик успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления подрядчика:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
