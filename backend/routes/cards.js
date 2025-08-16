const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Получение всех карт (с учетом роли)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM cards WHERE status != $1';
    let params = ['deleted'];

    // Ограничение доступа по ролям
    if (req.user.role === 'manager' || req.user.role === 'buyer') {
      query += ' AND team_id = $2';
      params.push(req.user.team_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    res.json({
      cards: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка получения карт:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание новой карты (только админ и менеджер)
// Создание новой карты (только админ и менеджер)
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { 
      name, currency = 'USD', team_id, full_name, bank_password, 
      card_password, phone, email, email_password, birth_date, 
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date, 
      next_payment_date, contractor_account, income_amount, top_up_uah,
      remaining_balance, daily_limit, last_transaction_date
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название карты обязательно' });
    }

    // Обработка дат
    const birthDateValue = birth_date && birth_date.trim() !== '' ? birth_date : null;
    const passportDateValue = passport_issue_date && passport_issue_date.trim() !== '' ? passport_issue_date : null;
    const launchDateValue = launch_date && launch_date.trim() !== '' ? launch_date : null;
    const nextPaymentValue = next_payment_date && next_payment_date.trim() !== '' ? next_payment_date : null;
    const lastTransactionValue = last_transaction_date && last_transaction_date.trim() !== '' ? last_transaction_date : null;

    // Вычисление возраста
    let age = null;
    if (birthDateValue) {
      const birthYear = new Date(birthDateValue).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }

    // Расчет "скручено" (пополнения - остаток)
    const topUpAmount = parseFloat(top_up_uah) || 0;
    const remainingAmount = parseFloat(remaining_balance) || 0;
    const totalSpentCalculated = topUpAmount - remainingAmount;

    // Расчет прогрева (скручено - 15$)
    const warmUpAmount = Math.max(0, totalSpentCalculated - 15);

    const result = await db.query(
      `INSERT INTO cards (
        name, currency, team_id, full_name, bank_password, card_password, 
        phone, email, email_password, birth_date, passport_issue_date, 
        ipn, age, second_bank_phone, second_bank_pin, second_bank_email,
        second_bank_password, contractor_name, launch_date, next_payment_date, 
        contractor_account, income_amount, top_up_uah, remaining_balance,
        daily_limit, last_transaction_date, total_spent_calculated, warm_up_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) 
      RETURNING *`,
      [
        name, currency, team_id || null, full_name || null, bank_password || null, card_password || null,
        phone || null, email || null, email_password || null, birthDateValue, passportDateValue,
        ipn || null, age, second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue, nextPaymentValue,
        contractor_account || null, parseFloat(income_amount) || 0, topUpAmount, remainingAmount,
        parseFloat(daily_limit) || 8000, lastTransactionValue, totalSpentCalculated, warmUpAmount
      ]
    );

    res.status(201).json({
      message: 'Карта создана успешно',
      card: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление карты (только админ и менеджер)
router.delete('/:id', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const cardId = req.params.id;

    // Проверяем существование карты
    const checkResult = await db.query('SELECT id, team_id FROM cards WHERE id = $1', [cardId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = checkResult.rows[0];

    // Проверяем права доступа (менеджер может удалять только карты своей команды)
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этой карты' });
    }

    // Мягкое удаление - меняем статус на deleted
    await db.query(
      'UPDATE cards SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['deleted', cardId]
    );

    res.json({ message: 'Карта успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;