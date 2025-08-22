const express = require('express');
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validateCardData, validateFinancialData } = require('../middleware/validation');

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
    const { team_id, unassigned } = req.query;

    let query = `
      SELECT 
        c.*,
        t.name as team_name,
        COALESCE(commission_sum.total_commission, 0) as calculated_commission
      FROM cards c
      LEFT JOIN teams t ON c.team_id = t.id
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
      name, currency = 'USD', team_id, full_name, bank_password,
      card_password, phone, email, email_password, birth_date,
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date,
      next_payment_date, contractor_account, remaining_balance, commission_amount
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

    // Финансы с настраиваемой комиссией
    const initialBalance = parseFloat(remaining_balance) || 0;
    const customCommission = parseFloat(commission_amount) || 15;

    // При создании карты - снимаем указанную комиссию с баланса ТОЛЬКО если есть баланс
    const finalBalance = initialBalance > 0 ? Math.max(0, initialBalance - customCommission) : 0;

    // Начальные расчеты
    const totalSpentCalculated = 0; // пока ничего не потрачено
    const totalTopUpAmount = initialBalance; // первое пополнение = начальный баланс
    const commissionAmount = initialBalance > 0 ? customCommission : 0; // комиссия только если есть баланс

    console.log('Card creation finances:');
    console.log('- Initial balance:', initialBalance);
    console.log('- Custom commission:', customCommission);
    console.log('- Final balance:', finalBalance);
    console.log('- Total top up:', totalTopUpAmount);
    console.log('- Commission amount:', commissionAmount);

    const result = await db.query(
      `INSERT INTO cards (
        name, currency, team_id, full_name, bank_password, card_password, 
        phone, email, email_password, birth_date, passport_issue_date, 
        ipn, age, second_bank_phone, second_bank_pin, second_bank_email,
        second_bank_password, contractor_name, launch_date, next_payment_date, 
        contractor_account, income_amount, top_up_uah, remaining_balance, balance,
        daily_limit, last_transaction_date, total_spent_calculated, warm_up_amount, 
        total_top_up, commission_paid, topup_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32) 
      RETURNING *`,
      [
        name, currency, team_id || null, full_name || null, bank_password || null, card_password || null,
        phone || null, email || null, email_password || null, birthDateValue, passportDateValue,
        ipn || null, age, second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue, nextPaymentValue,
        contractor_account || null, 0, 0, initialBalance, finalBalance,
        8000, null, totalSpentCalculated, 0,
        totalTopUpAmount, commissionAmount, 8000
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
          (() => {
            const now = new Date();
            const ukraineTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
            return ukraineTime.toISOString().split('T')[0];
          })()
        ]
      );

      // Сохраняем комиссию как отдельную транзакцию
      await db.query(
        `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          result.rows[0].id,
          'expense',
          -customCommission,
          currency,
          initialBalance,
          finalBalance,
          'Комиссия за пополнение',
          req.user.id,
          new Date().toISOString().split('T')[0]
        ]
      );

      console.log('Initial topup and commission transactions recorded');
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
        COALESCE(commission_sum.total_commission, 0) as calculated_commission
       FROM cards c
       LEFT JOIN teams t ON c.team_id = t.id
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
  console.log('User:', req.user);

  try {
    const cardId = req.params.id;

    // Валидация ID карты
    if (!cardId || isNaN(parseInt(cardId))) {
      return res.status(400).json({ error: 'Некорректный ID карты' });
    }

    const { balance, topup_amount, update_date, description } = req.body;

    // Получаем текущие данные карты
    const cardResult = await db.query('SELECT * FROM cards WHERE id = $1', [parseInt(cardId)]);

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

    // ИСПРАВЛЕННАЯ ЛОГИКА С НАКОПЛЕНИЕМ БАЛАНСА:
    const currentBalance = parseFloat(card.balance) || 0;
    const additionalTopUp = parseFloat(topup_amount) || 0;
    const newRemainingBalance = parseFloat(balance) || 0; // это остаток, а не общий баланс
    const oldBalance = currentBalance;
    const currentTotalTopUp = parseFloat(card.total_top_up) || 0;

    let spentToday = 0;
    let newTotalSpent = parseFloat(card.total_spent_calculated) || 0;
    let newTotalTopUp = currentTotalTopUp;
    let newCardBalance = currentBalance; // начинаем с текущего баланса

    // ЕСЛИ ЕСТЬ ПОПОЛНЕНИЕ - добавляем к общей сумме пополнений и балансу
    if (additionalTopUp > 0) {
      console.log('Topup detected');
      spentToday = 0;
      newTotalTopUp = currentTotalTopUp + additionalTopUp;
      newCardBalance = currentBalance + additionalTopUp; // добавляем к существующему балансу
    } else {
      // ЕСЛИ НЕТ ПОПОЛНЕНИЯ - считаем только трату
      spentToday = Math.max(0, currentBalance - newRemainingBalance);
      newTotalSpent = newTotalSpent + spentToday;
      newCardBalance = newRemainingBalance; // устанавливаем новый остаток
    }

    console.log('Financial calculations:');
    console.log('- Current card balance:', currentBalance, card.currency);
    console.log('- New remaining balance (from form):', newRemainingBalance, card.currency);
    console.log('- Topup today:', additionalTopUp, card.currency);
    console.log('- Spent today:', spentToday, card.currency);
    console.log('- New card balance (calculated):', newCardBalance, card.currency);
    console.log('- Total spent:', newTotalSpent, card.currency);
    console.log('- Total top up:', newTotalTopUp, card.currency);

    // Начинаем транзакцию
    console.log('Starting transaction...');
    await db.query('BEGIN');

    try {
      // Сохраняем пополнение в историю (если было)
      if (additionalTopUp > 0) {
        console.log('Saving topup to history:', additionalTopUp);

        // Проверяем была ли уже списана комиссия (ищем транзакцию с описанием комиссии)
        const commissionResult = await db.query(
          `SELECT COUNT(*) as commission_count 
           FROM card_transactions 
           WHERE card_id = $1 AND description LIKE '%омиссия%' AND is_cancelled = FALSE`,
          [cardId]
        );

        const hasCommission = parseInt(commissionResult.rows[0].commission_count) > 0;
        const commission = hasCommission ? 0 : (parseFloat(card.commission_paid) || 15);

        console.log('Commission check:');
        console.log('- Commission already taken:', hasCommission);
        console.log('- Commission amount:', commission);

        // Получаем текущую сумму пополнений за сегодня
        const today = update_date || (() => {
          const now = new Date();
          console.log('Server UTC time:', now.toISOString());

          // Киев/Львов = UTC+3 (летом UTC+3, зимой UTC+2, но сейчас лето)
          const kyivTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
          console.log('Kyiv time calculated:', kyivTime.toISOString());

          const result = kyivTime.toISOString().split('T')[0];
          console.log('Final date used:', result);
          return result;
        })();
        const todayTopupsResult = await db.query(
          `SELECT COALESCE(SUM(amount), 0) as today_topups 
           FROM card_transactions 
           WHERE card_id = $1 AND transaction_type = 'topup' AND transaction_date = $2 AND is_cancelled = FALSE`,
          [cardId, today]
        );

        const currentTodayTopups = parseFloat(todayTopupsResult.rows[0].today_topups) || 0;
        const newTodayTopups = currentTodayTopups + additionalTopUp;
        const topupLimit = parseFloat(card.topup_limit) || 8000;

        // Рассчитываем финальный баланс с учетом комиссии
        const finalBalanceAfterCommission = newCardBalance - commission;

        console.log('Topup calculation:');
        console.log('- New card balance before commission:', newCardBalance);
        console.log('- Commission:', commission);
        console.log('- Final balance after commission:', finalBalanceAfterCommission);

        // Сохраняем транзакцию пополнения
        await db.query(
          `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [cardId, 'topup', additionalTopUp, card.currency, oldBalance, newCardBalance, description || 'Пополнение карты', req.user.id, today]
        );

        // Сохраняем комиссию как отдельную транзакцию (если нужно)
        if (commission > 0) {
          await db.query(
            `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [cardId, 'expense', -commission, card.currency, newCardBalance, finalBalanceAfterCommission, 'Комиссия за пополнение', req.user.id, today]
          );
          console.log('Commission transaction saved:', commission);

          // Обновляем баланс с учетом комиссии
          newCardBalance = finalBalanceAfterCommission;
        }

        // Проверяем превышение лимита и обновляем статус
        let newStatus = card.status;
        if (newTodayTopups >= topupLimit && card.status === 'active') {
          newStatus = 'limit_exceeded';
          console.log('Topup limit exceeded, changing status to limit_exceeded');
        }

        // Обновляем карту
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

        console.log('Card updated with topup, final balance:', newCardBalance);

        await db.query('COMMIT');

        res.json({
          message: 'Карта успешно обновлена',
          card: result.rows[0]
        });

      } else {
        // Нет пополнения - только траты
        console.log('No topup, only expenses');

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
            update_date || new Date().toISOString().split('T')[0],
            cardId
          ]
        );

        // Сохраняем трату в историю (если была)
        if (spentToday > 0) {
          console.log('Saving expense to history:', spentToday);
          await db.query(
            `INSERT INTO card_transactions (card_id, transaction_type, amount, currency, balance_before, balance_after, description, created_by, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [cardId, 'expense', -spentToday, card.currency, oldBalance, newCardBalance, description || 'Ежедневная трата', req.user.id, update_date || new Date().toISOString().split('T')[0]]
          );
        }

        await db.query('COMMIT');

        res.json({
          message: 'Карта успешно обновлена',
          card: result.rows[0]
        });
      }

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


// Обновление данных карты (только админ и менеджер)
router.put('/:id', authenticateToken, checkRole(['admin', 'manager']), validateCardData, async (req, res) => {
  try {
    const cardId = req.params.id;
    const {
      name, currency, team_id, full_name, bank_password,
      card_password, phone, email, email_password, birth_date,
      passport_issue_date, ipn, second_bank_phone, second_bank_pin,
      second_bank_email, second_bank_password, contractor_name, launch_date,
      next_payment_date, contractor_account, remaining_balance, commission_amount
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
        next_payment_date = $20, contractor_account = $21, updated_at = CURRENT_TIMESTAMP
      WHERE id = $22 RETURNING *`,
      [
        name, currency, team_id || null, full_name || null, bank_password || null,
        card_password || null, phone || null, email || null, email_password || null,
        birthDateValue, passportDateValue, ipn || null, age,
        second_bank_phone || null, second_bank_pin || null, second_bank_email || null,
        second_bank_password || null, contractor_name || null, launchDateValue,
        nextPaymentValue, contractor_account || null, cardId
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

    if (!buyer_id) {
      return res.status(400).json({ error: 'ID баера обязателен' });
    }

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
    const result = await db.query(
      'UPDATE cards SET buyer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
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