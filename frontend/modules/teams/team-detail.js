class TeamDetailModule {
    constructor() {
        this.teamId = null;
        this.team = null;
        this.buyers = [];
        this.currentView = 'grid';
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
        this.render();
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
    }

    async loadTeam() {
        try {
            const response = await api.request(`/teams/${this.teamId}`);
            this.team = response.team;
            this.updateTeamHeader();
        } catch (error) {
            console.error('Ошибка загрузки команды:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные команды');
        }
    }

    async loadBuyers() {
        try {
            const response = await api.request(`/teams/${this.teamId}/buyers`);
            this.buyers = response.buyers;
            this.renderBuyers();
        } catch (error) {
            console.error('Ошибка загрузки баеров:', error);
            notifications.error('Ошибка', 'Не удалось загрузить список баеров');
        }
    }

    updateTeamHeader() {
        if (!this.team) return;

        document.getElementById('team-name').textContent = this.team.name;
        document.getElementById('buyers-count').textContent = this.team.buyers_count || 0;
        document.getElementById('cards-count').textContent = this.team.cards_count || 0;
        document.getElementById('total-balance').textContent = `${this.team.total_balance || 0} USD`;
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

        if (this.buyers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">В команде пока нет баеров</p>';
            return;
        }

        const buyersHtml = this.buyers.map(buyer => {
            // Добавляем @ если его нет
            const telegramHandle = buyer.telegram.startsWith('@') ? buyer.telegram : `@${buyer.telegram}`;

            return `
        <div class="buyer-card" onclick="window.teamDetailModule?.openBuyerDetail(${buyer.id})">
            <div class="buyer-card-header">
                <div class="buyer-info">
                    <h4 class="buyer-name">${buyer.username}</h4>
                    <div class="buyer-telegram">
                        <a href="https://t.me/${telegramHandle.replace('@', '')}" target="_blank" onclick="event.stopPropagation();" class="telegram-link">
                            📱 ${telegramHandle}
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
                    <div class="buyer-stat-value">${buyer.cards_count || 0}</div>
                    <div class="buyer-stat-label">Карт</div>
                </div>
                <div class="buyer-stat">
                    <div class="buyer-stat-value">${buyer.total_balance || 0}</div>
                    <div class="buyer-stat-label">USD</div>
                </div>
            </div>
        </div>
    `;
        }).join('');

        container.innerHTML = buyersHtml;
    }

    renderBuyersTable() {
        const tbody = document.getElementById('buyers-table-body');

        if (this.buyers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">В команде пока нет баеров</td></tr>';
            return;
        }

        const buyersHtml = this.buyers.map(buyer => {
            // Добавляем @ если его нет
            const telegramHandle = buyer.telegram.startsWith('@') ? buyer.telegram : `@${buyer.telegram}`;

            return `
        <tr>
            <td>
                <a href="#" class="buyer-name-link" onclick="window.teamDetailModule?.openBuyerDetail(${buyer.id}); return false;">
                    ${buyer.username}
                </a>
            </td>
            <td>
                <a href="https://t.me/${telegramHandle.replace('@', '')}" target="_blank" class="telegram-link">
                    ${telegramHandle}
                </a>
            </td>
            <td>${buyer.cards_count || 0}</td>
            <td>${buyer.total_balance || 0} USD</td>
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

        // Устанавливаем заголовок модального окна
        document.getElementById('assign-modal-title').textContent = `Назначить карты баеру ${buyer.username}`;

        try {
            // Загружаем доступные карты команды
            const response = await api.request(`/cards?team_id=${this.teamId}&unassigned=true`);
            const availableCards = response.cards || [];

            this.renderCardsForAssignment(availableCards);
            this.showAssignCardsModal(buyerId);

        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            notifications.error('Ошибка', 'Не удалось загрузить список карт');
        }
    }

    renderCardsForAssignment(cards) {
        const container = document.getElementById('available-cards-list');

        if (cards.length === 0) {
            container.innerHTML = `
            <div class="cards-empty-state">
                <h4>Нет доступных карт</h4>
                <p>Все карты команды уже назначены или нет карт в команде</p>
            </div>
        `;
            return;
        }

        const cardsHtml = cards.map(card => `
        <label class="card-item-checkbox">
            <input type="checkbox" value="${card.id}" name="selected-cards">
            <div class="card-info">
                <div class="card-name">${card.name}</div>
                <div class="card-details">
                    ${card.currency} • Баланс: ${card.balance || 0} ${card.currency} • 
                    Статус: ${this.getStatusText(card.status)}
                </div>
            </div>
        </label>
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
        const checkboxes = document.querySelectorAll('input[name="selected-cards"]:checked');
        const selectedCardIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (selectedCardIds.length === 0) {
            notifications.warning('Внимание', 'Выберите хотя бы одну карту');
            return;
        }

        try {
            // Назначаем каждую выбранную карту
            for (const cardId of selectedCardIds) {
                await api.assignCardToBuyer(cardId, buyerId);
            }

            notifications.success('Успех', `Назначено ${selectedCardIds.length} карт`);
            closeModal();

            // Обновляем данные
            await this.loadBuyers();
            await this.loadTeam();

        } catch (error) {
            console.error('Ошибка назначения карт:', error);
            notifications.error('Ошибка', 'Не удалось назначить карты');
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

    openBuyerDetail(buyerId) {
        notifications.info('В разработке', 'Детальная страница баера будет позже');
    }

    goBackToTeams() {
        // Очищаем сохраненный ID
        localStorage.removeItem('current_team_detail');
        // Возвращаемся к модулю команд
        if (window.app) {
            window.app.loadModule('teams');
        }
    }

    render() {
        // Метод уже не нужен, так как HTML уже загружен
    }
}

// Инициализация при загрузке
window.teamDetailModule = null;

// Экспорт для module-loader
window.TeamDetailModule = TeamDetailModule;