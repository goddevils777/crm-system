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

            // Сохраняем экземпляр для доступа из onclick
            window.cardDetailModule = this;
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

            // Заполняем форму ежедневного обновления
            document.getElementById('current-balance').value = this.card.balance || 0;

            // ДОБАВЬ: Заполняем форму лимитов
            this.fillLimitsForm();
        }


        fillLimitsForm() {
            const topupLimitField = document.getElementById('topup-limit');
            const currentLimitStatus = document.getElementById('current-limit-status');
            const totalTopups = document.getElementById('total-topups');
            const limitDisplay = document.getElementById('limit-display');

            const limit = this.card.topup_limit || 8000;
            const currentTopups = this.card.total_top_up || 0;

            if (topupLimitField) {
                topupLimitField.value = limit;
            }

            if (limitDisplay) {
                limitDisplay.textContent = `${limit} ${this.card.currency}`;
            }

            if (totalTopups) {
                totalTopups.textContent = `${currentTopups} ${this.card.currency}`;
            }

            if (currentLimitStatus) {
                if (currentTopups >= limit) {
                    currentLimitStatus.textContent = '🔴 Лимит достигнут';
                    currentLimitStatus.style.color = 'var(--error-color)';
                } else {
                    const remaining = limit - currentTopups;
                    currentLimitStatus.textContent = `🟢 Осталось: ${remaining.toFixed(2)} ${this.card.currency}`;
                    currentLimitStatus.style.color = 'var(--success-color)';
                }
            }
        }

        fillBasicInfo() {
            const basicInfo = document.getElementById('basic-info');
            const createdDate = this.card.created_at ? new Date(this.card.created_at).toLocaleDateString() : '—';

            basicInfo.innerHTML = `
        <div class="info-item"><strong>ПІБ:</strong> ${this.card.full_name || '—'}</div>
        <div class="info-item"><strong>Телефон:</strong> ${this.card.phone || '—'}</div>
        <div class="info-item"><strong>Email:</strong> ${this.card.email || '—'}</div>
        <div class="info-item"><strong>Валюта:</strong> ${this.card.currency}</div>
        <div class="info-item"><strong>Подрядчик:</strong> ${this.card.contractor_name || '—'}</div>
        <div class="info-item"><strong>Дата запуска:</strong> ${this.card.launch_date ? new Date(this.card.launch_date).toLocaleDateString() : '—'}</div>
        <div class="info-item"><strong>Дата создания:</strong> ${createdDate}</div>
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
            <div class="finance-label">Комиссия</div>
            <div class="finance-value">${this.card.commission_paid || 0} ${this.card.currency}</div>
        </div>
        <div class="finance-item">
            <div class="finance-label">Всего пополнено</div>
            <div class="finance-value">${this.card.total_top_up || 0} ${this.card.currency}</div>
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

            // ДОБАВЬ: Проверка лимита при вводе пополнения
            const topupField = document.getElementById('topup-amount');
            if (topupField) {
                topupField.addEventListener('input', () => {
                    this.checkTopupLimit();
                });
            }

            // Кнопка обновления истории
            const refreshBtn = document.getElementById('refresh-history-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.loadTransactionHistory();
                });
            }

            // Форма лимитов
            const limitsForm = document.getElementById('limits-form');
            if (limitsForm) {
                limitsForm.addEventListener('submit', (e) => {
                    this.handleLimitsUpdate(e);
                });
            }
        }

        checkTopupLimit() {
            const topupField = document.getElementById('topup-amount');
            const topupAmount = parseFloat(topupField.value) || 0;

            if (topupAmount <= 0) {
                this.hideTopupWarning();
                return;
            }

            const currentTopups = parseFloat(this.card.total_top_up) || 0;
            const limit = parseFloat(this.card.topup_limit) || 8000;
            const newTotal = currentTopups + topupAmount;

            if (newTotal > limit) {
                this.showTopupWarning(newTotal, limit);
            } else {
                this.hideTopupWarning();
            }
        }

        showTopupWarning(newTotal, limit) {
            // Удаляем старое предупреждение
            this.hideTopupWarning();

            const topupField = document.getElementById('topup-amount');
            const warning = document.createElement('div');
            warning.id = 'topup-warning';
            warning.style.cssText = `
        color: var(--error-color);
        font-size: 12px;
        margin-top: 4px;
        padding: 8px;
        background: rgba(245, 34, 45, 0.1);
        border: 1px solid rgba(245, 34, 45, 0.3);
        border-radius: 6px;
        line-height: 1.4;
    `;

            const excess = newTotal - limit;
            warning.innerHTML = `
        <strong>⚠️ Лимит будет превышен!</strong><br>
        Текущие пополнения: ${(parseFloat(this.card.total_top_up) || 0).toFixed(2)} ${this.card.currency}<br>
        После пополнения: ${newTotal.toFixed(2)} ${this.card.currency}<br>
        Лимит: ${limit.toFixed(2)} ${this.card.currency}<br>
        Превышение: ${excess.toFixed(2)} ${this.card.currency}
    `;

            topupField.parentNode.appendChild(warning);
            topupField.style.borderColor = 'var(--error-color)';
        }

        hideTopupWarning() {
            const warning = document.getElementById('topup-warning');
            if (warning) {
                warning.remove();
            }

            const topupField = document.getElementById('topup-amount');
            if (topupField) {
                topupField.style.borderColor = '';
            }
        }

        async handleLimitsUpdate(e) {
            e.preventDefault();

            const topupLimit = parseFloat(document.getElementById('topup-limit').value) || 8000;

            try {
                await api.request(`/cards/${this.cardId}/limits`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        topup_limit: topupLimit
                    })
                });

                notifications.success('Лимит обновлен', 'Лимит пополнений успешно сохранен');

                // Перезагружаем данные карты
                await this.loadCard();
                this.fillCardInfo();

            } catch (error) {
                console.error('Ошибка обновления лимита:', error);
                notifications.error('Ошибка', 'Не удалось обновить лимит');
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
                        update_date: (() => {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            const day = String(now.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        })()
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
            // ДОБАВЬ: Очищаем сохраненное состояние детальной страницы
            localStorage.removeItem('current_card_detail');

            // ДОБАВЬ: Обновляем URL обратно на список карт
            window.history.replaceState({ module: 'cards' }, '', '#cards');

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

            const isCancelled = transaction.is_cancelled;
            const canCancel = !isCancelled && (transaction.transaction_type === 'topup' || transaction.transaction_type === 'expense');

            return `
        <tr class="${isCancelled ? 'cancelled-transaction' : ''}">
            <td>${new Date(transaction.transaction_date).toLocaleDateString()}</td>
            <td>
                <span class="transaction-type ${typeClass[transaction.transaction_type]}">
                    ${isCancelled ? '❌ ' : ''}${typeNames[transaction.transaction_type] || transaction.transaction_type}
                </span>
            </td>
            <td>${transaction.balance_before || 0} ${transaction.currency}</td>
            <td>${transaction.balance_after || 0} ${transaction.currency}</td>
            <td class="amount ${typeClass[transaction.transaction_type]}">
                ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ${transaction.currency}
            </td>
            <td>${transaction.description || '—'}</td>
            <td>${transaction.created_by_name || '—'}</td>
            <td>
                ${canCancel ? `
                    <button class="btn btn-secondary btn-sm" onclick="window.cardDetailModule?.cancelTransaction(${transaction.id})" title="Отменить транзакцию">
                        Отменить
                    </button>
                ` : (isCancelled ? '<span style="color: #999;">Отменена</span>' : '—')}
            </td>
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

        async cancelTransaction(transactionId) {
            const confirmed = await confirmDelete('Вы уверены, что хотите отменить эту транзакцию? Баланс карты будет пересчитан.');

            if (!confirmed) return;

            try {
                await api.request(`/cards/transactions/${transactionId}/cancel`, {
                    method: 'POST'
                });

                // Перезагружаем данные карты и историю
                await this.loadCard();
                this.fillFinanceSummary();
                await this.loadTransactionHistory();

                notifications.success('Транзакция отменена', 'Баланс карты обновлен');
            } catch (error) {
                console.error('Ошибка отмены транзакции:', error);
                notifications.error('Ошибка', 'Не удалось отменить транзакцию');
            }
        }

        async deleteCard() {
            const confirmed = await confirmDelete(
                `Вы уверены, что хотите удалить карту "${this.card.name}"? Это действие нельзя отменить. Все данные и история операций будут потеряны.`
            );

            if (!confirmed) return;

            try {
                await api.request(`/cards/${this.cardId}`, {
                    method: 'DELETE'
                });

                notifications.success('Карта удалена', 'Карта успешно удалена из системы');

                // Возвращаемся к списку карт
                this.goBackToCards();

            } catch (error) {
                console.error('Ошибка удаления карты:', error);
                notifications.error('Ошибка удаления', 'Не удалось удалить карту');
            }
        }
    }

    window.CardDetailModule = CardDetailModule;

} else {
    console.log('CardDetailModule already exists');
}