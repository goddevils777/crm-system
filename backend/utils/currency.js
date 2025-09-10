const axios = require('axios');

class CurrencyService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 3600000; // 1 час
    }

    async getExchangeRate(fromCurrency, toCurrency = 'USD') {
        if (fromCurrency === toCurrency) return 1.0;

        const cacheKey = `${fromCurrency}-${toCurrency}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.rate;
        }

        try {
            // Используй свой API для курсов
            const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
            const rate = response.data.rates[toCurrency];
            
            // Кешируем результат
            this.cache.set(cacheKey, {
                rate,
                timestamp: Date.now()
            });

            return rate;
        } catch (error) {
            console.error('Ошибка получения курса валют:', error);
            // Возвращаем примерные курсы как fallback
            const fallbackRates = {
                'UAH-USD': 0.024,
                'EUR-USD': 1.08
            };
            return fallbackRates[cacheKey] || 1.0;
        }
    }

    async convertToUSD(amount, fromCurrency) {
        const rate = await this.getExchangeRate(fromCurrency, 'USD');
        return {
            amountUSD: amount * rate,
            exchangeRate: rate
        };
    }
}

module.exports = new CurrencyService();