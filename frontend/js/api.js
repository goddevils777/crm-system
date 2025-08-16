// API клиент для работы с backend
class API {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.token = localStorage.getItem('authToken');
    }

    // Установка токена
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Удаление токена
    removeToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    // Базовый метод для запросов
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка запроса');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Методы авторизации
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    // Методы для карт
    async getCards() {
        return this.request('/cards');
    }

    async createCard(cardData) {
        return this.request('/cards', {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
    }
    async deleteCard(cardId) {
        return this.request(`/cards/${cardId}`, {
            method: 'DELETE'
        });
    }
}

// Создание глобального экземпляра API
const api = new API();