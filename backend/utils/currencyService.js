// СОЗДАТЬ новый файл: backend/services/currencyService.js

const axios = require('axios');

class CurrencyService {
    constructor() {
        // Используем exchangerate-api.com - полностью бесплатный до 1500 запросов/месяц
        this.baseUrl = 'https://api.exchangerate-api.com/v4/latest';
        this.fallbackRate = 1.03; // Запасной курс если API недоступен
        this.cache = new Map();
        this.cacheExpiry = 60 * 60 * 1000; // 1 час
    }

    async getEurToUsdRate() {
        const cacheKey = 'EUR_USD';
        const now = Date.now();
        
        // Проверяем кеш
        const cached = this.cache.get(cacheKey);
        if (cached && now - cached.timestamp < this.cacheExpiry) {
            console.log('Используем кешированный курс EUR/USD:', cached.rate);
            return cached.rate;
        }

        try {
            console.log('Загружаем курс EUR/USD с API...');
            
            const response = await axios.get(`${this.baseUrl}/EUR`, {
                timeout: 5000 // 5 секунд таймаут
            });

            const rate = response.data.rates.USD;
            
            if (!rate || isNaN(rate)) {
                throw new Error('Некорректный курс валют');
            }

            // Сохраняем в кеш
            this.cache.set(cacheKey, {
                rate: rate,
                timestamp: now
            });

            console.log('Получен актуальный курс EUR/USD:', rate);
            return rate;

        } catch (error) {
            console.warn('Ошибка получения курса валют:', error.message);
            console.warn('Используем запасной курс:', this.fallbackRate);
            
            // Возвращаем запасной курс
            return this.fallbackRate;
        }
    }

    async getAllRates(baseCurrency = 'USD') {
        const cacheKey = `ALL_${baseCurrency}`;
        const now = Date.now();
        
        const cached = this.cache.get(cacheKey);
        if (cached && now - cached.timestamp < this.cacheExpiry) {
            return cached.rates;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/${baseCurrency}`, {
                timeout: 5000
            });

            const rates = response.data.rates;
            
            this.cache.set(cacheKey, {
                rates: rates,
                timestamp: now
            });

            return rates;

        } catch (error) {
            console.warn('Ошибка получения курсов валют:', error.message);
            
            // Возвращаем базовые курсы
            return {
                USD: 1,
                EUR: baseCurrency === 'USD' ? (1 / this.fallbackRate) : this.fallbackRate,
            };
        }
    }
}

module.exports = new CurrencyService();