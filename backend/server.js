const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::]:8080'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP
});
app.use(limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Подключение роутов
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const expenseRoutes = require('./routes/expenses');

// Использование роутов
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/expenses', expenseRoutes);

// Тестовый роут
app.get('/api/test', (req, res) => {
  res.json({ message: 'CRM Server работает!' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});