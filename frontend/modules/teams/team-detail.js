class TeamDetailModule {
    constructor() {
        this.teamId = null;
        this.team = null;
        this.buyers = [];
        this.currentView = 'grid';
        this.currentCurrency = 'USD'; // ДОБАВИТЬ ЭТУ СТРОКУ
        this.init();
    }

    async init() {
        // Получаем ID команды из URL
        const urlParams = new URLSearchParams(window.location.search);
        this.teamId = urlParams.get('teamId') || localStorage.getItem('current_team_detail');

        if (!this.teamId) {
            notifications.error('Ошибка', 'ID команды не найден');
            this.goBackToTeams();
            return;
        }

        this.setupEventListeners();
        await this.loadTeam();
        await this.loadBuyers();
    }

    setupEventListeners() {
        // Переключение видов
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view && view !== this.currentView) {
                    this.switchView(view);
                }
            });
        });

        // ДОБАВИТЬ: Обработчик переключения валют
        const currencyFilter = document.getElementById('currency-filter');
        currencyFilter?.addEventListener('change', (e) => {
            this.currentCurrency = e.target.value;
            console.log('Currency changed to:', this.currentCurrency);
            this.updateTeamStats();
            this.renderBuyers();
        });

        // Обработчик кнопки добавления баера
        const addBuyerBtn = document.getElementById('add-buyer-btn');
        addBuyerBtn?.addEventListener('click', () => {
            this.showAddBuyerModal();
        });

        // Обработчики фильтра дат
        this.setupDateFilter();
    }


    setupDateFilter() {
        const periodSelect = document.getElementById('date-period-select');
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');

        // Обработчик выпадающего списка
        periodSelect.addEventListener('change', (e) => {
            const period = e.target.value;

            if (period && period !== 'custom') {
                // Заполняем поля датами для выбранного периода
                const { startDate, endDate } = this.getPeriodDates(period);

                if (startDate && endDate) {
                    dateFrom.value = startDate.toISOString().split('T')[0];
                    dateTo.value = endDate.toISOString().split('T')[0];
                }

                this.applyDateFilter(period);
            } else if (!period) {
                // Очищаем все при выборе "Все время"
                dateFrom.value = '';
                dateTo.value = '';
                this.clearDateFilter();
            }
        });

        // Автоматическое применение при изменении дат
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

    applyDateFilter(period) {
        const { startDate, endDate } = this.getPeriodDates(period);
        this.currentDateFilter = { startDate, endDate, period };
        this.filterAndUpdateData();
    }

    applyCustomDateFilter() {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;

        if (dateFrom && dateTo) {
            this.currentDateFilter = {
                startDate: new Date(dateFrom),
                endDate: new Date(dateTo + 'T23:59:59'),
                period: 'custom'
            };
            this.filterAndUpdateData();
        }
    }

    clearDateFilter() {
        this.currentDateFilter = null;
        this.filterAndUpdateData();
    }

    getPeriodDates(period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
                return { startDate: today, endDate: todayEnd }; // ТОЛЬКО сегодня
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

    async filterAndUpdateData() {
        if (!this.currentDateFilter) {
            this.filteredBuyers = [...this.buyers];
        } else {
            try {
                const startDate = this.currentDateFilter.startDate.toISOString();
                const endDate = this.currentDateFilter.endDate.toISOString();

                console.log('API request:', `/teams/${this.teamId}/stats?startDate=${startDate}&endDate=${endDate}`);
                const response = await api.request(`/teams/${this.teamId}/stats?startDate=${startDate}&endDate=${endDate}`);

                console.log('API response for period stats:', response);
                console.log('First buyer from API:', response.buyers[0]);

                this.filteredBuyers = this.buyers.map(originalBuyer => {
                    const filteredBuyer = response.buyers.find(b => b.buyer_id === originalBuyer.id);
                    console.log(`Buyer ${originalBuyer.username}:`, {
                        original_spent: originalBuyer.total_spent,
                        filtered_spent: filteredBuyer?.filtered_spent,
                        original_topup: originalBuyer.total_topup,
                        filtered_topups: filteredBuyer?.filtered_topups
                    });

                    return {
                        ...originalBuyer,
                        filtered_spent: filteredBuyer?.filtered_spent || 0,
                        filtered_topups: filteredBuyer?.filtered_topups || 0
                    };
                });

            } catch (error) {
                console.error('Ошибка загрузки статистики:', error);
                this.filteredBuyers = [...this.buyers];
            }
        }

        this.updateTeamStats();
        this.renderBuyers();
    }


    updateTeamStats() {
    if (!this.filteredBuyers) return;

    console.log('this.currentDateFilter:', this.currentDateFilter);
    const isFiltered = !!this.currentDateFilter;
    console.log('isFiltered result:', isFiltered);
    console.log('Current currency:', this.currentCurrency);

    let totalSpent = 0;
    let totalTopups = 0;
    let totalBalance = 0;

    this.filteredBuyers.forEach((buyer, index) => {
        console.log(`Баер ${index + 1}:`, buyer.username);
        
        // Используем тот же метод что и для отображения баеров
        const currencyData = this.getBuyerCurrencyData(buyer);
        
        totalSpent += currencyData.spent;
        totalTopups += currencyData.topup;
        totalBalance += currencyData.balance;
        
        console.log(`- ${this.currentCurrency} данные:`, currencyData);
    });

    console.log('FINAL TOTALS for', this.currentCurrency, ':', { totalSpent, totalTopups, totalBalance });

    document.getElementById('total-balance').textContent = `${totalBalance.toFixed(2)} ${this.currentCurrency}`;
    document.getElementById('total-spent').textContent = `${totalSpent.toFixed(2)} ${this.currentCurrency}`;
    document.getElementById('total-topup').textContent = `${totalTopups.toFixed(2)} ${this.currentCurrency}`;
}


    async loadTeam() {
        try {
            const response = await api.request(`/teams/${this.teamId}`);
            this.team = response.team;
            this.updateTeamHeader();
            this.updateTeamStats(); // Добавить эту строку
        } catch (error) {
            console.error('Ошибка загрузки команды:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные команды');
        }
    }

    async loadBuyers() {
        try {
            const response = await api.request(`/teams/${this.teamId}/buyers`);
            this.buyers = response.buyers;

            console.log('Original buyers data:', JSON.stringify(this.buyers[0], null, 2));

            this.filteredBuyers = this.buyers;
            this.renderBuyers();

            // ДОБАВЬ эту строку
            this.updateTeamStats();

        } catch (error) {
            console.error('Ошибка загрузки баеров:', error);
        }
    } 

    updateTeamHeader() {
        if (!this.team) return;



        // Обновляем только название команды и счетчики
        document.getElementById('team-name').textContent = this.team.name || 'Загрузка...';
        document.getElementById('buyers-count').textContent = this.team.buyers_count || 0;
        document.getElementById('cards-count').textContent = this.team.cards_count || 0;
    }
    renderBuyers() {
        if (this.currentView === 'grid') {
            this.renderBuyersGrid();
        } else {
            this.renderBuyersTable();
        }
    }

    renderBuyersGrid() {
        const container = document.getElementById('buyers-grid');
        const buyersToRender = this.filteredBuyers || this.buyers;

        if (buyersToRender.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">В команде пока нет баеров</p>';
            return;
        }

        const buyersHtml = buyersToRender.map(buyer => {
            // Добавляем @ если его нет
            const telegramHandle = buyer.telegram.startsWith('@') ? buyer.telegram : `@${buyer.telegram}`;

            // ДОБАВИТЬ: Получаем данные для выбранной валюты
            const currencyData = this.getBuyerCurrencyData(buyer);

            return `
        <div class="buyer-card" onclick="window.teamDetailModule?.openBuyerDetail(${buyer.id})">
            <div class="buyer-card-header">
                <div class="buyer-info">
                    <h4 class="buyer-name">${buyer.username}</h4>
                    <div class="buyer-telegram">
                        <a href="https://t.me/${telegramHandle.replace('@', '')}" target="_blank" onclick="event.stopPropagation();" class="telegram-link">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                            </svg>
                            ${telegramHandle}
                        </a>
                    </div>
                </div>
                <div class="buyer-actions">
                    <button class="buyer-action-btn assign" onclick="event.stopPropagation(); window.teamDetailModule?.assignCards(${buyer.id})" title="Назначить карты">
                        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z"/>
                            <path d="M192 474h672q8 0 8 8v60q0 8-8 8H192q-8 0-8-8v-60q0-8 8-8z"/>
                        </svg>
                    </button>
                    <button class="buyer-action-btn delete" onclick="event.stopPropagation(); window.teamDetailModule?.deleteBuyer(${buyer.id})" title="Удалить">
                        <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="buyer-stats">
                <div class="buyer-stat">
                    <div class="buyer-stat-value">${currencyData.cardsCount}</div>
                    <div class="buyer-stat-label">Карт</div>
                </div>
                <div class="buyer-stat">
                    <div class="buyer-stat-value">${currencyData.balance.toFixed(2)}</div>
                    <div class="buyer-stat-label">Баланс</div>
                </div>
                <div class="buyer-stat">
                    <div class="buyer-stat-value">${currencyData.spent.toFixed(2)}</div>
                    <div class="buyer-stat-label">Скручено</div>
                </div>
                <div class="buyer-stat">
                    <div class="buyer-stat-value">${currencyData.topup.toFixed(2)}</div>
                    <div class="buyer-stat-label">Пополнено</div>
                </div>
            </div>
        </div>
    `;
        }).join('');

        container.innerHTML = buyersHtml;
    }

    // ДОБАВИТЬ: Вспомогательный метод для получения данных баера по валюте
// Вспомогательный метод для получения данных баера по валюте
getBuyerCurrencyData(buyer) {
    const currencyBreakdown = buyer.currency_breakdown || {};
    const selectedCurrencyData = currencyBreakdown[this.currentCurrency];
    
    if (selectedCurrencyData) {
        // Если у баера есть карты в выбранной валюте
        const isFiltered = !!this.currentDateFilter;
        
        return {
            cardsCount: selectedCurrencyData.cards_count || 0,
            balance: parseFloat(selectedCurrencyData.balance || 0),
            spent: isFiltered ? 
                (buyer.filtered_spent || 0) * (selectedCurrencyData.balance / (buyer.total_balance || 1)) :
                parseFloat(selectedCurrencyData.spent || 0),
            topup: isFiltered ? 
                (buyer.filtered_topups || 0) * (selectedCurrencyData.balance / (buyer.total_balance || 1)) :
                parseFloat(selectedCurrencyData.topup || 0)
        };
    } else {
        // Если у баера нет карт в выбранной валюте - показываем нули
        return {
            cardsCount: 0,
            balance: 0,
            spent: 0,
            topup: 0
        };
    }
}

   renderBuyersTable() {
    const tbody = document.getElementById('buyers-table-body');
    const buyersToRender = this.filteredBuyers || this.buyers;

    if (buyersToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">В команде пока нет баеров</td></tr>';
        return;
    }

    const buyersHtml = buyersToRender.map(buyer => {
        const telegramHandle = buyer.telegram.startsWith('@') ? buyer.telegram : `@${buyer.telegram}`;
        
        // ДОБАВИТЬ: Получаем данные для выбранной валюты
        const currencyData = this.getBuyerCurrencyData(buyer);

        return `
        <tr>
            <td>
                <a href="#" class="buyer-name-link" onclick="window.teamDetailModule?.openBuyerDetail(${buyer.id}); return false;">
                    ${buyer.username}
                </a>
            </td>
            <td>
             <a href="https://t.me/${telegramHandle.replace('@', '')}" target="_blank" class="telegram-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                ${telegramHandle}
            </a>
            </td>
            <td>${currencyData.cardsCount}</td>
            <td>${currencyData.balance.toFixed(2)} ${this.currentCurrency}</td>
            <td>${currencyData.spent.toFixed(2)}</td>
            <td>${currencyData.topup.toFixed(2)}</td>
            <td>${new Date(buyer.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <div class="buyer-table-actions">
                    <button class="buyer-table-action-btn assign" onclick="window.teamDetailModule?.assignCards(${buyer.id})" title="Назначить карты">
                        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z"/>
                            <path d="M192 474h672q8 0 8 8v60q0 8-8 8H192q-8 0-8-8v-60q0-8 8-8z"/>
                        </svg>
                    </button>
                    <button class="buyer-table-action-btn delete" onclick="window.teamDetailModule?.deleteBuyer(${buyer.id})" title="Удалить">
                        <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    tbody.innerHTML = buyersHtml;
}

    switchView(view) {
        this.currentView = view;

        // Обновляем кнопки
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.view-btn[data-view="${view}"]`)?.classList.add('active');

        // Показываем нужный контейнер
        const gridContainer = document.getElementById('buyers-grid');
        const tableContainer = document.getElementById('buyers-table-container');

        if (view === 'grid') {
            gridContainer.style.display = 'grid';
            tableContainer.style.display = 'none';
        } else {
            gridContainer.style.display = 'none';
            tableContainer.style.display = 'block';
        }

        this.renderBuyers();
    }

    showAddBuyerModal() {
        const modal = document.getElementById('add-buyer-modal');
        modal.classList.add('show');

        // Настраиваем события модального окна
        this.setupModalEvents();
    }

    setupModalEvents() {
        const modal = document.getElementById('add-buyer-modal');
        const form = document.getElementById('add-buyer-form');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');

        // Закрытие модального окна
        const closeModal = () => {
            modal.classList.remove('show');
            form.reset();
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        // Закрытие по клику вне модального окна
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        // Отправка формы
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.handleAddBuyer(e);
        };
    }

    async handleAddBuyer(e) {
        const formData = new FormData(e.target);
        const buyerData = {
            username: formData.get('username').trim(),
            telegram: formData.get('telegram').trim()
        };

        // Валидация
        if (!buyerData.username || !buyerData.telegram) {
            notifications.error('Ошибка', 'Заполните все поля');
            return;
        }

        if (buyerData.username.length < 2) {
            notifications.error('Ошибка', 'Имя должно содержать минимум 2 символа');
            return;
        }

        try {
            // Создаем баера в команде
            const response = await api.createBuyer(this.teamId, buyerData);

            notifications.success('Успех', `Баер "${buyerData.username}" создан`);
            console.log('Ссылка приглашения:', response.invitationLink);

            // Закрываем модальное окно
            document.getElementById('add-buyer-modal').classList.remove('show');
            e.target.reset();

            // Обновляем данные
            await this.loadBuyers();
            await this.loadTeam();

        } catch (error) {
            console.error('Ошибка создания баера:', error);
            notifications.error('Ошибка', error.message || 'Не удалось создать баера');
        }
    }

    async assignCards(buyerId) {
        const buyer = this.buyers.find(b => b.id === buyerId);
        if (!buyer) return;

        document.getElementById('assign-modal-title').textContent = `Управление картами баера ${buyer.username}`;

        try {
            // Загружаем ВСЕ карты команды
            const response = await api.request(`/cards?team_id=${this.teamId}`);
            const allCards = response.cards || [];

            // ДОБАВИЛИ: Сохраняем данные карт для использования в других функциях
            this.currentCardsData = allCards;

            // Карты этого баера
            const buyerCards = allCards.filter(card => card.buyer_id === buyerId);

            this.renderCardsForAssignment(allCards, buyerCards, buyerId);
            this.showAssignCardsModal(buyerId);

        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            notifications.error('Ошибка', 'Не удалось загрузить список карт');
        }
    }

    renderCardsForAssignment(allCards, buyerCards, buyerId) {
        const container = document.getElementById('available-cards-list');

        if (allCards.length === 0) {
            container.innerHTML = `
            <div class="cards-empty-state">
                <h4>Нет карт в команде</h4>
                <p>В этой команде еще нет созданных карт</p>
            </div>
        `;
            return;
        }

        const cardsHtml = allCards.map(card => {
            const isAssignedToBuyer = card.buyer_id === buyerId;
            const isAssignedToOther = card.buyer_id && card.buyer_id !== buyerId;

            return `
        <label class="card-item-checkbox ${isAssignedToBuyer ? 'assigned-current' : ''} ${isAssignedToOther ? 'assigned-other' : ''}">
            <input type="checkbox" value="${card.id}" name="selected-cards" 
                   ${isAssignedToBuyer ? 'checked' : ''} 
                   ${isAssignedToOther ? 'disabled' : ''}>
            <div class="card-info">
                <div class="card-name">
                    <span onclick="event.stopPropagation(); window.open('#card/${card.id}', '_blank');" 
                        style="color: var(--primary-color); cursor: pointer; text-decoration: underline;">
                        ${card.name}
                    </span>
                </div>
                <div class="card-details">
                    ${card.currency} • Баланс: ${card.balance || 0} ${card.currency} • 
                    Скручено: ${card.total_spent_calculated || 0} ${card.currency} • 
                    Пополнено: ${card.total_top_up || 0} ${card.currency} • 
                    Статус: ${this.getStatusText(card.status)}
                    ${isAssignedToBuyer ? ' • <span class="assigned-badge">Назначена</span>' : ''}
                    ${isAssignedToOther ? ' • <span class="assigned-badge assigned-other">Назначена другому</span>' : ''}
                </div>
            </div>
        </label>
        `;
        }).join('');

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
            'not_spinning': 'Не крутит'
        };
        return statusMap[status] || status;
    }

    showAssignCardsModal(buyerId) {
        const modal = document.getElementById('assign-cards-modal');
        modal.classList.add('show');

        this.setupAssignModalEvents(buyerId);
    }

    setupAssignModalEvents(buyerId) {
        const modal = document.getElementById('assign-cards-modal');
        const assignBtn = document.getElementById('assign-selected-cards');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');

        const closeModal = () => {
            modal.classList.remove('show');
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        assignBtn.onclick = () => this.handleAssignCards(buyerId, closeModal);
    }

    async handleAssignCards(buyerId, closeModal) {
        const allCards = this.currentCardsData || [];
        const selectedCardIds = this.getSelectedCardIds();

        try {
            // Проходим по всем картам команды
            for (const card of allCards) {
                const isSelected = selectedCardIds.includes(card.id);
                const wasAssigned = card.buyer_id === buyerId;

                if (isSelected && !wasAssigned) {
                    // Назначить карту баеру
                    await api.assignCardToBuyer(card.id, buyerId);
                } else if (!isSelected && wasAssigned) {
                    // Снять назначение (передаем null)
                    await api.assignCardToBuyer(card.id, null);
                }
            }

            notifications.success('Успех', 'Изменения сохранены');
            closeModal();

            // Обновляем данные
            await this.loadBuyers();
            await this.loadTeam();

        } catch (error) {
            console.error('Ошибка назначения карт:', error);
            notifications.error('Ошибка', 'Не удалось сохранить изменения');
        }
    }



    async deleteBuyer(buyerId) {
        const buyer = this.buyers.find(b => b.id === buyerId);
        if (!buyer) return;

        const confirmed = await confirmDelete(`Вы уверены, что хотите удалить баера "${buyer.username}"?`);
        if (!confirmed) return;

        try {
            await api.deleteBuyer(buyerId);
            await this.loadBuyers();
            await this.loadTeam(); // Обновляем статистику
            notifications.success('Успех', `Баер "${buyer.username}" удален`);
        } catch (error) {
            console.error('Ошибка удаления баера:', error);
            notifications.error('Ошибка', 'Не удалось удалить баера');
        }
    }

    async openBuyerDetail(buyerId) {
        try {
            // Загружаем HTML
            const htmlResponse = await fetch('modules/teams/buyer-detail.html');
            const html = await htmlResponse.text();

            // Загружаем CSS если не загружен
            if (!document.querySelector('link[href*="buyer-detail.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'modules/teams/buyer-detail.css';
                document.head.appendChild(link);
            }

            // Загружаем JS модуль
            if (!window.BuyerDetailModule) {
                const script = document.createElement('script');
                script.src = 'modules/teams/buyer-detail.js';
                document.head.appendChild(script);

                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }

            // Заменяем содержимое
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = html;

            // Инициализируем модуль детальной страницы баера
            setTimeout(() => {
                window.buyerDetailModule = new window.BuyerDetailModule(buyerId, this.teamId);
            }, 100);

        } catch (error) {
            console.error('Ошибка загрузки детальной страницы баера:', error);
            notifications.error('Ошибка', 'Не удалось загрузить страницу баера');
        }
    }

    goBackToTeams() {
        // Очищаем сохраненный ID
        localStorage.removeItem('current_team_detail');
        // Возвращаемся к модулю команд
        if (window.app) {
            window.app.loadModule('teams');
        }
    }

    getAllCardsFromModal() {
        const response = this.currentCardsData || []; // Сохраняем данные карт при загрузке
        return response;
    }

    getSelectedCardIds() {
        const checkboxes = document.querySelectorAll('input[name="selected-cards"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
}

// Инициализация при загрузке
window.teamDetailModule = null;

// Экспорт для module-loader
window.TeamDetailModule = TeamDetailModule;