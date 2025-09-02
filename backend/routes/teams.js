const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { getKyivDate, convertUtcToKyivDate } = require('../utils/timezone');
const currencyService = require('../utils/currencyService');

// Получение всех команд
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
  SELECT 
    t.*,
    COUNT(DISTINCT tb.id) as buyers_count,
    COUNT(DISTINCT c.id) as cards_count
  FROM teams t
  LEFT JOIN team_buyers tb ON t.id = tb.team_id
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
  COUNT(DISTINCT tb.id) as buyers_count,
  COUNT(DISTINCT c.id) as cards_count,
  COALESCE(SUM(DISTINCT c.balance), 0) as total_balance,
  COALESCE(SUM(DISTINCT c.total_spent_calculated), 0) as total_spent,
  COALESCE(SUM(DISTINCT c.total_top_up), 0) as total_topup
FROM teams t
LEFT JOIN team_buyers tb ON t.id = tb.team_id
LEFT JOIN cards c ON t.id = c.team_id AND c.status != 'deleted'
WHERE t.id = $1
GROUP BY t.id
`;

    const result = await db.query(query, [teamId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    console.log('Team balance calculation for team', teamId);
    console.log('Team data:', result.rows[0]);

    // Дополнительная проверка - прямой запрос балансов карт
    const cardsCheck = await db.query(
      'SELECT id, name, balance FROM cards WHERE team_id = $1 AND status != $2',
      [teamId, 'deleted']
    );
    console.log('Individual cards:', cardsCheck.rows);
    const manualTotal = cardsCheck.rows.reduce((sum, card) => sum + parseFloat(card.balance || 0), 0);
    console.log('Manual total calculation:', manualTotal);

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
    console.log(`=== DELETING TEAM ${teamId} ===`);

    // Проверяем существование команды
    const checkResult = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    const team = checkResult.rows[0];
    console.log(`Team found: ${team.name}`);

    // ДИАГНОСТИКА: Детальная проверка баеров
    console.log('=== BUYERS DIAGNOSTIC ===');

    // Все записи баеров для этой команды
    const allBuyersResult = await db.query('SELECT * FROM team_buyers WHERE team_id = $1', [teamId]);
    console.log('All buyers in team:', allBuyersResult.rows);

    // Баеры с user_id
    const activeBuyersResult = await db.query('SELECT * FROM team_buyers WHERE team_id = $1 AND user_id IS NOT NULL', [teamId]);
    console.log('Active buyers (with user_id):', activeBuyersResult.rows);

    // Баеры без user_id
    const deadBuyersResult = await db.query('SELECT * FROM team_buyers WHERE team_id = $1 AND user_id IS NULL', [teamId]);
    console.log('Dead buyers (without user_id):', deadBuyersResult.rows);

    // Оригинальная проверка (которая сейчас блокирует удаление)
    const buyersCountResult = await db.query('SELECT COUNT(*) as count FROM team_buyers WHERE team_id = $1', [teamId]);
    const buyersCount = parseInt(buyersCountResult.rows[0].count);
    console.log('Total buyers count from original query:', buyersCount);

    // Проверяем есть ли связанные карты
    const cardsResult = await db.query('SELECT COUNT(*) as count FROM cards WHERE team_id = $1 AND status != $2', [teamId, 'deleted']);
    const cardsCount = parseInt(cardsResult.rows[0].count);
    console.log('Active cards count:', cardsCount);

    if (cardsCount > 0) {
      return res.status(400).json({ error: `Нельзя удалить команду "${team.name}". У неё есть ${cardsCount} активных карт.` });
    }

    // Проверяем есть ли связанные пользователи  
    const usersResult = await db.query(`
  SELECT id, username, role FROM users 
  WHERE team_id = $1 
  AND (role != 'buyer' OR EXISTS (SELECT 1 FROM team_buyers tb WHERE tb.user_id = users.id))
`, [teamId]);
    const usersCount = usersResult.rows.length;
    console.log('Users in team:', usersResult.rows);

    if (usersCount > 0) {
      const usersList = usersResult.rows.map(u => `${u.username} (${u.role})`).join(', ');
      return res.status(400).json({
        error: `Нельзя удалить команду "${team.name}". В ней есть ${usersCount} пользователей: ${usersList}. Сначала переместите их в другие команды.`
      });
    }

    // Проверяем есть ли баеры в команде
    if (buyersCount > 0) {
      console.log('BLOCKING: Found buyers, cannot delete team');
      return res.status(400).json({
        error: `Нельзя удалить команду "${team.name}". В ней есть ${buyersCount} баеров. Сначала удалите всех баеров.`
      });
    }

    console.log('All checks passed, proceeding with deletion...');

    // Очищаем ссылки на команду у всех deleted карт
    await db.query('UPDATE cards SET team_id = NULL WHERE team_id = $1 AND status = $2', [teamId, 'deleted']);

    // Удаляем команду
    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);

    console.log(`Team ${team.name} deleted successfully`);
    res.json({ message: `Команда "${team.name}" успешно удалена` });
  } catch (error) {
    console.error('Ошибка удаления команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// Получение баеров команды
router.get('/:id/buyers', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;

const query = `
  SELECT 
    tb.id,
    tb.name as username,
    tb.telegram,
    tb.is_registered,
    tb.invitation_token,
    tb.created_at,
    tb.user_id,  -- ДОБАВЛЯЕМ ЭТО ПОЛЕ!
    u.email,
    u.username as user_login,  -- Логин пользователя
    COALESCE(buyer_stats.cards_count, 0) as cards_count,
    COALESCE(buyer_stats.total_balance, 0) as total_balance,
    COALESCE(buyer_stats.total_spent, 0) as total_spent,
    COALESCE(buyer_stats.total_topup, 0) as total_topup
  FROM team_buyers tb
  LEFT JOIN users u ON tb.user_id = u.id
  LEFT JOIN (
    SELECT 
      buyer_id,
      COUNT(*) as cards_count,
      SUM(balance) as total_balance,
      SUM(total_spent_calculated) as total_spent,
      SUM(total_top_up) as total_topup
    FROM cards 
    WHERE status != 'deleted' AND buyer_id IS NOT NULL
    GROUP BY buyer_id
  ) buyer_stats ON tb.id = buyer_stats.buyer_id
  WHERE tb.team_id = $1
  ORDER BY tb.created_at DESC
`;

    const result = await db.query(query, [teamId]);

    // ДОБАВИТЬ: Получаем разбивку по валютам для каждого баера
    const buyersWithCurrency = await Promise.all(result.rows.map(async (buyer) => {
      const currencyQuery = `
        SELECT 
          currency,
          COUNT(*) as cards_count,
          SUM(balance) as balance,
          SUM(total_spent_calculated) as spent,
          SUM(total_top_up) as topup
        FROM cards 
        WHERE buyer_id = $1 AND status != 'deleted'
        GROUP BY currency
      `;

      const currencyResult = await db.query(currencyQuery, [buyer.id]);

      const currencyBreakdown = {};
      currencyResult.rows.forEach(row => {
        currencyBreakdown[row.currency] = {
          cards_count: parseInt(row.cards_count),
          balance: parseFloat(row.balance || 0),
          spent: parseFloat(row.spent || 0),
          topup: parseFloat(row.topup || 0)
        };
      });

      return {
        ...buyer,
        currency_breakdown: currencyBreakdown
      };
    }));

    console.log('=== BUYERS WITH CURRENCY DEBUG ===');
    console.log('Sample buyer currency breakdown:', buyersWithCurrency[0]?.currency_breakdown);

    res.json({ buyers: buyersWithCurrency });
  } catch (error) {
    console.error('Ошибка получения баеров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
// Создание баера в команде (только админ и менеджер)  
router.post('/:id/buyers', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { username, telegram } = req.body;

    // Валидация
    if (!username || !telegram) {
      return res.status(400).json({ error: 'Имя и телеграм обязательны' });
    }

    // Проверяем существование команды
    const teamCheck = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    const team = teamCheck.rows[0];

    // ИСПРАВЛЕНИЕ: Генерируем логин без префикса "buyer_"
    const crypto = require('crypto');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const login = `${username.toLowerCase().replace(/\s+/g, '_')}_${randomSuffix}`;
    const password = crypto.randomBytes(8).toString('hex');

    // Хешируем пароль
    const bcrypt = require('bcryptjs');
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // ИСПРАВЛЕНИЕ: Создаем пользователя с сохранением plain_password
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, plain_password, role, team_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [login, `${login}@buyer.local`, passwordHash, password, 'buyer', teamId]
    );

    const userId = userResult.rows[0].id;

    // Создаем запись баера с привязкой к пользователю
    const buyerResult = await db.query(
      'INSERT INTO team_buyers (name, telegram, team_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [username.trim(), telegram.trim(), teamId, userId]
    );

    res.status(201).json({
      message: 'Баер создан успешно',
      buyer: {
        ...buyerResult.rows[0],
        user_id: userId
      },
      access_credentials: {
        login: login,
        password: password,
        team_name: team.name
      }
    });

  } catch (error) {
    console.error('Ошибка создания баера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление баера
router.delete('/buyers/:buyerId', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const buyerId = req.params.buyerId;

    // Проверяем что баер существует и получаем user_id
    const buyerCheck = await db.query(
      'SELECT id, name, user_id FROM team_buyers WHERE id = $1',
      [buyerId]
    );

    if (buyerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Баер не найден' });
    }

    const buyer = buyerCheck.rows[0];

    // НАЧИНАЕМ ТРАНЗАКЦИЮ для атомарного удаления
    await db.query('BEGIN');

    try {
      // 1. Снимаем назначение со всех карт баера
      await db.query('UPDATE cards SET buyer_id = NULL WHERE buyer_id = $1', [buyerId]);

      // 2. Удаляем баера из team_buyers
      await db.query('DELETE FROM team_buyers WHERE id = $1', [buyerId]);

      // 3. НОВОЕ: Удаляем связанного пользователя если есть
      if (buyer.user_id) {
        await db.query('DELETE FROM users WHERE id = $1', [buyer.user_id]);
        console.log(`Удален пользователь ID: ${buyer.user_id} для баера: ${buyer.name}`);
      }

      // Подтверждаем транзакцию
      await db.query('COMMIT');

      res.json({
        message: 'Баер успешно удален',
        deletedBuyer: buyer
      });

    } catch (error) {
      // Откатываем транзакцию при ошибке
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Ошибка удаления баера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});



// Получение статистики команды и баеров по периоду
router.get('/:teamId/stats', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const { startDate, endDate } = req.query;

    console.log('Stats request for team:', teamId);
    console.log('Date filter:', { startDate, endDate });

    // Получаем статичные данные баеров (баланс, количество карт)
    const buyersQuery = `
     SELECT 
       tb.id as buyer_id,
       tb.name as username,
       tb.telegram,
       COUNT(DISTINCT c.id) as cards_count,
       COALESCE(SUM(c.balance), 0) as total_balance
     FROM team_buyers tb
     LEFT JOIN cards c ON c.buyer_id = tb.id AND c.status != 'deleted'
     WHERE tb.team_id = $1
     GROUP BY tb.id, tb.name, tb.telegram
   `;

    const buyersResult = await db.query(buyersQuery, [teamId]);

    // Для каждого баера считаем spent_amount и topup_amount
    for (let buyer of buyersResult.rows) {
      const originalBalance = buyer.total_balance;
      const originalCardsCount = buyer.cards_count;

      let spentQuery, topupQuery, params;

      if (startDate && endDate) {
        const dateStart = convertUtcToKyivDate(startDate);
        const dateEnd = convertUtcToKyivDate(endDate);

        console.log('Date range for SQL:', { dateStart, dateEnd });

        // Проверяем разницу в часах
        const startUTC = new Date(startDate);
        const endUTC = new Date(endDate);
        const hoursDiff = (endUTC - startUTC) / (1000 * 60 * 60);

        if (hoursDiff < 25) { // Если меньше 25 часов - это один день
          params = [buyer.buyer_id, dateEnd];

          spentQuery = `
            SELECT COALESCE(SUM(ABS(ct.amount)), 0) as spent
            FROM card_transactions ct
            JOIN cards c ON ct.card_id = c.id
            WHERE c.buyer_id = $1 
              AND c.status != 'deleted'
              AND ct.transaction_type = 'expense'
              AND ct.transaction_date = $2::date
              AND ct.is_cancelled = false
              AND ct.description NOT LIKE '%омиссия%'
          `;

          topupQuery = `
            SELECT COALESCE(SUM(ct.amount), 0) as topup
            FROM card_transactions ct
            JOIN cards c ON ct.card_id = c.id
            WHERE c.buyer_id = $1 
              AND c.status != 'deleted'
              AND ct.transaction_type = 'topup'
              AND ct.transaction_date = $2::date
              AND ct.is_cancelled = false
          `;

          console.log('Single day query for buyer:', buyer.buyer_id, 'date:', dateEnd);
        } else {
          // ИСПРАВЛЕНИЕ: используем BETWEEN для диапазона дат
          params = [buyer.buyer_id, dateStart, dateEnd];

          spentQuery = `
            SELECT COALESCE(SUM(ABS(ct.amount)), 0) as spent
            FROM card_transactions ct
            JOIN cards c ON ct.card_id = c.id
            WHERE c.buyer_id = $1 
              AND c.status != 'deleted'
              AND ct.transaction_type = 'expense'
              AND ct.transaction_date BETWEEN $2::date AND $3::date
              AND ct.is_cancelled = false
              AND ct.description NOT LIKE '%омиссия%'
          `;

          topupQuery = `
            SELECT COALESCE(SUM(ct.amount), 0) as topup
            FROM card_transactions ct
            JOIN cards c ON ct.card_id = c.id
            WHERE c.buyer_id = $1 
              AND c.status != 'deleted'
              AND ct.transaction_type = 'topup'
              AND ct.transaction_date BETWEEN $2::date AND $3::date
              AND ct.is_cancelled = false
          `;

          console.log('Date range query for buyer:', buyer.buyer_id, 'with params:', params);
        }
      } else {
        // Без фильтра - общие суммы
        params = [buyer.buyer_id];

        spentQuery = `
         SELECT COALESCE(SUM(cards.total_spent_calculated), 0) as spent
         FROM cards WHERE cards.buyer_id = $1 AND cards.status != 'deleted'
       `;

        topupQuery = `
         SELECT COALESCE(SUM(cards.total_top_up), 0) as topup
         FROM cards WHERE cards.buyer_id = $1 AND cards.status != 'deleted'
       `;
      }

      const spentResult = await db.query(spentQuery, params);
      const topupResult = await db.query(topupQuery, params);

      // Устанавливаем spent/topup, сохраняя оригинальные статичные данные
      buyer.spent_amount = spentResult.rows[0].spent;
      buyer.topup_amount = topupResult.rows[0].topup;
      buyer.total_balance = originalBalance;
      buyer.cards_count = originalCardsCount;
    }

    const buyers = buyersResult.rows.map(buyer => ({
      ...buyer,
      filtered_spent: parseFloat(buyer.spent_amount || 0),
      filtered_topups: parseFloat(buyer.topup_amount || 0)
    }));

    res.json({ buyers });

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// Получение переносов карт для баера
router.get('/buyers/:buyerId/transfers', authenticateToken, async (req, res) => {
  try {
    const buyerId = req.params.buyerId;

    // Проверяем существование баера
    const buyerCheck = await db.query('SELECT * FROM team_buyers WHERE id = $1', [buyerId]);
    if (buyerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Баер не найден' });
    }

    // Получаем все переносы карт этого баера
    const transfersQuery = `
      SELECT 
        ct.*,
        t_old.name as old_team_name,
        t_new.name as new_team_name
      FROM card_transfers ct
      LEFT JOIN teams t_old ON ct.old_team_id = t_old.id
      LEFT JOIN teams t_new ON ct.new_team_id = t_new.id
      WHERE ct.old_buyer_id = $1
      ORDER BY ct.transfer_date DESC
    `;

    const result = await db.query(transfersQuery, [buyerId]);

    res.json({ transfers: result.rows });
  } catch (error) {
    console.error('Ошибка получения переносов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление записи о переносе карты
router.delete('/buyers/:buyerId/transfers/:transferId', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { buyerId, transferId } = req.params;

    // Проверяем существование баера
    const buyerCheck = await db.query('SELECT * FROM team_buyers WHERE id = $1', [buyerId]);
    if (buyerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Баер не найден' });
    }

    // Проверяем существование записи о переносе
    const transferCheck = await db.query('SELECT * FROM card_transfers WHERE id = $1 AND old_buyer_id = $2', [transferId, buyerId]);
    if (transferCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Запись о переносе не найдена' });
    }

    // Удаляем запись о переносе
    await db.query('DELETE FROM card_transfers WHERE id = $1', [transferId]);

    res.json({
      message: 'Запись о переносе карты удалена',
      transfer_id: transferId
    });

  } catch (error) {
    console.error('Ошибка удаления записи о переносе:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение статистики команды за период для формирования счета
router.get('/:id/billing-stats', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { startDate, endDate, currency = 'USD' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Не указаны даты периода' });
    }

    console.log('=== BILLING STATS DEBUG ===');
    console.log('Period:', startDate, 'to', endDate);
    console.log('Team ID:', teamId);

    // ИСПРАВЛЕННЫЙ запрос - получаем только карты с операциями за период
    const buyersQuery = `
      SELECT 
        tb.id as buyer_id,
        tb.name as buyer_name,
        COUNT(DISTINCT period_cards.card_id) as cards_count,
        COALESCE(SUM(period_cards.balance), 0) as total_balance,
        COALESCE(SUM(period_cards.spent_amount), 0) as total_spent,
        COALESCE(SUM(period_cards.topup_amount), 0) as total_topup,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', period_cards.card_id,
            'name', period_cards.card_name,
            'balance', period_cards.balance,
            'spent', period_cards.spent_amount,
            'topup', period_cards.topup_amount,
            'status', period_cards.status,
            'currency', period_cards.currency
          )
        ) as cards
      FROM team_buyers tb
      INNER JOIN (
        SELECT 
          c.id as card_id,
          c.name as card_name,
          c.buyer_id,
          c.balance,
          c.status,
          c.currency,
          COALESCE(t.spent_amount, 0) as spent_amount,
          COALESCE(t.topup_amount, 0) as topup_amount
        FROM cards c
        INNER JOIN (
          SELECT 
            card_id,
            SUM(CASE WHEN transaction_type = 'expense' AND is_cancelled = FALSE AND description NOT LIKE '%омиссия%' THEN ABS(amount) ELSE 0 END) as spent_amount,
            SUM(CASE WHEN transaction_type = 'topup' AND is_cancelled = FALSE THEN amount ELSE 0 END) as topup_amount
          FROM card_transactions 
          WHERE transaction_date >= $2::date AND transaction_date <= $3::date
          GROUP BY card_id
          HAVING SUM(CASE WHEN transaction_type = 'expense' AND is_cancelled = FALSE AND description NOT LIKE '%омиссия%' THEN ABS(amount) ELSE 0 END) > 0
              OR SUM(CASE WHEN transaction_type = 'topup' AND is_cancelled = FALSE THEN amount ELSE 0 END) > 0
        ) t ON c.id = t.card_id
        WHERE c.status != 'deleted'
      ) period_cards ON tb.id = period_cards.buyer_id
      WHERE tb.team_id = $1
      GROUP BY tb.id, tb.name
      HAVING COUNT(DISTINCT period_cards.card_id) > 0
      ORDER BY tb.name
    `;

    const result = await db.query(buyersQuery, [teamId, startDate, endDate]);

    console.log('=== SQL BILLING QUERY RESULT ===');
    console.log('Query result:', result.rows.length, 'buyers');
    result.rows.forEach((buyer, index) => {
      console.log(`SQL Buyer ${index + 1}: ${buyer.buyer_name}`);
      console.log(`- cards_count: ${buyer.cards_count}`);
      console.log(`- total_spent: ${buyer.total_spent}`);
      if (buyer.cards) {
        buyer.cards.forEach(card => {
          console.log(`  Card: ${card.name} spent: ${card.spent} ${card.currency}`);
        });
      }
    });

    // Подсчитываем общие цифры с актуальным курсом
    const currencyService = require('../utils/currencyService');
    const eurUsdRate = await currencyService.getEurToUsdRate();

    let totalBuyers = 0;
    let totalCards = 0;
    let totalAmount = 0;

    result.rows.forEach(buyer => {
      const cardsCount = parseInt(buyer.cards_count);
      if (cardsCount > 0) {
        totalBuyers++;
        totalCards += cardsCount;

        // Пересчитываем с учетом валют
        if (buyer.cards) {
          buyer.cards.forEach(card => {
            if (card && card.spent) {
              if (card.currency === 'EUR') {
                totalAmount += card.spent * eurUsdRate;
              } else {
                totalAmount += card.spent;
              }
            }
          });
        }
      }
    });

    console.log('Final totals:', { totalBuyers, totalCards, totalAmount, eurUsdRate });

    res.json({
      stats: {
        buyers_count: totalBuyers,
        cards_count: totalCards,
        total_amount: Math.round(totalAmount * 100) / 100,
        currency: currency
      },
      buyers: result.rows.map(buyer => ({
        buyer_id: buyer.buyer_id,
        buyer_name: buyer.buyer_name,
        cards_count: parseInt(buyer.cards_count),
        total_balance: parseFloat(buyer.total_balance),
        total_spent: parseFloat(buyer.total_spent),
        total_topup: parseFloat(buyer.total_topup),
        cards: buyer.cards || []
      }))
    });

  } catch (error) {
    console.error('Ошибка получения статистики для счета:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// Получение счетов команды за период
router.get('/:id/bills', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT b.*, c.name as client_name 
      FROM bills b
      JOIN clients c ON b.client_id = c.id
      WHERE b.team_id = $1
    `;
    const params = [teamId];

    if (startDate && endDate) {
      query += ` AND b.period_from <= $2 AND b.period_to >= $3`;
      params.push(endDate, startDate);
    }

    query += ` ORDER BY b.created_at DESC`;

    const result = await db.query(query, params);
    res.json({ bills: result.rows });
  } catch (error) {
    console.error('Ошибка получения счетов команды:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/currency/eur-usd', authenticateToken, async (req, res) => {
  try {
    const rate = await currencyService.getEurToUsdRate();

    res.json({
      rate: rate,
      timestamp: new Date().toISOString(),
      source: rate === 1.03 ? 'fallback' : 'api'
    });
  } catch (error) {
    console.error('Ошибка получения курса валют:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      rate: 1.03 // запасной курс
    });
  }
});
router.get('/buyers/:buyerId/credentials', authenticateToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const buyerId = req.params.buyerId;

    const query = `
      SELECT 
        tb.name as buyer_name,
        tb.telegram,
        t.name as team_name,
        u.username as login,
        u.plain_password as password,
        u.created_at
      FROM team_buyers tb
      JOIN users u ON tb.user_id = u.id
      JOIN teams t ON tb.team_id = t.id
      WHERE tb.id = $1
    `;

    const result = await db.query(query, [buyerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Баер не найден или не имеет учетной записи' });
    }

    const buyerData = result.rows[0];

    res.json({
      login: buyerData.login,
      password: buyerData.password,
      team_name: buyerData.team_name,
      buyer_name: buyerData.buyer_name,
      created_at: buyerData.created_at
    });

  } catch (error) {
    console.error('Ошибка получения учетных данных:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;