const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validateCardData, validateFinancialData } = require('../middleware/validation');
const { getKyivDate } = require('../utils/timezone');

const router = express.Router();

const CARD_STATUSES = {
  'active': 'Активна',
  'blocked': 'Заблокирована',
  'reissue': 'Перевыпуск',
  'error': 'Ошибка',
  'rebind': 'Переподвязать',
  'not_issued': 'Не выдана',
  'not_spinning': 'Не крутит'
};

// Функция автоматической проверки статуса
function checkCardActivity(card) {
  const lastActivity = new Date(card.last_transaction_date || card.created_at);
  const now = new Date();
  const daysDiff = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

  // Если нет активности 3 дня и статус "активна" - меняем на "не крутит"
  if (daysDiff >= 3 && card.status === 'active') {
    return 'not_spinning';
  }

  return card.status;
}

// Получение доступных статусов карт
router.get('/statuses', authenticateToken, async (req, res) => {
  try {
    res.json({
      statuses: CARD_STATUSES
    });
  } catch (error) {
    console.error('Ошибка получения статусов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление статуса карты
router.put('/:id/status', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const cardId = req.params.id;
    const { status } = req.body;

    // Валидация статуса
    const validStatuses = ['active', 'blocked', 'reissue', 'error', 'rebind', 'not_issued', 'not_spinning'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус карты' });
    }

    // Проверяем существование карты
    const checkResult = await db.query('SELECT id, team_id FROM cards WHERE id = $1', [cardId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = checkResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для изменения статуса этой карты' });
    }

    // Обновляем статус
    const result = await db.query(
      'UPDATE cards SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, cardId]
    );

    res.json({
      message: 'Статус карты обновлен',
      card: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});



// Получение всех карт (с учетом роли)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { team_id, unassigned, buyer_id } = req.query; // ДОБАВИТЬ buyer_id

    let query = `
        SELECT 
          c.*,
          t.name as team_name,
          tb.name as buyer_name,
          COALESCE(commission_sum.total_commission, 0) as calculated_commission
        FROM cards c
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN team_buyers tb ON c.buyer_id = tb.id
        LEFT JOIN (
          SELECT 
            card_id,
            SUM(ABS(amount)) as total_commission
          FROM card_transactions 
          WHERE transaction_type = 'expense' 
            AND description LIKE '%омиссия%' 
            AND is_cancelled = FALSE
          GROUP BY card_id
        ) commission_sum ON c.id = commission_sum.card_id
        WHERE c.status != $1
    `;

    let params = ['deleted'];
    let paramIndex = 2;

    // ДОБАВИТЬ ЭТО ПЕРЕД ОСТАЛЬНЫМИ ФИЛЬТРАМИ:
    // Фильтр по конкретному баеру
    if (buyer_id) {
      query += ` AND c.buyer_id = $${paramIndex}`;
      params.push(parseInt(buyer_id));
      paramIndex++;
    }

    // Фильтрация для менеджеров и баеров - только их команда
    if (req.user.role === 'manager' || req.user.role === 'buyer') {
      if (!req.user.team_id || typeof req.user.team_id !== 'number') {
        return res.status(403).json({ error: 'Некорректный ID команды' });
      }
      query += ` AND c.team_id = $${paramIndex}`;
      params.push(req.user.team_id);
      paramIndex++;
    }

    // Фильтр по команде для админов
    if (team_id && req.user.role === 'admin') {
      query += ` AND c.team_id = $${paramIndex}`;
      params.push(parseInt(team_id));
      paramIndex++;
    }

    // Фильтр неназначенных карт
    if (unassigned === 'true') {
      query += ' AND c.buyer_id IS NULL';
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);

    // Обновляем комиссию для каждой карты
    const cardsWithCalculatedCommission = result.rows.map(card => ({
      ...card,
      commission_paid: card.calculated_commission
    }));

    res.json({
      cards: cardsWithCalculatedCommission,
      total: cardsWithCalculatedCommission.length
    });
  } catch (error) {
    console.error('Ошибка получения карт:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/', authenticateToken, checkRole(['admin', 'manager']), validateCardData, async (req, res) => {
  try {
    const {
      name, currency = 'USD', team_id, buyer_id, full_name, bank_password,
      card_password, phone, email, email_password, birth_date,
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date,
      next_payment_date, contractor_account, remaining_balance, commission_amount,
      card_number, expiry_date, cvv_code, iban
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название карты обязательно' });
    }

    // Обработка дат
    const birthDateValue = birth_date && birth_date.trim() !== '' ? birth_date : null;
    const passportDateValue = passport_issue_date && passport_issue_date.trim() !== '' ? passport_issue_date : null;
    const launchDateValue = launch_date && launch_date.trim() !== '' ? launch_date : null;
    const nextPaymentValue = next_payment_date && next_payment_date.trim() !== '' ? next_payment_date : null;
    const buyerAssignedDate = buyer_id ? new Date() : null;

    // Вычисление возраста
    let age = null;
    if (birthDateValue) {
      const birthYear = new Date(birthDateValue).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }

    // Финансы с настраиваемой комиссией
    const initialBalance = parseFloat(remaining_balance) || 0;
    const customCommission = parseFloat(commission_amount) || 15;

    // При создании карты - снимаем указанную комиссию с баланса ТОЛЬКО если есть баланс
    const finalBalance = initialBalance > 0 ? Math.max(0, initialBalance - customCommission) : 0;

    // Начальные расчеты
    const totalSpentCalculated = 0; // пока ничего не потрачено
    const totalTopUpAmount = initialBalance; // первое пополнение = начальный баланс
    const commissionAmount = initialBalance > 0 ? customCommission : 0; // комиссия только если есть баланс

    const result = await db.query(
      `INSERT INTO cards (
        name, currency, team_id, buyer_id, buyer_assigned_date, full_name, bank_password, card_password, 
        phone, email, email_password, birth_date, passport_issue_date, 
        ipn, age, second_bank_phone, second_bank_pin, second_bank_email,
        second_bank_password, contractor_name, launch_date, next_payment_date, 
        contractor_account, income_amount, top_up_uah, remaining_balance, balance,
        daily_limit, last_transaction_date, total_spent_calculated, warm_up_amount, 
        total_top_up, commission_paid, topup_limit,
        card_number, expiry_date, cvv_code, iban
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)
      RETURNING *`,
      [
        name, currency, team_id || null, buyer_id || null, buyerAssignedDate,
        full_name || null, bank_password || null, card_password || null,
        phone || null, email || null, email_password || null, birthDateValue, passportDateValue,
        ipn || null, age, second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue, nextPaymentValue,
        contractor_account || null, 0, 0, initialBalance, finalBalance,
        8000, null, totalSpentCalculated, 0,
        totalTopUpAmount, commissionAmount, 8000,
        card_number || null, expiry_date || null, cvv_code || null, iban || null
      ]
    );

    // Записываем первое пополнение в историю транзакций
    if (initialBalance > 0) {
      // Сохраняем пополнение
      await db.query(
        `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          result.rows[0].id,
          'topup',
          initialBalance,
          currency,
          0,
          initialBalance,
          'Первоначальное пополнение при создании карты',
          req.user.id,
          getKyivDate()
        ]
      );

      // Сохраняем комиссию как отдельную транзакцию
      if (commissionAmount > 0) {
        await db.query(
          `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            result.rows[0].id,
            'expense',
            -commissionAmount,
            currency,
            initialBalance,
            finalBalance,
            'Комиссия за обслуживание карты',
            req.user.id,
            getKyivDate()
          ]
        );
      }
    }

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


// Получение карт с пересчетом за период
router.get('/period', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Необходимо указать даты from и to' });
    }

    console.log('Getting cards for period:', from, 'to', to);

    let query = `
      SELECT 
        c.*,
        COALESCE(period_stats.spent_in_period, 0) as spent_in_period,
        COALESCE(period_stats.topup_in_period, 0) as topup_in_period
      FROM cards c
      LEFT JOIN (
        SELECT 
          card_id,
          SUM(CASE WHEN transaction_type = 'expense' AND is_cancelled = FALSE AND description NOT LIKE '%омиссия%' THEN ABS(amount) ELSE 0 END) as spent_in_period,
          SUM(CASE WHEN transaction_type = 'topup' AND is_cancelled = FALSE THEN amount ELSE 0 END) as topup_in_period
        FROM card_transactions 
        WHERE transaction_date >= $1 AND transaction_date <= $2
        GROUP BY card_id
      ) period_stats ON c.id = period_stats.card_id
        WHERE c.status != $3 AND (
          (period_stats.card_id IS NOT NULL) OR 
          (DATE(c.created_at) >= $1 AND DATE(c.created_at) <= $2)
        )
    `;

    let params = [from, to, 'deleted'];
    let paramIndex = 4;

    // Фильтрация по команде для менеджеров
    if (req.user.role === 'manager' || req.user.role === 'buyer') {
      if (!req.user.team_id || typeof req.user.team_id !== 'number') {
        return res.status(403).json({ error: 'Некорректный ID команды' });
      }
      query += ` AND c.team_id = $${paramIndex}`;
      params.push(req.user.team_id);
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);

    // Пересчитываем данные для каждой карты
    const cardsWithPeriodData = result.rows.map(card => ({
      ...card,
      total_spent_calculated: parseFloat(card.spent_in_period) || 0, // траты за период
      total_top_up: parseFloat(card.topup_in_period) || 0 // ЗАМЕНЯЕМ общие пополнения на пополнения за период
    }));

    // Считаем общую сводку по валютам
    const summaryByCurrency = {};

    cardsWithPeriodData.forEach(card => {
      const currency = card.currency || 'USD';
      const hasOperations = (parseFloat(card.spent_in_period) || 0) > 0 || (parseFloat(card.topup_in_period) || 0) > 0;

      // Создаем запись для валюты если её нет
      if (!summaryByCurrency[currency]) {
        summaryByCurrency[currency] = {
          total_spent: 0,
          total_topup: 0,
          cards_count: 0
        };
      }

      // Добавляем траты и пополнения
      summaryByCurrency[currency].total_spent += parseFloat(card.spent_in_period) || 0;
      summaryByCurrency[currency].total_topup += parseFloat(card.topup_in_period) || 0;

      // Считаем карту только если у неё есть операции за период
      if (hasOperations) {
        summaryByCurrency[currency].cards_count += 1;
      }
    });

    // Убираем валюты без операций
    Object.keys(summaryByCurrency).forEach(currency => {
      const data = summaryByCurrency[currency];
      if (data.total_spent === 0 && data.total_topup === 0 && data.cards_count === 0) {
        delete summaryByCurrency[currency];
      }
    });

    res.json({
      cards: cardsWithPeriodData,
      summary: summaryByCurrency,
      period_from: from,
      period_to: to,
      total_cards: cardsWithPeriodData.length
    });
  } catch (error) {
    console.error('Ошибка получения карт за период:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение одной карты по ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cardId = req.params.id;

    const result = await db.query(
      `SELECT 
        c.*,
        t.name as team_name,
        tb.name as buyer_name,
        COALESCE(commission_sum.total_commission, 0) as calculated_commission
       FROM cards c
       LEFT JOIN teams t ON c.team_id = t.id
       LEFT JOIN team_buyers tb ON c.buyer_id = tb.id
       LEFT JOIN (
         SELECT 
           card_id,
           SUM(ABS(amount)) as total_commission
         FROM card_transactions 
         WHERE transaction_type = 'expense' 
           AND description LIKE '%омиссия%' 
           AND is_cancelled = FALSE
         GROUP BY card_id
       ) commission_sum ON c.id = commission_sum.card_id
       WHERE c.id = $1 AND c.status != $2`,
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

    // Подставляем рассчитанную комиссию
    card.commission_paid = card.calculated_commission;

    res.json({ card: card });
  } catch (error) {
    console.error('Ошибка получения карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
// Обновление финансовых данных карты (с сохранением истории)
router.post('/:id/update', authenticateToken, checkRole(['admin', 'manager']), validateFinancialData, async (req, res) => {
  console.log('=== UPDATE ROUTE CALLED ===');
  console.log('Card ID:', req.params.id);
  console.log('Body:', req.body);

  try {
    const cardId = req.params.id;

    if (!cardId || isNaN(parseInt(cardId))) {
      return res.status(400).json({ error: 'Некорректный ID карты' });
    }

    const { balance, topup_amount, update_date, description } = req.body;

    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1', [parseInt(cardId)]);

    if (cardResult.rows.length === 0) {
      console.log('Card not found');
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];
    console.log('Card found:', card.name, 'Current balance:', card.balance, card.currency);

    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      console.log('Access denied for manager');
      return res.status(403).json({ error: 'Недостаточно прав для обновления этой карты' });
    }

    const currentBalance = parseFloat(card.balance) || 0;
    const additionalTopUp = parseFloat(topup_amount) || 0;
    const newRemainingBalance = parseFloat(balance) || 0;
    const oldBalance = currentBalance;
    const currentTotalTopUp = parseFloat(card.total_top_up) || 0;

    let spentToday = 0;
    let newTotalSpent = parseFloat(card.total_spent_calculated) || 0;
    let newTotalTopUp = currentTotalTopUp;
    let newCardBalance = currentBalance;

    if (additionalTopUp > 0) {
      console.log('Topup detected');
      spentToday = 0;
      newTotalTopUp = currentTotalTopUp + additionalTopUp;
      newCardBalance = currentBalance + additionalTopUp;
    } else {
      spentToday = Math.max(0, currentBalance - newRemainingBalance);
      newTotalSpent = newTotalSpent + spentToday;
      newCardBalance = newRemainingBalance;
    }

    await db.query('BEGIN');

    try {
      if (additionalTopUp > 0) {
        console.log('Saving topup to history:', additionalTopUp);

        const commissionResult = await db.query(
          `SELECT COUNT(*) as commission_count 
           FROM card_transactions 
           WHERE card_id = $1 AND description LIKE '%омиссия%' AND is_cancelled = FALSE`,
          [cardId]
        );

        const hasCommission = parseInt(commissionResult.rows[0].commission_count) > 0;
        const wasCommissionTaken = hasCommission || (parseFloat(card.commission_paid) > 0);
        const commission = wasCommissionTaken ? 0 : 15;

        // ДОБАВИТЬ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДАТ
        const today = update_date || getKyivDate();
        console.log('=== TRANSACTION DATE ANALYSIS ===');
        console.log('- Current system UTC time:', new Date().toISOString());
        console.log('- update_date from frontend:', update_date);
        console.log('- getKyivDate() result:', getKyivDate());
        console.log('- Final date used for transaction:', today);

        const todayTopupsResult = await db.query(
          `SELECT COALESCE(SUM(amount), 0) as today_topups 
           FROM card_transactions 
           WHERE card_id = $1 AND transaction_type = 'topup' AND transaction_date = $2 AND is_cancelled = FALSE`,
          [cardId, today]
        );

        const currentTodayTopups = parseFloat(todayTopupsResult.rows[0].today_topups) || 0;
        const newTodayTopups = currentTodayTopups + additionalTopUp;
        const topupLimit = parseFloat(card.topup_limit) || 8000;
        const finalBalanceAfterCommission = newCardBalance - commission;

        // Сохраняем транзакцию пополнения
        await db.query(
          `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [cardId, 'topup', additionalTopUp, card.currency, oldBalance, newCardBalance, description || 'Пополнение карты', req.user.id, today]
        );

        console.log('=== TRANSACTION SAVED ===');
        console.log('- Transaction type: topup');
        console.log('- Amount:', additionalTopUp);
        console.log('- Date saved:', today);

        if (commission > 0) {
          await db.query(
            `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [cardId, 'expense', -commission, card.currency, newCardBalance, finalBalanceAfterCommission, 'Комиссия за пополнение', req.user.id, today]
          );

          console.log('=== COMMISSION TRANSACTION SAVED ===');
          console.log('- Commission amount:', commission);
          console.log('- Date saved:', today);

          newCardBalance = finalBalanceAfterCommission;
        }

        let newStatus = card.status;
        if (newTodayTopups >= topupLimit && card.status === 'active') {
          newStatus = 'limit_exceeded';
        }

        const result = await db.query(
          `UPDATE cards SET 
            balance = $1, 
            remaining_balance = $2,
            total_spent_calculated = $3,
            total_top_up = $4,
            last_transaction_date = $5,
            status = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 RETURNING *`,
          [
            Math.max(0, newCardBalance),
            newRemainingBalance,
            newTotalSpent,
            newTotalTopUp,
            today,
            newStatus,
            cardId
          ]
        );

        await db.query('COMMIT');

        res.json({
          message: 'Карта успешно обновлена',
          card: result.rows[0]
        });

      } else {
        // Нет пополнения - только траты
        console.log('No topup, only expenses');
        const expenseDate = update_date || getKyivDate();

        console.log('=== EXPENSE DATE ANALYSIS ===');
        console.log('- update_date from frontend:', update_date);
        console.log('- getKyivDate() result:', getKyivDate());
        console.log('- Final expense date used:', expenseDate);

        const result = await db.query(
          `UPDATE cards SET 
            balance = $1, 
            remaining_balance = $2,
            total_spent_calculated = $3,
            last_transaction_date = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 RETURNING *`,
          [
            Math.max(0, newCardBalance),
            newRemainingBalance,
            newTotalSpent,
            expenseDate,
            cardId
          ]
        );

        if (spentToday > 0) {
          await db.query(
            `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [cardId, 'expense', -spentToday, card.currency, oldBalance, newCardBalance, description || 'Ежедневная трата', req.user.id, expenseDate]
          );

          console.log('=== EXPENSE TRANSACTION SAVED ===');
          console.log('- Expense amount:', spentToday);
          console.log('- Date saved:', expenseDate);
        }

        await db.query('COMMIT');

        res.json({
          message: 'Карта успешно обновлена',
          card: result.rows[0]
        });
      }

    } catch (error) {
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

    // ДОБАВИТЬ ЛОГИ для проверки дат
    console.log('=== TRANSACTIONS FROM DB ===');
    console.log('Current server time:', new Date().toISOString());
    console.log('Current Kyiv date from function:', getKyivDate());

    result.rows.forEach(row => {
      console.log({
        id: row.id,
        type: row.transaction_type,
        amount: row.amount,
        transaction_date: row.transaction_date,
        created_at: row.created_at,
        description: row.description
      });
    });

    res.json({
      transactions: result.rows
    });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Отмена транзакции
router.post('/transactions/:transactionId/cancel', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const transactionId = req.params.transactionId;

    // Получаем транзакцию
    const transactionResult = await db.query(
      'SELECT * FROM card_transactions WHERE id = $1 AND is_cancelled = FALSE',
      [transactionId]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Транзакция не найдена или уже отменена' });
    }

    const transaction = transactionResult.rows[0];

    // Получаем карту
    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1', [transaction.card_id]);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для отмены этой транзакции' });
    }

    // Начинаем транзакцию
    await db.query('BEGIN');

    try {
      // Отмечаем транзакцию как отмененную
      await db.query(
        'UPDATE card_transactions SET is_cancelled = TRUE, cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $1 WHERE id = $2',
        [req.user.id, transactionId]
      );

      // Пересчитываем баланс карты
      let newBalance = parseFloat(card.balance);
      let newTotalTopUp = parseFloat(card.total_top_up) || 0;
      let newTotalSpent = parseFloat(card.total_spent_calculated) || 0;

      if (transaction.transaction_type === 'topup') {
        // Отменяем пополнение - вычитаем из баланса и общих пополнений
        newBalance -= parseFloat(transaction.amount);
        newTotalTopUp -= parseFloat(transaction.amount);
      } else if (transaction.transaction_type === 'expense') {
        // Отменяем расход - добавляем к балансу и вычитаем из трат
        newBalance += Math.abs(parseFloat(transaction.amount));
        newTotalSpent -= Math.abs(parseFloat(transaction.amount));
      }

      // Обновляем карту
      await db.query(
        'UPDATE cards SET balance = $1, total_top_up = $2, total_spent_calculated = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [Math.max(0, newBalance), Math.max(0, newTotalTopUp), Math.max(0, newTotalSpent), card.id]
      );

      await db.query('COMMIT');

      res.json({ message: 'Транзакция успешно отменена' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Ошибка отмены транзакции:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.put('/:id', authenticateToken, checkRole(['admin', 'manager']), validateCardData, async (req, res) => {
  try {
    const cardId = req.params.id;
    const {
      name, currency, team_id, full_name, bank_password,
      card_password, phone, email, email_password, birth_date,
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date,
      next_payment_date, contractor_account,
      card_number, expiry_date, cvv_code, iban
    } = req.body;

    // Проверяем существование карты
    const checkResult = await db.query('SELECT id, team_id FROM cards WHERE id = $1', [cardId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = checkResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этой карты' });
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

    const result = await db.query(
      `UPDATE cards SET 
        name = $1, currency = $2, team_id = $3, full_name = $4, bank_password = $5,
        card_password = $6, phone = $7, email = $8, email_password = $9,
        birth_date = $10, passport_issue_date = $11, ipn = $12, age = $13,
        second_bank_phone = $14, second_bank_pin = $15, second_bank_email = $16,
        second_bank_password = $17, contractor_name = $18, launch_date = $19,
        next_payment_date = $20, contractor_account = $21,
        card_number = $22, expiry_date = $23, cvv_code = $24, iban = $25,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $26 RETURNING *`,
      [
        name, currency, team_id || null, full_name || null, bank_password || null,
        card_password || null, phone || null, email || null, email_password || null,
        birthDateValue, passportDateValue, ipn || null, age,
        second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue,
        nextPaymentValue, contractor_account || null,
        card_number || null, expiry_date || null, cvv_code || null, iban || null,
        cardId
      ]
    );

    res.json({
      message: 'Карта успешно обновлена',
      card: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// Обновление лимитов карты
router.put('/:id/limits', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const cardId = req.params.id;
    const { topup_limit } = req.body;

    // Валидация
    if (isNaN(parseFloat(topup_limit))) {
      return res.status(400).json({ error: 'Некорректное значение лимита пополнений' });
    }

    // Получаем полные данные карты
    const checkResult = await db.query('SELECT * FROM cards WHERE id = $1', [cardId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = checkResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для изменения лимита этой карты' });
    }

    const newLimit = parseFloat(topup_limit);
    const currentTopups = parseFloat(card.total_top_up) || 0;

    // Определяем новый статус
    let newStatus = card.status;
    if (card.status === 'limit_exceeded' && currentTopups < newLimit) {
      newStatus = 'active';
      console.log('Limit increased, changing status back to active');
    } else if (card.status === 'active' && currentTopups >= newLimit) {
      newStatus = 'limit_exceeded';
      console.log('Current topups exceed new limit, setting status to limit_exceeded');
    }

    // Обновляем лимит и статус
    const result = await db.query(
      `UPDATE cards SET 
        topup_limit = $1,
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 RETURNING *`,
      [newLimit, newStatus, cardId]
    );

    console.log(`Updated card ${cardId}: limit ${newLimit}, status ${newStatus}`);

    res.json({
      message: 'Лимит успешно обновлен',
      card: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления лимита:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Назначение карты баеру
router.put('/:id/assign', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const cardId = req.params.id;
    const { buyer_id } = req.body;

    // Проверяем существование карты
    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1 AND status != $2', [cardId, 'deleted']);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];

    // Проверяем права доступа (менеджер может назначать только карты своей команды)
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для назначения этой карты' });
    }

    // Если buyer_id === null, снимаем назначение
    if (buyer_id === null) {
      const result = await db.query(
        'UPDATE cards SET buyer_id = NULL, buyer_assigned_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [cardId]
      );

      return res.json({
        message: 'Назначение карты снято',
        card: result.rows[0]
      });
    }

    // Проверяем существование баера
    const buyerResult = await db.query('SELECT * FROM team_buyers WHERE id = $1', [buyer_id]);
    if (buyerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Баер не найден' });
    }

    const buyer = buyerResult.rows[0];

    // Проверяем что баер из той же команды что и карта
    if (buyer.team_id !== card.team_id) {
      return res.status(400).json({ error: 'Баер и карта должны быть из одной команды' });
    }

    // Назначаем карту
    // Назначаем карту
    const result = await db.query(
      'UPDATE cards SET buyer_id = $1, buyer_assigned_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [buyer_id, cardId]
    );

    res.json({
      message: 'Карта успешно назначена баеру',
      card: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка назначения карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Изменение команды карты (снимает назначение с баера)
// Изменение команды карты (снимает назначение с баера)
router.put('/:id/change-team', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const cardId = req.params.id;
    const { team_id } = req.body;

    // Получаем текущие данные карты
    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1', [cardId]);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    const card = cardResult.rows[0];

    // Проверяем права доступа
    if (req.user.role === 'manager' && card.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Недостаточно прав для изменения команды карты' });
    }

    // ДОБАВИТЬ: Если карта была назначена баеру, создаем запись о переносе
    if (card.buyer_id) {
      await db.query(`
        INSERT INTO card_transfers (
          original_card_id, old_buyer_id, old_team_id, new_team_id,
          card_name, balance_snapshot, spent_snapshot, topup_snapshot, currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        cardId,
        card.buyer_id,
        card.team_id,
        team_id || null,
        card.name,
        card.balance || 0,
        card.total_spent_calculated || 0,
        card.total_top_up || 0,
        card.currency || 'USD'
      ]);
    }

    // Обновляем команду карты и снимаем назначение с баера
    await db.query(
      'UPDATE cards SET team_id = $1, buyer_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [team_id || null, cardId]
    );

    res.json({
      message: 'Команда карты изменена, назначение с баера снято',
      card_id: cardId,
      new_team_id: team_id
    });

  } catch (error) {
    console.error('Ошибка изменения команды карты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;