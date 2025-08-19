const fs = require('fs');
const path = require('path');

// Проверка безопасности всего приложения
const runSecurityCheck = () => {
  console.log('\n🔒 ПРОВЕРКА БЕЗОПАСНОСТИ CRM СИСТЕМЫ\n');
  
  const checks = [];
  
  // 1. Проверка .env файла
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('JWT_SECRET=') && !envContent.includes('your_super_secret')) {
      checks.push('✅ JWT_SECRET установлен');
    } else {
      checks.push('❌ JWT_SECRET не настроен безопасно');
    }
    
    if (envContent.includes('BCRYPT_ROUNDS=12')) {
      checks.push('✅ BCRYPT_ROUNDS настроен правильно');
    } else {
      checks.push('❌ BCRYPT_ROUNDS не настроен');
    }
  } else {
    checks.push('❌ .env файл не найден');
  }
  
  // 2. Проверка папки логов
  const logsDir = path.join(__dirname, 'logs');
  if (fs.existsSync(logsDir)) {
    checks.push('✅ Папка логов создана');
  } else {
    checks.push('❌ Папка логов отсутствует');
  }
  
  // 3. Проверка middleware файлов
  const middlewareFiles = ['validation.js', 'security.js', 'logger.js'];
  middlewareFiles.forEach(file => {
    const filePath = path.join(__dirname, 'middleware', file);
    if (fs.existsSync(filePath)) {
      checks.push(`✅ ${file} установлен`);
    } else {
      checks.push(`❌ ${file} отсутствует`);
    }
  });
  
  console.log(checks.join('\n'));
  console.log('\n🛡️ Проверка безопасности завершена\n');
};

runSecurityCheck();