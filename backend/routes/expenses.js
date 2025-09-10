const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Получение всех расходов
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM expenses WHERE team_id = $1 OR $2 = $3 ORDER BY created_at DESC',
      [req.user.team_id, req.user.role, 'admin']
    );
    
    res.json({
      expenses: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка получения расходов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание нового расхода
// Создание нового расхода
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { category, name, amount, currency = 'USD', description, expense_date, employee_id, contractor_id } = req.body;

    if (!category || !name || !amount) {
      return res.status(400).json({ error: 'Категория, название и сумма обязательны' });
    }

    // Конвертируем в USD через API курсов
    const currencyService = require('../utils/currency');
    const { amountUSD, exchangeRate } = await currencyService.convertToUSD(parseFloat(amount), currency);

    const result = await db.query(
      `INSERT INTO expenses (category, name, amount, currency, amount_usd, exchange_rate, description, team_id, user_id, expense_date, employee_id, contractor_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [category, name, parseFloat(amount), currency, amountUSD, exchangeRate, description, req.user.team_id, req.user.id, expense_date || new Date(), employee_id || null, contractor_id || null]
    );

    res.status(201).json({
      message: 'Расход создан успешно',
      expense: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания расхода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление расхода
router.delete('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const expenseId = req.params.id;

    // Проверяем существование расхода
    const checkResult = await db.query('SELECT id, team_id FROM expenses WHERE id = $1', [expenseId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    const expense = checkResult.rows[0];

    // Проверяем права доступа (менеджер может удалять только расходы своей команды)
    if (req.user.role === 'manager' && expense.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этого расхода' });
    }

    // Удаляем расход
    await db.query('DELETE FROM expenses WHERE id = $1', [expenseId]);

    res.json({ message: 'Расход успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления расхода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;