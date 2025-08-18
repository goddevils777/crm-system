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
router.post('/', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { 
      name, currency = 'USD', team_id, full_name, bank_password, 
      card_password, phone, email, email_password, birth_date, 
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date, 
      next_payment_date, contractor_account, remaining_balance, daily_limit
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название карты обязательно' });
    }

    // Обработка дат
    const birthDateValue = birth_date && birth_date.trim() !== '' ? birth_date : null;
    const passportDateValue = passport_issue_date && passport_issue_date.trim() !== '' ? passport_issue_date : null;
    const launchDateValue = launch_date && launch_date.trim() !== '' ? launch_date : null;
    const nextPaymentValue = next_payment_date && next_payment_date.trim() !== '' ? next_payment_date : null;

    // Вычисление возраста
    let age = null;
    if (birthDateValue) {
      const birthYear = new Date(birthDateValue).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }

    // Финансы (упрощенная логика для новой карты)
    const initialBalance = parseFloat(remaining_balance) || 0;
    const incomeAmount = 0; // убрали из формы
    const topUpAmount = 0;  // убрали из формы

    // Начальные расчеты (пока карта только создана)
    const totalSpentCalculated = 0; // пока ничего не потрачено
    const warmUpAmount = 0; // прогрев будет считаться при обновлениях

    const result = await db.query(
      `INSERT INTO cards (
        name, currency, team_id, full_name, bank_password, card_password, 
        phone, email, email_password, birth_date, passport_issue_date, 
        ipn, age, second_bank_phone, second_bank_pin, second_bank_email,
        second_bank_password, contractor_name, launch_date, next_payment_date, 
        contractor_account, income_amount, top_up_uah, remaining_balance, balance,
        daily_limit, last_transaction_date, total_spent_calculated, warm_up_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29) 
      RETURNING *`,
      [
        name, currency, team_id || null, full_name || null, bank_password || null, card_password || null,
        phone || null, email || null, email_password || null, birthDateValue, passportDateValue,
        ipn || null, age, second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue, nextPaymentValue,
        contractor_account || null, incomeAmount, topUpAmount, initialBalance, initialBalance,
        parseFloat(daily_limit) || 8000, null, totalSpentCalculated, warmUpAmount
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

// Получение одной карты по ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    
    const result = await db.query(
      'SELECT * FROM cards WHERE id = $1 AND status != $2',
      [cardId, 'deleted']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = result.rows[0];

    // Проверяем права доступа
    if (req.user.role !== 'admin' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    res.json({ card: card });
  } catch (error) {
    console.error('Ошибка получения карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление финансовых данных карты (с сохранением истории)
router.post('/:id/update', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  console.log('=== UPDATE ROUTE CALLED ===');
  console.log('Card ID:', req.params.id);
  console.log('Body:', req.body);
  console.log('User:', req.user);
  
  try {
    const cardId = req.params.id;
    const { balance, topup_amount, update_date, description } = req.body;

    // Получаем текущие данные карты
    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1', [cardId]);
    
    if (cardResult.rows.length === 0) {
      console.log('Card not found');
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];
    console.log('Card found:', card.name, 'Current balance:', card.balance, card.currency);

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      console.log('Access denied for manager');
      return res.status(403).json({ error: 'Недостаточно прав для обновления этой карты' });
    }

// ИСПРАВЛЕННАЯ ЛОГИКА:
const currentBalance = parseFloat(card.balance) || 0; // текущий баланс карты
const additionalTopUp = parseFloat(topup_amount) || 0; // пополнение сегодня
const newBalance = parseFloat(balance) || 0; // новый остаток на карте
const oldBalance = currentBalance;

let spentToday = 0;
let newTotalSpent = parseFloat(card.total_spent_calculated) || 0;

// ЕСЛИ ЕСТЬ ПОПОЛНЕНИЕ - не считаем трату, только пополняем
if (additionalTopUp > 0) {
  console.log('Topup detected - no spending calculation');
  spentToday = 0; // при пополнении трата = 0
} else {
  // ЕСЛИ НЕТ ПОПОЛНЕНИЯ - считаем только трату
  spentToday = Math.max(0, currentBalance - newBalance);
  newTotalSpent = newTotalSpent + spentToday;
}

// Прогрев от общего скручено
const warmUpAmount = Math.max(0, newTotalSpent - 15);

console.log('Financial calculations:');
console.log('- Current card balance:', currentBalance, card.currency);
console.log('- New remainder:', newBalance, card.currency);
console.log('- Topup today:', additionalTopUp, card.currency);
console.log('- Spent today:', spentToday, card.currency);
console.log('- Total spent (unchanged for topup):', newTotalSpent, card.currency);
console.log('- Warm up amount:', warmUpAmount, card.currency);

    // Начинаем транзакцию
    console.log('Starting transaction...');
    await db.query('BEGIN');

    try {
      // Обновляем карту
      console.log('Updating card...');
      const result = await db.query(
        `UPDATE cards SET 
          balance = $1, 
          remaining_balance = $2,
          total_spent_calculated = $3,
          warm_up_amount = $4,
          last_transaction_date = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 RETURNING *`,
        [
          newBalance + additionalTopUp, // общий баланс карты (остаток + пополнение)
          newBalance, // текущий остаток
          newTotalSpent, // накопительное скручено
          warmUpAmount,
          update_date || new Date().toISOString().split('T')[0],
          cardId
        ]
      );
      console.log('Card updated successfully');

      // Сохраняем пополнение в историю (если было)
      if (additionalTopUp > 0) {
        console.log('Saving topup to history:', additionalTopUp);
        await db.query(
          `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [cardId, 'topup', additionalTopUp, card.currency, oldBalance, newBalance + additionalTopUp, description || 'Пополнение карты', req.user.id, update_date || new Date().toISOString().split('T')[0]]
        );
        console.log('Topup transaction saved');
      }

      // Сохраняем трату в историю (если была)
      if (spentToday > 0) {
        console.log('Saving expense to history:', spentToday);
        await db.query(
          `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [cardId, 'expense', -spentToday, card.currency, currentBalance, newBalance, description || 'Ежедневная трата', req.user.id, update_date || new Date().toISOString().split('T')[0]]
        );
        console.log('Expense transaction saved');
      }

      await db.query('COMMIT');
      console.log('Transaction committed successfully');

      res.json({
        message: 'Карта успешно обновлена',
        card: result.rows[0]
      });
    } catch (error) {
      console.log('Error in transaction, rolling back:', error);
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Ошибка обновления карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение истории операций по карте
router.get('/:id/transactions', authenticateToken, async (req, res) => {
  try {
    const cardId = req.params.id;
    
    // Проверяем доступ к карте
    const cardResult = await db.query('SELECT team_id FROM cards WHERE id = $1', [cardId]);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];
    if (req.user.role !== 'admin' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Получаем историю операций
    const result = await db.query(
      `SELECT ct.*, u.username as created_by_name 
       FROM card_transactions ct
       LEFT JOIN users u ON ct.created_by = u.id
       WHERE ct.card_id = $1
       ORDER BY ct.transaction_date DESC, ct.created_at DESC
       LIMIT 50`,
      [cardId]
    );

    res.json({
      transactions: result.rows
    });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;