if (typeof CardDetailModule === 'undefined') {
    // Модуль детальной страницы карты
    class CardDetailModule {
        constructor(cardId) {
            this.cardId = cardId;
            this.card = null;
            this.init();
        }

        async init() {
            this.loadStyles();
            await this.loadCard();
            this.fillCardInfo();
            this.setupEventListeners();
        }

        loadStyles() {
            const detailCss = document.createElement('link');
            detailCss.rel = 'stylesheet';
            detailCss.href = `modules/cards/card-detail.css?v=${Date.now()}`;

            if (!document.querySelector('link[href*="card-detail.css"]')) {
                document.head.appendChild(detailCss);
            }
        }

        async loadCard() {
            try {
                // Загружаем данные карты по ID
                const response = await api.request(`/cards/${this.cardId}`);
                this.card = response.card;
            } catch (error) {
                console.error('Ошибка загрузки карты:', error);
                throw error;
            }
        }

        fillCardInfo() {
            if (!this.card) return;

            // Заголовок и статус
            document.getElementById('card-title').textContent = this.card.name;
            const statusBadge = document.getElementById('card-status');
            statusBadge.textContent = this.getStatusText(this.card.status);
            statusBadge.className = `card-status-badge ${this.card.status}`;

            // Основная информация
            this.fillBasicInfo();

            // Финансовая сводка
            this.fillFinanceSummary();

            // Заполняем форму
            document.getElementById('current-balance').value = this.card.balance || 0;
        }

        fillBasicInfo() {
            const basicInfo = document.getElementById('basic-info');
            basicInfo.innerHTML = `
                <div class="info-item"><strong>ПІБ:</strong> ${this.card.full_name || '—'}</div>
                <div class="info-item"><strong>Телефон:</strong> ${this.card.phone || '—'}</div>
                <div class="info-item"><strong>Email:</strong> ${this.card.email || '—'}</div>
                <div class="info-item"><strong>Валюта:</strong> ${this.card.currency}</div>
                <div class="info-item"><strong>Подрядчик:</strong> ${this.card.contractor_name || '—'}</div>
                <div class="info-item"><strong>Дата запуска:</strong> ${this.card.launch_date ? new Date(this.card.launch_date).toLocaleDateString() : '—'}</div>
            `;
        }

        fillFinanceSummary() {
            const financeSummary = document.getElementById('finance-summary');
            const daysSince = this.calculateDaysSinceTransaction(this.card.last_transaction_date);

            financeSummary.innerHTML = `
                <div class="finance-item">
                    <div class="finance-label">Баланс</div>
                    <div class="finance-value">${this.card.balance || 0} ${this.card.currency}</div>
                </div>
                <div class="finance-item">
                    <div class="finance-label">Скручено</div>
                    <div class="finance-value">${this.card.total_spent_calculated || 0} ${this.card.currency}</div>
                </div>
                <div class="finance-item">
                    <div class="finance-label">Прогрев</div>
                    <div class="finance-value">${this.card.warm_up_amount || 0} ${this.card.currency}</div>
                </div>
                ${daysSince >= 3 ? `
                <div class="finance-item warning">
                    <div class="finance-label">⚠️ Без операций</div>
                    <div class="finance-value">${daysSince} дней</div>
                </div>
                ` : ''}
            `;
        }

        setupEventListeners() {
            // Кнопка "Назад"
            document.getElementById('back-to-cards').addEventListener('click', () => {
                this.goBackToCards();
            });

            // Вкладки
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            // Форма ежедневного обновления
            document.getElementById('daily-update-form').addEventListener('submit', (e) => {
                this.handleDailyUpdate(e);
            });

            // Кнопка обновления истории
            const refreshBtn = document.getElementById('refresh-history-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.loadTransactionHistory();
                });
            }
        }

        switchTab(tabName) {
            // Убираем активные классы
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Добавляем активные классы
            document.querySelector(`[data-tab="${tabName}"].tab-btn`).classList.add('active');
            document.querySelector(`[data-tab="${tabName}"].tab-content`).classList.add('active');

            // Загружаем данные для конкретных вкладок
            if (tabName === 'history') {
                this.loadTransactionHistory();
            }
        }

        async handleDailyUpdate(e) {
            e.preventDefault();

            const currentBalance = parseFloat(document.getElementById('current-balance').value);
            const topupAmount = parseFloat(document.getElementById('topup-amount').value) || 0;
            const description = document.getElementById('update-description')?.value || '';

            try {
                // API запрос на обновление карты
                await api.request(`/cards/${this.cardId}/update`, {
                    method: 'POST',
                    body: JSON.stringify({
                        balance: currentBalance,
                        topup_amount: topupAmount,
                        description: description,
                        update_date: new Date().toISOString().split('T')[0]
                    })
                });

                // Перезагружаем данные карты
                await this.loadCard();
                this.fillFinanceSummary();

                // Перезагружаем историю если она открыта
                if (document.querySelector('[data-tab="history"].tab-content.active')) {
                    this.loadTransactionHistory();
                }

                // Сбрасываем форму
                document.getElementById('topup-amount').value = 0;
                if (document.getElementById('update-description')) {
                    document.getElementById('update-description').value = '';
                }

                notifications.success('Обновлено', 'Данные карты успешно обновлены');

            } catch (error) {
                console.error('Ошибка обновления карты:', error);
                notifications.error('Ошибка обновления', 'Не удалось обновить данные карты');
            }
        }

        goBackToCards() {
            // Используем глобальное приложение для возврата к модулю карт
            if (window.app && window.app.loadModule) {
                window.app.loadModule('cards');
            } else {
                // Запасной вариант - перезагрузка страницы
                console.error('App instance not found, reloading page');
                window.location.reload();
            }
        }

        calculateDaysSinceTransaction(lastTransactionDate) {
            if (!lastTransactionDate) return 0;

            const today = new Date();
            const lastDate = new Date(lastTransactionDate);
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays;
        }

        getStatusText(status) {
            const statusMap = {
                'active': 'Активна',
                'blocked': 'Заблокирована',
                'limit_exceeded': 'Превышен лимит',
                'deleted': 'Удалена'
            };
            return statusMap[status] || 'Неизвестно';
        }

        renderTransactionHistory() {
            const tbody = document.getElementById('history-table-body');

            if (!tbody) {
                console.error('History table body not found!');
                return;
            }

            if (this.transactions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <div>
                                <h4 style="margin-bottom: 8px;">История операций пуста</h4>
                                <p>Операции появятся после обновления карты</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = this.transactions.map(transaction => this.renderTransactionRow(transaction)).join('');
        }

        renderTransactionRow(transaction) {
            const typeNames = {
                'balance_update': 'Обновление баланса',
                'topup': 'Пополнение',
                'expense': 'Расход'
            };

            const typeClass = {
                'balance_update': 'neutral',
                'topup': 'positive',
                'expense': 'negative'
            };

            return `
                <tr>
                    <td>${new Date(transaction.transaction_date).toLocaleDateString()}</td>
                    <td>
                        <span class="transaction-type ${typeClass[transaction.transaction_type]}">
                            ${typeNames[transaction.transaction_type] || transaction.transaction_type}
                        </span>
                    </td>
                    <td>${transaction.balance_before || 0} ${transaction.currency}</td>
                    <td>${transaction.balance_after || 0} ${transaction.currency}</td>
                    <td class="amount ${typeClass[transaction.transaction_type]}">
                        ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ${transaction.currency}
                    </td>
                    <td>${transaction.description || '—'}</td>
                    <td>${transaction.created_by_name || '—'}</td>
                </tr>
            `;
        }

        async loadTransactionHistory() {
            try {
                console.log('Loading transaction history for card:', this.cardId);
                const response = await api.request(`/cards/${this.cardId}/transactions`);
                this.transactions = response.transactions || [];
                console.log('Loaded transactions:', this.transactions);
                this.renderTransactionHistory();
            } catch (error) {
                console.error('Ошибка загрузки истории:', error);
                notifications.error('Ошибка', 'Не удалось загрузить историю операций');
            }
        }
    }

    window.CardDetailModule = CardDetailModule;

} else {
    console.log('CardDetailModule already exists');
}