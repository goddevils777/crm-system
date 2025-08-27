const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const db = require('./models/database');
const { validateJWTSecret } = require('./middleware/security');
const { securityLogger } = require('./middleware/logger');

validateJWTSecret(); // ДОБАВЬ ЭТУ СТРОКУ

const app = express();

// app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

// Безопасность - ЗАМЕНИ СУЩЕСТВУЮЩУЮ СТРОКУ app.use(helmet());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // ДОБАВЬ 'unsafe-inline'
      scriptSrcAttr: ["'unsafe-inline'"], // ДОБАВЬ эту строку
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS с дополнительной защитой - ЗАМЕНИ СУЩЕСТВУЮЩИЕ НАСТРОЙКИ CORS
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:8000',    // ДОБАВЬ для тестирования
      'http://127.0.0.1:8000',    // ДОБАВЬ для тестирования  
      'http://[::]:8080',
      'http://[::]:8000',         // ДОБАВЬ для тестирования
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Разрешаем все ngrok домены
    if (!origin || allowedOrigins.includes(origin) ||
      (origin && origin.includes('.ngrok.io')) ||
      (origin && origin.includes('.ngrok-free.app')) ||
      origin.startsWith('file://')) {  // ДОБАВЬ эту строку
      callback(null, true);
    } else {
      callback(new Error('Запрещено CORS политикой'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

app.use(securityLogger);

// Rate limiting

// const limiter = rateLimit({
//  windowMs: 15 * 60 * 1000, // 15 минут
//  max: 500 // УВЕЛИЧЬ с 100 до 500 запросов
// });
// app.use(limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Подключение роутов
const { createAdminUser } = require('./utils/createAdmin');
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const expenseRoutes = require('./routes/expenses');
const teamRoutes = require('./routes/teams');
const clientsRoutes = require('./routes/clients');


app.use(express.static(path.join(__dirname, '../frontend')));


// Использование роутов
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/clients', clientsRoutes);

// Тестовый роут
app.get('/api/test', (req, res) => {
  res.json({ message: 'CRM Server работает!' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

createAdminUser();

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});