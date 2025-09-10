const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Получение всех сотрудников
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM employees WHERE is_active = TRUE';
    let params = [];

    // Менеджеры видят только своих сотрудников
    if (req.user.role === 'manager') {
      query += ' AND team_id = $1';
      params.push(req.user.team_id);
    }

    query += ' ORDER BY name ASC';

    const result = await db.query(query, params);
    
    res.json({
      employees: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка получения сотрудников:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание нового сотрудника
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, position, salary_amount, salary_currency = 'UAH', hire_date } = req.body;

    if (!name || !salary_amount) {
      return res.status(400).json({ error: 'Имя и зарплата обязательны' });
    }

    const result = await db.query(
      `INSERT INTO employees (name, position, salary_amount, salary_currency, team_id, hire_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, position, parseFloat(salary_amount), salary_currency, req.user.team_id, hire_date || new Date()]
    );

    res.status(201).json({
      message: 'Сотрудник добавлен успешно',
      employee: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания сотрудника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление сотрудника
router.put('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { name, position, salary_amount, salary_currency, is_active } = req.body;

    // Проверяем существование сотрудника
    const checkResult = await db.query('SELECT id, team_id FROM employees WHERE id = $1', [employeeId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    const employee = checkResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && employee.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этого сотрудника' });
    }

    const result = await db.query(
      `UPDATE employees 
       SET name = COALESCE($1, name), 
           position = COALESCE($2, position),
           salary_amount = COALESCE($3, salary_amount),
           salary_currency = COALESCE($4, salary_currency),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [name, position, salary_amount, salary_currency, is_active, employeeId]
    );

    res.json({
      message: 'Сотрудник обновлен успешно',
      employee: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления сотрудника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление сотрудника (мягкое удаление)
router.delete('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Проверяем существование сотрудника
    const checkResult = await db.query('SELECT id, team_id FROM employees WHERE id = $1', [employeeId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    const employee = checkResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && employee.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этого сотрудника' });
    }

    // Мягкое удаление
    await db.query('UPDATE employees SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [employeeId]);

    res.json({ message: 'Сотрудник успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления сотрудника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;