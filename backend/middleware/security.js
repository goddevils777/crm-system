const crypto = require('crypto');

// Проверка безопасности JWT секрета
const validateJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('❌ JWT_SECRET не установлен в переменных окружения');
    process.exit(1);
  }
  
  if (secret.length < 32) {
    console.error('❌ JWT_SECRET слишком короткий. Минимум 32 символа');
    process.exit(1);
  }
  
  if (secret === 'your-secret-key' || secret === 'secret') {
    console.error('❌ JWT_SECRET использует стандартное значение. Установите уникальный ключ');
    process.exit(1);
  }
  
  console.log('✅ JWT_SECRET прошел проверку безопасности');
};

// Генерация безопасного JWT секрета (для разработки)
const generateSecureSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

module.exports = { validateJWTSecret, generateSecureSecret };