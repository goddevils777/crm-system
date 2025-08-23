// API клиент для работы с backend
class API {
    constructor() {
        // Принудительно перечитываем конфигурацию
        this.baseURL = window.APP_CONFIG?.API_URL || 'http://localhost:3000/api';
        this.token = localStorage.getItem('authToken');
        console.log('🔌 API Client initialized with URL:', this.baseURL);
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
            'ngrok-skip-browser-warning': 'true',  // ДОБАВЬ ЭТУ СТРОКУ
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

    // Методы для баеров команды
    async getBuyers(teamId) {
        return this.request(`/teams/${teamId}/buyers`);
    }

    async deleteBuyer(buyerId) {
        return this.request(`/teams/buyers/${buyerId}`, {
            method: 'DELETE'
        });
    }
    async createBuyer(teamId, buyerData) {
        return this.request(`/teams/${teamId}/buyers`, {
            method: 'POST',
            body: JSON.stringify(buyerData)
        });
    }

    // Методы для назначения карт баерам
    async assignCardToBuyer(cardId, buyerId) {
        return this.request(`/cards/${cardId}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ buyer_id: buyerId })
        });
    }

    async getAvailableCards(teamId) {
        return this.request(`/cards?team_id=${teamId}&unassigned=true`);
    }


    // Методы для назначения карт баерам
    async assignCardToBuyer(cardId, buyerId) {
        return this.request(`/cards/${cardId}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ buyer_id: buyerId })
        });
    }

    async getAvailableCards(teamId) {
        return this.request(`/cards?team_id=${teamId}&unassigned=true`);
    }
    
    // Методы для статистики команды
    async getTeamStats(teamId, startDate = null, endDate = null) {
        let url = `/teams/${teamId}/stats`;
        if (startDate && endDate) {
            url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
        }
        return this.request(url);
    }
}

// Создание глобального экземпляра API
const api = new API();