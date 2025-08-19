const fs = require('fs');
const path = require('path');

// Создаем папку для логов если её нет
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Логирование подозрительной активности
const securityLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Логируем попытки входа
    // Логируем попытки входа
    if (req.path === '/api/auth/login' && req.method === 'POST') {
        const username = req.body && req.body.username ? req.body.username : 'unknown'; // ЗАМЕНИ ЭТУ СТРОКУ
        const logEntry = `${timestamp} | LOGIN_ATTEMPT | IP: ${ip} | UA: ${userAgent} | User: ${username}\n`;
        fs.appendFileSync(path.join(logsDir, 'security.log'), logEntry);
    }

    // Логируем подозрительные запросы
    const suspiciousPatterns = [
        /script/i, /alert/i, /javascript/i, /eval/i,
        /union/i, /select/i, /drop/i, /delete/i,
        /'|"|<|>/
    ];

    const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(queryString));

    if (isSuspicious) {
        const logEntry = `${timestamp} | SUSPICIOUS | IP: ${ip} | Path: ${req.path} | Data: ${queryString}\n`;
        fs.appendFileSync(path.join(logsDir, 'security.log'), logEntry);
    }

    next();
};

module.exports = { securityLogger };