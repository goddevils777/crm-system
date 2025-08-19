const rateLimit = require('express-rate-limit');

// Строгий rate limiting для авторизации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток логина
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Валидация входящих данных
const validateCardData = (req, res, next) => {
  const { name, currency } = req.body;
  
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Некорректное название карты' });
  }
  
  if (currency && !['USD', 'EUR', 'UAH'].includes(currency)) {
    return res.status(400).json({ error: 'Недопустимая валюта' });
  }
  
  // Экранирование HTML для защиты от XSS
  req.body.name = name.replace(/[<>]/g, '');
  
  next();
};

// ДОБАВЬ ЭТУ НОВУЮ ФУНКЦИЮ:
// Валидация финансовых операций
const validateFinancialData = (req, res, next) => {
  const { balance, topup_amount } = req.body;
  
  // Проверка на числовые значения
  if (balance !== undefined) {
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum) || balanceNum < 0 || balanceNum > 1000000) {
      return res.status(400).json({ error: 'Некорректный баланс' });
    }
  }
  
  if (topup_amount !== undefined) {
    const topupNum = parseFloat(topup_amount);
    if (isNaN(topupNum) || topupNum < 0 || topupNum > 100000) {
      return res.status(400).json({ error: 'Некорректная сумма пополнения' });
    }
  }
  
  next();
};

module.exports = { authLimiter, validateCardData, validateFinancialData };