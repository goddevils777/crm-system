const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/validation');

const router = express.Router();

// Применяем rate limiting к роутам авторизации
router.use('/login', authLimiter); // ДОБАВЬ ЭТУ СТРОКУ
router.use('/register', authLimiter); // ДОБАВЬ ЭТУ СТРОКУ

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'buyer', team_id } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверка существующего пользователя
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // Хеширование пароля
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создание пользователя
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash, role, team_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role',
      [username, email, passwordHash, role, team_id]
    );

    res.status(201).json({
      message: 'Пользователь создан успешно',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Логин пользователя
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    // Поиск пользователя
    const result = await db.query(
      'SELECT id, username, email, password_hash, role, team_id FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const user = result.rows[0];

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Создание JWT токена
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      message: 'Авторизация успешна',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        team_id: user.team_id
      }
    });
  } catch (error) {
    console.error('Ошибка логина:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение информации о баере для текущего пользователя
router.get('/buyer-info', authenticateToken, async (req, res) => {
  try {
    // Проверяем что пользователь - баер
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ error: 'Доступ только для баеров' });
    }

    // Ищем запись баера по user_id
    const result = await db.query(
      'SELECT id, name, telegram, team_id FROM team_buyers WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Информация о баере не найдена' });
    }

    const buyer = result.rows[0];

    res.json({
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      telegram: buyer.telegram,
      team_id: buyer.team_id
    });

  } catch (error) {
    console.error('Ошибка получения информации о баере:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;