// Модуль детальной страницы баера
class BuyerDetailModule {
    constructor(buyerId, teamId) {
        this.buyerId = buyerId;
        this.teamId = teamId;
        this.buyer = null;
        this.allCards = [];
        this.buyerCards = [];
        this.currentDateFilter = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadBuyer();
        await this.loadCards();
        this.updateAnalytics();
    }

    setupEventListeners() {
        // Фильтр по датам
        this.setupDateFilter();
        
        // Модальное окно карт
        this.setupCardsModal();
    }

    setupDateFilter() {
        const periodSelect = document.getElementById('buyer-date-period-select');
        const dateFrom = document.getElementById('buyer-date-from');
        const dateTo = document.getElementById('buyer-date-to');

        periodSelect.addEventListener('change', (e) => {
            const period = e.target.value;
            if (period && period !== 'custom') {
                dateFrom.value = '';
                dateTo.value = '';
                this.applyDateFilter(period);
            } else if (!period) {
                dateFrom.value = '';
                dateTo.value = '';
                this.clearDateFilter();
            }
        });

        dateFrom.addEventListener('change', () => {
            if (dateFrom.value) {
                periodSelect.value = 'custom';
                this.applyCustomDateFilter();
            }
        });

        dateTo.addEventListener('change', () => {
            if (dateTo.value) {
                periodSelect.value = 'custom';
                this.applyCustomDateFilter();
            }
        });
    }

setupCardsModal() {
    const modal = document.getElementById('buyer-cards-modal');
    const closeBtn = modal?.querySelector('.buyer-detail-modal-close');
    const cancelBtn = modal?.querySelector('.modal-cancel');
    const assignBtn = document.getElementById('buyer-assign-selected-cards');

    if (closeBtn) closeBtn.onclick = () => this.closeCardsModal();
    if (cancelBtn) cancelBtn.onclick = () => this.closeCardsModal();
    if (assignBtn) assignBtn.onclick = () => this.handleAssignCards();

    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) this.closeCardsModal();
        };
    }
}

    applyDateFilter(period) {
        const { startDate, endDate } = this.getPeriodDates(period);
        this.currentDateFilter = { startDate, endDate, period };
        this.updateAnalytics();
    }

    applyCustomDateFilter() {
        const dateFrom = document.getElementById('buyer-date-from').value;
        const dateTo = document.getElementById('buyer-date-to').value;

        if (dateFrom && dateTo) {
            this.currentDateFilter = {
                startDate: new Date(dateFrom),
                endDate: new Date(dateTo + 'T23:59:59'),
                period: 'custom'
            };
            this.updateAnalytics();
        }
    }

    clearDateFilter() {
        this.currentDateFilter = null;
        this.updateAnalytics();
    }

    getPeriodDates(period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
                return { startDate: today, endDate: todayEnd };
            case 'yesterday':
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
                return { startDate: yesterday, endDate: yesterdayEnd };
            case 'week':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                return { startDate: weekAgo, endDate: new Date() };
            case 'month':
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                return { startDate: monthAgo, endDate: new Date() };
            default:
                return { startDate: null, endDate: null };
        }
    }

    async loadBuyer() {
        try {
            const response = await api.request(`/teams/${this.teamId}/buyers`);
            this.buyer = response.buyers.find(b => b.id === this.buyerId);
            
            if (!this.buyer) {
                notifications.error('Ошибка', 'Баер не найден');
                this.goBack();
                return;
            }

            this.updateBuyerHeader();
        } catch (error) {
            console.error('Ошибка загрузки баера:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные баера');
        }
    }

    async loadCards() {
        try {
            const response = await api.request(`/cards?team_id=${this.teamId}`);
            this.allCards = response.cards || [];
            this.buyerCards = this.allCards.filter(card => card.buyer_id === this.buyerId);
            this.renderBuyerCards();
        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            notifications.error('Ошибка', 'Не удалось загрузить список карт');
        }
    }

    updateBuyerHeader() {
        if (!this.buyer) return;

        document.getElementById('buyer-name').textContent = this.buyer.username;
        
        const telegramHandle = this.buyer.telegram.startsWith('@') ? 
            this.buyer.telegram : `@${this.buyer.telegram}`;
        
        document.getElementById('buyer-telegram').innerHTML = `
            <a href="https://t.me/${telegramHandle.replace('@', '')}" target="_blank" class="telegram-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                ${telegramHandle}
            </a>
        `;
    }

    async updateAnalytics() {
        if (!this.buyer) return;

        let totalSpent = parseFloat(this.buyer.total_spent) || 0;
        let totalTopup = parseFloat(this.buyer.total_topup) || 0;

        // Если есть фильтр - запрашиваем статистику с сервера
        if (this.currentDateFilter) {
            try {
                const startDate = this.currentDateFilter.startDate.toISOString();
                const endDate = this.currentDateFilter.endDate.toISOString();
                
                const response = await api.request(`/teams/${this.teamId}/stats?startDate=${startDate}&endDate=${endDate}`);
                const buyerStats = response.buyers.find(b => b.buyer_id === this.buyerId);
                
                if (buyerStats) {
                    totalSpent = buyerStats.filtered_spent || 0;
                    totalTopup = buyerStats.filtered_topups || 0;
                }
            } catch (error) {
                console.error('Ошибка загрузки статистики:', error);
            }
        }

        document.getElementById('buyer-cards-count').textContent = this.buyer.cards_count || 0;
        document.getElementById('buyer-total-balance').textContent = `${parseFloat(this.buyer.total_balance || 0).toFixed(2)} USD`;
        document.getElementById('buyer-total-spent').textContent = `${totalSpent.toFixed(2)} USD`;
        document.getElementById('buyer-total-topup').textContent = `${totalTopup.toFixed(2)} USD`;
    }

    renderBuyerCards() {
        const container = document.getElementById('buyer-cards-list');
        
        if (this.buyerCards.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    У этого баера пока нет назначенных карт
                </div>
            `;
            return;
        }

        const cardsHtml = this.buyerCards.map(card => `
            <div class="buyer-card-item assigned">
                <div class="buyer-card-info">
                    <div class="buyer-card-name">${card.name}</div>
                    <div class="buyer-card-details">
                        ${card.currency} • Баланс: ${card.balance || 0} • 
                        Скручено: ${card.total_spent_calculated || 0} • 
                        Статус: ${this.getStatusText(card.status)}
                    </div>
                </div>
                <div class="buyer-card-status assigned">Назначена</div>
            </div>
        `).join('');

        container.innerHTML = cardsHtml;
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
            'limit_exceeded': 'Лимит достигнут'
        };
        return statusMap[status] || status;
    }

    openAssignModal() {
        const modal = document.getElementById('buyer-cards-modal');
        modal.classList.add('show');
        this.renderCardsForAssignment();
    }

    closeCardsModal() {
        const modal = document.getElementById('buyer-cards-modal');
        modal.classList.remove('show');
    }

    renderCardsForAssignment() {
        const container = document.getElementById('buyer-available-cards-list');

        if (this.allCards.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    В команде нет карт
                </div>
            `;
            return;
        }

        const cardsHtml = this.allCards.map(card => {
            const isAssignedToBuyer = card.buyer_id === this.buyerId;
            const isAssignedToOther = card.buyer_id && card.buyer_id !== this.buyerId;

            return `
                <label class="card-item-checkbox ${isAssignedToBuyer ? 'assigned-current' : ''} ${isAssignedToOther ? 'assigned-other' : ''}">
                    <input type="checkbox" value="${card.id}" name="buyer-selected-cards" 
                           ${isAssignedToBuyer ? 'checked' : ''} 
                           ${isAssignedToOther ? 'disabled' : ''}>
                    <div class="card-info">
                        <div class="card-name">${card.name}</div>
                        <div class="card-details">
                            ${card.currency} • Баланс: ${card.balance || 0} • 
                            Скручено: ${card.total_spent_calculated || 0} • 
                            Статус: ${this.getStatusText(card.status)}
                            ${isAssignedToBuyer ? ' • <span class="assigned-badge">Назначена</span>' : ''}
                            ${isAssignedToOther ? ' • <span class="other-badge">Занята</span>' : ''}
                        </div>
                    </div>
                </label>
            `;
        }).join('');

        container.innerHTML = cardsHtml;
    }

    async handleAssignCards() {
        const selectedCardIds = this.getSelectedCardIds();
        
        try {
            for (const card of this.allCards) {
                const isSelected = selectedCardIds.includes(card.id);
                const wasAssigned = card.buyer_id === this.buyerId;

                if (isSelected && !wasAssigned) {
                    await api.assignCardToBuyer(card.id, this.buyerId);
                } else if (!isSelected && wasAssigned) {
                    await api.assignCardToBuyer(card.id, null);
                }
            }

            notifications.success('Успех', 'Изменения сохранены');
            this.closeCardsModal();

            // Обновляем данные
            await this.loadBuyer();
            await this.loadCards();
            this.updateAnalytics();

        } catch (error) {
            console.error('Ошибка назначения карт:', error);
            notifications.error('Ошибка', 'Не удалось сохранить изменения');
        }
    }

    getSelectedCardIds() {
        const checkboxes = document.querySelectorAll('input[name="buyer-selected-cards"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    goBack() {
        // Возвращаемся к детальной странице команды
        if (window.app) {
            window.app.loadModule('teams');
            // Можно добавить переход к конкретной команде
            setTimeout(() => {
                if (window.teamsModule) {
                    window.teamsModule.showTeamDetail(this.teamId);
                }
            }, 100);
        }
    }
}

// Экспорт для module-loader
window.BuyerDetailModule = BuyerDetailModule;