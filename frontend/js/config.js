// Конфигурация приложения
window.APP_CONFIG = {
    // Автоопределение API URL
    API_URL: (() => {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        console.log('🌐 Current hostname:', hostname);
        console.log('🌐 Current protocol:', protocol);

        // Если это localhost - используем локальный API
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.includes('::')) {
            return 'http://localhost:3000/api';
        }

        // Если это ngrok домен - используем тот же домен для API
        if (hostname.includes('.ngrok.io') || hostname.includes('.ngrok-free.app')) {
            return `${protocol}//${hostname}/api`;
        }

        // Для продакшена
        return 'https://7641d64bfc84.ngrok-free.app/api';
    })(),

    // Другие настройки
    VERSION: '1.0.0',
    DEBUG: window.location.hostname === 'localhost'
};

console.log('🔧 API Configuration:', window.APP_CONFIG.API_URL);