// Модуль детальной страницы баера
class BuyerDetailModule {
    constructor(buyerId, teamId) {
        this.buyerId = buyerId;
        this.teamId = teamId;
        this.buyer = null;
        this.allCards = [];
        this.buyerCards = [];
        this.filteredStats = null;

        this.init();
    }

    async init() {
        try {
            await this.loadBuyer();
            await this.loadCards();
            this.setupEventListeners();
            this.fillBuyerInfo();
            this.renderCards();
            await this.loadStats();
        } catch (error) {
            console.error('Ошибка инициализации страницы баера:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные баера');
        }
    }

    async loadBuyer() {
        try {
            const response = await api.request(`/teams/${this.teamId}/buyers`);
            this.buyer = response.buyers.find(b => b.id == this.buyerId);

            if (!this.buyer) {
                console.error('Buyer not found. Available buyers:', response.buyers);
                console.error('Looking for buyerId:', this.buyerId);
                throw new Error('Баер не найден');
            }
        } catch (error) {
            console.error('Ошибка загрузки данных баера:', error);
            throw error;
        }
    }

    async loadCards() {
        try {
            // Загружаем все карты через основной API карт
            const allCardsResponse = await api.getCards();
            // Фильтруем карты по команде
            this.allCards = allCardsResponse.cards.filter(card => card.team_id == this.teamId);

            // Фильтруем карты баера
            this.buyerCards = this.allCards.filter(card => card.buyer_id == this.buyerId);

        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            throw error;
        }
    }

    async loadStats(startDate = null, endDate = null) {
        try {
            let url = `/teams/${this.teamId}/stats`;
            const params = new URLSearchParams();

            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await api.request(url);
            const buyerStats = response.buyers.find(b => b.buyer_id == this.buyerId);

            if (buyerStats) {
                this.filteredStats = buyerStats;
                this.updateStatsDisplay();
            }

        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            // Показываем базовую статистику из данных баера
            this.updateStatsDisplay();
        }
    }

    setupTelegramLink() {
        const telegramLink = document.getElementById('buyer-telegram-link');
        if (telegramLink) {
            telegramLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.buyer && this.buyer.telegram) {
                    let telegramUrl = this.buyer.telegram;

                    // Если это username (@username), создаем ссылку
                    if (telegramUrl.startsWith('@')) {
                        telegramUrl = `https://t.me/${telegramUrl.substring(1)}`;
                    }
                    // Если это уже ссылка, используем как есть
                    else if (!telegramUrl.startsWith('http')) {
                        telegramUrl = `https://t.me/${telegramUrl}`;
                    }

                    window.open(telegramUrl, '_blank');
                }
            });
        }
    }

    fillBuyerInfo() {
        if (!this.buyer) return;

        document.getElementById('buyer-name').textContent = this.buyer.username || 'Неизвестный баер';

        const telegramElement = document.getElementById('buyer-telegram');
        const telegramLink = document.getElementById('buyer-telegram-link');

        if (this.buyer.telegram) {
            telegramElement.textContent = this.buyer.telegram;
            telegramLink.style.display = 'flex';
        } else {
            telegramLink.style.display = 'none';
        }
    }

    updateStatsDisplay() {
        const stats = this.filteredStats || this.buyer;

        // Обновляем значения статистики
        const formatCurrency = (amount) => {
            const num = parseFloat(amount) || 0;
            return num.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        };

        document.getElementById('total-balance').textContent = formatCurrency(stats.total_balance);
        document.getElementById('total-spent').textContent = formatCurrency(stats.spent_amount || 0);
        document.getElementById('total-topup').textContent = formatCurrency(stats.topup_amount || 0);
        document.getElementById('cards-count').textContent = this.buyerCards.length;
        document.getElementById('assigned-cards-count').textContent = this.buyerCards.length;
    }

    renderCards() {
        const grid = document.getElementById('buyer-cards-grid');
        const noCardsState = document.getElementById('no-cards-state');

        if (this.buyerCards.length === 0) {
            grid.style.display = 'none';
            noCardsState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        noCardsState.style.display = 'none';

        const formatCurrency = (amount) => {
            const num = parseFloat(amount) || 0;
            return num.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        };

        const getStatusText = (status) => {
            const statuses = {
                'active': 'Активна',
                'blocked': 'Заблокирована',
                'limit_exceeded': 'Превышен лимит',
                'deleted': 'Удалена'
            };
            return statuses[status] || status;
        };

        grid.innerHTML = this.buyerCards.map(card => `
        <div class="buyer-card-item assigned">
            <div class="card-header">
                <div class="card-name">
                    <span onclick="window.open('#card/${card.id}', '_blank');" 
                        style="color: var(--primary-color); cursor: pointer; text-decoration: underline;">
                        ${this.escapeHtml(card.name)}
                    </span>
                </div>
                <button class="card-remove-btn" onclick="window.buyerDetailModule.removeCardFromBuyer(${card.id})">
                    <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                        <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3.1-3.6-7.6-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3.1 3.6 7.6 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
                    </svg>
                </button>
            </div>
            <div class="card-details">
                <div class="card-detail">
                    <span class="card-detail-label">Баланс:</span>
                    <span class="card-detail-value">${formatCurrency(card.balance)}</span>
                </div>
                <div class="card-detail">
                    <span class="card-detail-label">Валюта:</span>
                    <span class="card-detail-value">${card.currency || 'USD'}</span>
                </div>
                <div class="card-detail">
                    <span class="card-detail-label">Скручено:</span>
                    <span class="card-detail-value">${formatCurrency(card.total_spent_calculated || 0)}</span>
                </div>
                <div class="card-detail">
                    <span class="card-detail-label">Пополнено:</span>
                    <span class="card-detail-value">${formatCurrency(card.total_top_up || 0)}</span>
                </div>
                <div class="card-detail">
                    <span class="card-detail-label">Статус:</span>
                    <span class="card-status ${card.status}">${getStatusText(card.status)}</span>
                </div>
                <div class="card-detail">
                    <span class="card-detail-label">Создана:</span>
                    <span class="card-detail-value">${new Date(card.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
            </div>
        </div>
    `).join('');
    }

    setupEventListeners() {
        // Кнопка "Назад к команде"
        document.getElementById('back-to-team').addEventListener('click', () => {
            this.goBackToTeam();
        });


        // Кнопка "Добавить карты"
        document.getElementById('add-cards-btn').addEventListener('click', () => {
            this.openManageCardsModal();
        });

        // Фильтр по периоду
        const periodSelect = document.getElementById('date-period-select');
        periodSelect.addEventListener('change', (e) => {
            this.handlePeriodChange(e.target.value);
        });

        // Автоматическое применение при выборе дат
        document.getElementById('date-from').addEventListener('change', () => {
            this.applyCustomDateFilter();
        });

        document.getElementById('date-to').addEventListener('change', () => {
            this.applyCustomDateFilter();
        });

        // Обработчики модального окна
        this.setupModalEvents();

        // Обработчик для Telegram ссылки
        this.setupTelegramLink();
    }

    handlePeriodChange(period) {
        if (period === 'custom') {
            // Для кастомного периода не делаем ничего - пользователь сам выберет даты
            return;
        } else {
            // Для предустановленных периодов сразу применяем фильтр
            this.applyPeriodFilter(period);
        }
    }

    applyPeriodFilter(period) {
        let startDate = null;
        let endDate = null;
        const now = new Date();

        switch (period) {
            case 'today':
                startDate = now.toISOString().split('T')[0];
                endDate = startDate;
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = yesterday.toISOString().split('T')[0];
                endDate = startDate;
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = weekAgo.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setDate(monthAgo.getDate() - 30);
                startDate = monthAgo.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
                break;
            case '':
                // Все время - сбрасываем фильтр
                startDate = '';
                endDate = '';
                break;
        }

        // ДОБАВЬ ЭТИ СТРОКИ:
        document.getElementById('date-from').value = startDate || '';
        document.getElementById('date-to').value = endDate || '';

        this.loadStats(startDate, endDate);
    }

    applyCustomDateFilter() {
        const startDate = document.getElementById('date-from').value;
        const endDate = document.getElementById('date-to').value;

        if (!startDate || !endDate) {
            notifications.error('Ошибка', 'Укажите обе даты');
            return;
        }

        if (startDate > endDate) {
            notifications.error('Ошибка', 'Дата начала не может быть больше даты окончания');
            return;
        }

        this.loadStats(startDate, endDate);
    }

    openManageCardsModal() {
        const modal = document.getElementById('manage-cards-modal');
        this.renderAllCardsInModal();
        modal.classList.add('show');
    }

    renderAllCardsInModal() {
        const cardsList = document.getElementById('all-cards-list');

        const formatCurrency = (amount) => {
            const num = parseFloat(amount) || 0;
            return num.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        };

        if (this.allCards.length === 0) {
            cardsList.innerHTML = `
            <div class="cards-empty-state">
                <h4>Нет карт в команде</h4>
                <p>В этой команде еще нет созданных карт</p>
            </div>
        `;
            return;
        }

        const cardsHtml = this.allCards.map(card => {
            const isAssignedToBuyer = card.buyer_id == this.buyerId;
            const isAssignedToOther = card.buyer_id && card.buyer_id != this.buyerId;

            return `
            <div class="card-item-checkbox ${isAssignedToBuyer ? 'assigned-current' : ''} ${isAssignedToOther ? 'assigned-other' : ''}">
                <input type="checkbox" 
                       value="${card.id}" 
                       name="selected-cards" 
                       ${isAssignedToBuyer ? 'checked' : ''} 
                       ${isAssignedToOther ? 'disabled' : ''}>
                <div class="card-info">
                    <div class="card-name">${this.escapeHtml(card.name)}</div>
                    <div class="card-details">
                        ${card.currency || 'USD'} • Баланс: ${formatCurrency(card.balance)} • 
                        Скручено: ${formatCurrency(card.total_spent_calculated || 0)} • 
                        Пополнено: ${formatCurrency(card.total_top_up || 0)} • 
                        Статус: ${this.getStatusText(card.status)}
                        ${isAssignedToBuyer ? ' • <span class="assigned-badge">Назначена</span>' : ''}
                        ${isAssignedToOther ? ' • <span class="other-badge">Занята</span>' : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');

        cardsList.innerHTML = cardsHtml;

        // Добавляем обработчики кликов по карточкам
        cardsList.addEventListener('click', (e) => {
            const cardItem = e.target.closest('.card-item-checkbox');
            if (cardItem && !cardItem.classList.contains('assigned-other')) {
                const checkbox = cardItem.querySelector('input[type="checkbox"]');
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                cardItem.classList.toggle('assigned-current', checkbox.checked);
            }
        });
    }
    setupModalEvents() {
        const modal = document.getElementById('manage-cards-modal');

        // Закрытие модального окна
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('show');
        });

        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            modal.classList.remove('show');
        });

        // Сохранение назначений карт
        document.getElementById('save-card-assignments').addEventListener('click', async () => {
            await this.saveCardAssignments();
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
    async saveCardAssignments() {
        try {
            const checkboxes = document.querySelectorAll('#all-cards-list input[name="selected-cards"]');
            console.log('Total checkboxes found:', checkboxes.length);

            const selectedCardIds = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value));

            console.log('Selected card IDs:', selectedCardIds);

            const currentAssignedIds = this.buyerCards.map(card => card.id);
            console.log('Currently assigned IDs:', currentAssignedIds);

            // Определяем какие карты нужно назначить, а какие снять
            const toAssign = selectedCardIds.filter(id => !currentAssignedIds.includes(id));
            const toUnassign = currentAssignedIds.filter(id => !selectedCardIds.includes(id));

            console.log('Cards to assign:', toAssign);
            console.log('Cards to unassign:', toUnassign);

            // Выполняем назначения
            for (const cardId of toAssign) {
                console.log('Assigning card:', cardId);
                await api.request(`/cards/${cardId}/assign`, {
                    method: 'PUT',
                    body: JSON.stringify({ buyer_id: this.buyerId })
                });
            }

            // Выполняем снятие назначений
            for (const cardId of toUnassign) {
                console.log('Unassigning card:', cardId);
                await api.request(`/cards/${cardId}/assign`, {
                    method: 'PUT',
                    body: JSON.stringify({ buyer_id: null })
                });
            }

            // Обновляем данные
            await this.loadCards();
            await this.loadStats();
            this.renderCards();
            this.updateStatsDisplay();

            // Обновляем содержимое модального окна с новыми данными
            this.renderAllCardsInModal();

            // Закрываем модальное окно
            document.getElementById('manage-cards-modal').classList.remove('show');

            notifications.success('Успех', 'Назначения карт обновлены');

        } catch (error) {
            console.error('Ошибка сохранения назначений:', error);
            notifications.error('Ошибка', 'Не удалось сохранить изменения');
        }
    }

    goBackToTeam() {
        // Очищаем детали баера
        localStorage.removeItem('current_buyer_detail');

        // Возвращаемся к модулю teams, который автоматически загрузит team-detail
        if (window.app) {
            window.app.loadModule('teams');
        }
    }
    getStatusText(status) {
        const statusMap = {
            'active': 'Активна',
            'blocked': 'Заблокирована',
            'reissue': 'Перевыпуск',
            'error': 'Ошибка',
            'rebind': 'Переподвязать',
            'not_issued': 'Не выдана',
            'not_spinning': 'Не крутит',
            'limit_exceeded': 'Превышен лимит'
        };
        return statusMap[status] || status;
    }

    // Простая защита от XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async removeCardFromBuyer(cardId) {
        try {
            const card = this.buyerCards.find(c => c.id === cardId);
            if (!card) return;

            const confirmed = await window.confirmDelete(`Убрать карту "${card.name}" у баера?`);
            if (!confirmed) return;

            // Снимаем назначение карты
            await api.request(`/cards/${cardId}/assign`, {
                method: 'PUT',
                body: JSON.stringify({ buyer_id: null })
            });

            // Обновляем данные
            await this.loadCards();
            await this.loadStats();
            this.renderCards();
            this.updateStatsDisplay();

            notifications.success('Успех', 'Карта убрана у баера');

        } catch (error) {
            console.error('Ошибка удаления карты у баера:', error);
            notifications.error('Ошибка', 'Не удалось убрать карту');
        }
    }
}

// Экспорт для глобального использования
window.BuyerDetailModule = BuyerDetailModule;