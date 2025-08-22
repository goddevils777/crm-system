const bcrypt = require('bcryptjs');
const db = require('../models/database');

async function createAdminUser() {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminPassword) {
            console.log('⚠️ ADMIN_PASSWORD не установлен в .env файле');
            return;
        }

        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

        // Проверяем существует ли admin
        const existingAdmin = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
        
        if (existingAdmin.rows.length > 0) {
            // Обновляем пароль существующего admin
            await db.query(
                'UPDATE users SET password_hash = $1 WHERE username = $2',
                [passwordHash, 'admin']
            );
            console.log('✅ Пароль admin обновлен');
        } else {
            // Создаем нового admin
            await db.query(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['admin', 'admin@system.local', passwordHash, 'admin']
            );
            console.log('✅ Пользователь admin создан');
        }

        console.log(`   Логин: admin`);
        console.log(`   Пароль: ${adminPassword}`);
        
    } catch (error) {
        console.error('❌ Ошибка создания/обновления admin:', error);
    }
}

module.exports = { createAdminUser };