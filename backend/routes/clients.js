const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');
const crypto = require('crypto');

// Получение всех клиентов
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(b.id) as bills_count,
        COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN b.status = 'pending' THEN b.amount ELSE 0 END), 0) as total_pending
      FROM clients c
      LEFT JOIN bills b ON c.id = b.client_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ clients: result.rows });
  } catch (error) {
    console.error('Ошибка получения клиентов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение одного клиента
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const clientId = req.params.id;
    
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    res.json({ client: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения клиента:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание клиента
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, email, phone, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Название клиента обязательно' });
    }

    const result = await db.query(
      `INSERT INTO clients (name, email, phone, description) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name.trim(), email || null, phone || null, description || null]
    );

    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания клиента:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение счетов клиента
router.get('/:id/bills', authenticateToken, async (req, res) => {
  try {
    const clientId = req.params.id;
    
    const result = await db.query(`
      SELECT 
        b.*,
        t.name as team_name,
        u.username as created_by_name
      FROM bills b
      LEFT JOIN teams t ON b.team_id = t.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.client_id = $1
      ORDER BY b.created_at DESC
    `, [clientId]);

    res.json({ bills: result.rows });
  } catch (error) {
    console.error('Ошибка получения счетов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание счета для клиента
router.post('/:id/bills', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const clientId = req.params.id;
    const { team_id, period_from, period_to, buyers_count, cards_count, amount } = req.body;

    if (!team_id || !period_from || !period_to || !amount) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }

    const result = await db.query(
      `INSERT INTO bills (client_id, team_id, period_from, period_to, buyers_count, cards_count, amount, status, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) 
       RETURNING *`,
      [clientId, team_id, period_from, period_to, buyers_count || 0, cards_count || 0, amount, req.user.id]
    );

    res.status(201).json({ bill: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания счета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление клиента
router.delete('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const clientId = req.params.id;
    
    // Проверяем существует ли клиент
    const checkResult = await db.query('SELECT id FROM clients WHERE id = $1', [clientId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // Удаляем клиента
    await db.query('DELETE FROM clients WHERE id = $1', [clientId]);
    
    res.json({ message: 'Клиент успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления клиента:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Изменение статуса счета
router.put('/:clientId/bills/:billId/status', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { clientId, billId } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус' });
    }
    
    const result = await db.query(
      'UPDATE bills SET status = $1 WHERE id = $2 AND client_id = $3 RETURNING *',
      [status, billId, clientId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Счет не найден' });
    }
    
    res.json({ bill: result.rows[0] });
  } catch (error) {
    console.error('Ошибка изменения статуса счета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление счета
router.delete('/:clientId/bills/:billId', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { clientId, billId } = req.params;
    
    // Проверяем что счет принадлежит указанному клиенту
    const checkResult = await db.query(
      'SELECT id FROM bills WHERE id = $1 AND client_id = $2', 
      [billId, clientId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Счет не найден' });
    }
    
    // Удаляем счет
    await db.query('DELETE FROM bills WHERE id = $1', [billId]);
    
    res.json({ message: 'Счет успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления счета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Генерация публичной ссылки для счета
router.get('/:clientId/bills/:billId/link', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { clientId, billId } = req.params;
    
    const token = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем токен в базе
    await db.query(
      'UPDATE bills SET public_token = $1 WHERE id = $2 AND client_id = $3',
      [token, billId, clientId]
    );
    
    const publicUrl = `${req.protocol}://${req.get('host')}/modules/clients/bill/index.html?token=${token}`;
    res.json({ url: publicUrl });
  } catch (error) {
    console.error('Ошибка генерации ссылки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Публичный доступ к счету
router.get('/bills/public/:token', async (req, res) => {
  try {
    console.log('Запрос публичного счета с токеном:', req.params.token);
    
    const token = req.params.token;
    
    const result = await db.query(`
      SELECT b.*, c.name as client_name 
      FROM bills b 
      JOIN clients c ON b.client_id = c.id 
      WHERE b.public_token = $1
    `, [token]);
    
    console.log('Результат поиска счета:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('Счет с токеном не найден:', token);
      return res.status(404).json({ error: 'Счет не найден' });
    }
    
    console.log('Счет найден:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения публичного счета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ВАЖНО: этот роут должен быть БЕЗ middleware аутентификации
router.put('/bills/public/:token/pay', async (req, res) => {
  console.log('=== PAYMENT ROUTE CALLED ===');
  console.log('Token:', req.params.token);
  console.log('Method:', req.method);
  console.log('Full URL:', req.originalUrl);
  
  try {
    const token = req.params.token;
    
    // Сначала проверим что счет существует
    const checkResult = await db.query(
      'SELECT id, status FROM bills WHERE public_token = $1',
      [token]
    );
    
    console.log('Bills found:', checkResult.rows.length);
    
    if (checkResult.rows.length === 0) {
      console.log('Bill not found for token:', token);
      return res.status(404).json({ error: 'Счет не найден' });
    }
    
    if (checkResult.rows[0].status === 'paid') {
      console.log('Bill already paid');
      return res.json({ message: 'Счет уже оплачен', bill: checkResult.rows[0] });
    }
    
    // Обновляем статус
    const result = await db.query(
      'UPDATE bills SET status = $1 WHERE public_token = $2 RETURNING *',
      ['paid', token]
    );
    
    console.log('Update result:', result.rows.length);
    
    res.json({ 
      message: 'Счет отмечен как оплаченный', 
      bill: result.rows[0] 
    });
    
  } catch (error) {
    console.error('=== PAYMENT ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

console.log('Payment route registered');

module.exports = router;