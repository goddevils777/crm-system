class ClientsModule {
    constructor() {
        this.clients = [];
        this.filteredClients = [];
        this.currentView = 'list'; // 'list' или 'detail'
        this.currentClientId = null;
        this.currentClient = null;
        this.teams = [];
        this.bills = [];

        console.log('ClientsModule initialized');
        this.loadStyles();
        this.init();
    }

    async init() {
        console.log('Initializing clients module...');

        try {
            await this.loadClients();
            
            // Проверяем нужно ли показать детали клиента
            const clientId = localStorage.getItem('current_client_detail');
            if (clientId && window.location.hash.startsWith('#client/')) {
                await this.showClientDetail(parseInt(clientId));
            } else {
                this.showClientsList();
            }
            
            console.log('Clients module initialization complete');
        } catch (error) {
            console.error('Error initializing clients module:', error);
            notifications.error('Ошибка', 'Не удалось загрузить модуль клиентов');
        }
    }

    loadStyles() {
        const timestamp = Date.now();

        const clientsCss = document.createElement('link');
        clientsCss.rel = 'stylesheet';
        clientsCss.href = `modules/clients/clients.css?v=${timestamp}`;

        if (!document.querySelector('link[href*="modules/clients/clients.css"]')) {
            document.head.appendChild(clientsCss);
        }

        // Загружаем стили для детальной страницы
        const detailCss = document.createElement('link');
        detailCss.rel = 'stylesheet';
        detailCss.href = `modules/clients/client-detail.css?v=${timestamp}`;

        if (!document.querySelector('link[href*="client-detail.css"]')) {
            document.head.appendChild(detailCss);
        }
    }

    // Показать список клиентов
    showClientsList() {
        this.currentView = 'list';
        this.currentClientId = null;
        localStorage.removeItem('current_client_detail');
        window.history.replaceState(null, '', '#clients');
        
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = this.getClientsListHTML();
        
        this.setupEventListeners();
        this.renderClients();
    }

    // Показать детали клиента
    async showClientDetail(clientId) {
        this.currentView = 'detail';
        this.currentClientId = clientId;
        localStorage.setItem('current_client_detail', clientId);
        window.history.replaceState(null, '', `#client/${clientId}`);
        
        try {
            await this.loadClient(clientId);
            await this.loadTeams();
            await this.loadBills(clientId);
            
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = this.getClientDetailHTML();
            
            this.setupClientDetailEvents();
            this.renderClientInfo();
            this.renderBills();
        } catch (error) {
            console.error('Error loading client detail:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные клиента');
            this.showClientsList();
        }
    }

    // HTML для списка клиентов
    getClientsListHTML() {
        return `
            <div class="module-header">
                <div class="header-left">
                    <h2>Клиенты</h2>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="add-client-btn">
                        + Добавить клиента
                    </button>
                </div>
            </div>

            <div class="clients-filters">
                <div class="filter-group">
                    <input type="text" id="search-clients" class="form-input" placeholder="Поиск клиентов...">
                </div>
            </div>

            <div class="clients-grid" id="clients-container">
                <!-- Клиенты загружаются динамически -->
            </div>

            <!-- Модальное окно добавления клиента -->
            <div id="client-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Добавить клиента</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="client-form">
                        <div class="form-group">
                            <label class="form-label">Название клиента *</label>
                            <input type="text" name="name" class="form-input" required placeholder="Введите название">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" placeholder="client@example.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Телефон</label>
                            <input type="tel" name="phone" class="form-input" placeholder="+1234567890">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Описание</label>
                            <textarea name="description" class="form-input" rows="3" placeholder="Дополнительная информация"></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary modal-cancel">Отмена</button>
                            <button type="submit" class="btn btn-primary">Создать клиента</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // HTML для детальной страницы клиента  
    getClientDetailHTML() {
        return `
            <div class="client-detail-container">
                <div class="client-detail-header">
                    <button class="btn btn-secondary back-btn" onclick="window.clientsModule?.showClientsList()">
                        ← Назад к клиентам
                    </button>
                    <div class="client-info">
                        <h2 id="client-name">Загрузка...</h2>
                        <div class="client-meta">
                            <span id="client-contact"></span>
                            <span id="client-created"></span>
                        </div>
                    </div>
                    <div class="client-actions">
                        <button class="btn btn-primary" id="create-bill-btn">
                            Сформировать счет
                        </button>
                    </div>
                </div>

                <!-- Список выставленных счетов -->
                <div class="bills-section">
                    <div class="section-header">
                        <h3>Выставленные счета</h3>
                    </div>
                    <div class="bills-table-container" id="bills-container">
                        <table class="bills-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Период</th>
                                    <th>Команда</th>
                                    <th>Баеров</th>
                                    <th>Карт</th>
                                    <th>Сумма</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="bills-table-body">
                                <!-- Счета загружаются динамически -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Модальное окно создания счета -->
            <div id="create-bill-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Создать счет</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Команда</label>
                            <select id="team-select" class="form-select">
                                <option value="">Выберите команду</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Период</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="date" id="period-from" class="form-input" placeholder="от">
                                <input type="date" id="period-to" class="form-input" placeholder="до">
                            </div>
                        </div>
                        <div id="team-summary" style="display: none;">
                            <h4>Данные по команде:</h4>
                            <div class="bill-summary-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Баеров:</span>
                                    <span class="stat-value" id="summary-buyers">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Карт:</span>
                                    <span class="stat-value" id="summary-cards">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Скручено:</span>
                                    <span class="stat-value" id="summary-spent">0 USD</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary modal-cancel">Отмена</button>
                        <button type="button" class="btn btn-primary" id="send-bill-btn" disabled>
                            Отправить счет
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadClients() {
        try {
            console.log('Loading clients from API...');
            const response = await api.request('/clients');
            this.clients = response.clients || [];
            this.filteredClients = [...this.clients];
            console.log('Loaded clients:', this.clients.length);
        } catch (error) {
            console.error('Error loading clients:', error);
            this.clients = [];
            this.filteredClients = [];
        }
    }

    async loadClient(clientId) {
        try {
            const response = await api.request(`/clients/${clientId}`);
            this.currentClient = response.client;
        } catch (error) {
            console.error('Error loading client:', error);
            this.currentClient = {
                id: clientId,
                name: 'Клиент не найден',
                created_at: new Date().toISOString()
            };
        }
    }

    async loadTeams() {
        try {
            const response = await api.request('/teams');
            this.teams = response.teams || [];
        } catch (error) {
            console.error('Error loading teams:', error);
            this.teams = [];
        }
    }

    async loadBills(clientId) {
        try {
            const response = await api.request(`/clients/${clientId}/bills`);
            this.bills = response.bills || [];
        } catch (error) {
            console.error('Error loading bills:', error);
            this.bills = [];
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Кнопка добавления клиента
        const addBtn = document.getElementById('add-client-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
            console.log('Add button listener attached');
        }

        // Поиск клиентов
        const searchInput = document.getElementById('search-clients');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterClients(e.target.value));
        }

        this.setupModalEvents();
    }

    setupClientDetailEvents() {
        // Кнопка создания счета
        const createBillBtn = document.getElementById('create-bill-btn');
        createBillBtn?.addEventListener('click', () => this.showCreateBillModal());

        // Модальное окно создания счета
        this.setupBillModalEvents();

        // Выбор команды
        const teamSelect = document.getElementById('team-select');
        teamSelect?.addEventListener('change', (e) => this.onTeamSelect(e.target.value));

        // Поля дат
        const periodFrom = document.getElementById('period-from');
        const periodTo = document.getElementById('period-to');
        
        [periodFrom, periodTo].forEach(input => {
            input?.addEventListener('change', () => this.updateTeamSummary());
        });
    }

    setupModalEvents() {
        const modal = document.getElementById('client-modal');
        const form = document.getElementById('client-form');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal();
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => this.handleClientSubmit(e));
        }
    }

    setupBillModalEvents() {
        const modal = document.getElementById('create-bill-modal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');
        const sendBtn = document.getElementById('send-bill-btn');

        closeBtn?.addEventListener('click', () => this.hideCreateBillModal());
        cancelBtn?.addEventListener('click', () => this.hideCreateBillModal());
        sendBtn?.addEventListener('click', () => this.sendBill());

        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideCreateBillModal();
        });
    }

    renderClientInfo() {
        if (!this.currentClient) return;

        document.getElementById('client-name').textContent = this.currentClient.name;
        
        const contactInfo = [];
        if (this.currentClient.email) contactInfo.push(this.currentClient.email);
        if (this.currentClient.phone) contactInfo.push(this.currentClient.phone);
        
        document.getElementById('client-contact').textContent = contactInfo.join(' • ');
        
        const createdDate = new Date(this.currentClient.created_at).toLocaleDateString('ru-RU');
        document.getElementById('client-created').textContent = `Создан: ${createdDate}`;
    }

    renderBills() {
        const tbody = document.getElementById('bills-table-body');
        
        if (this.bills.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        Счетов пока нет
                    </td>
                </tr>
            `;
            return;
        }

        const billsHtml = this.bills.map(bill => this.renderBillRow(bill)).join('');
        tbody.innerHTML = billsHtml;
    }

    renderBillRow(bill) {
        const date = new Date(bill.created_at).toLocaleDateString('ru-RU');
        const period = `${bill.period_from} - ${bill.period_to}`;
        const statusText = this.getStatusText(bill.status);
        
        return `
            <tr>
                <td>${date}</td>
                <td>${period}</td>
                <td>${bill.team_name || 'Неизвестно'}</td>
                <td>${bill.buyers_count || 0}</td>
                <td>${bill.cards_count || 0}</td>
                <td>${parseFloat(bill.amount || 0).toFixed(2)} ${bill.currency || 'USD'}</td>
                <td><span class="bill-status ${bill.status}">${statusText}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.clientsModule?.viewBill(${bill.id})">
                        Просмотр
                    </button>
                </td>
            </tr>
        `;
    }

    getStatusText(status) {
        const statuses = {
            'paid': 'Оплачен',
            'pending': 'Ожидает оплаты',
            'overdue': 'Просрочен'
        };
        return statuses[status] || status;
    }

    showAddModal() {
        console.log('Opening add client modal...');
        const modal = document.getElementById('client-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    hideModal() {
        const modal = document.getElementById('client-modal');
        const form = document.getElementById('client-form');

        if (modal) {
            modal.classList.remove('show');
        }
        if (form) {
            form.reset();
        }
    }

    showCreateBillModal() {
        const modal = document.getElementById('create-bill-modal');
        
        // Заполняем список команд
        const teamSelect = document.getElementById('team-select');
        const teamsOptions = this.teams.map(team => 
            `<option value="${team.id}">${team.name}</option>`
        ).join('');
        teamSelect.innerHTML = '<option value="">Выберите команду</option>' + teamsOptions;

        // Устанавливаем текущую дату как "до"
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('period-to').value = today;

        modal.classList.add('show');
    }

    hideCreateBillModal() {
        const modal = document.getElementById('create-bill-modal');
        modal.classList.remove('show');
        
        // Очищаем форму
        document.getElementById('team-select').value = '';
        document.getElementById('period-from').value = '';
        document.getElementById('period-to').value = '';
        document.getElementById('team-summary').style.display = 'none';
        document.getElementById('send-bill-btn').disabled = true;
    }

    async onTeamSelect(teamId) {
        if (!teamId) {
            document.getElementById('team-summary').style.display = 'none';
            document.getElementById('send-bill-btn').disabled = true;
            return;
        }

        await this.updateTeamSummary();
    }

    async updateTeamSummary() {
        const teamId = document.getElementById('team-select').value;
        const fromDate = document.getElementById('period-from').value;
        const toDate = document.getElementById('period-to').value;

        if (!teamId || !fromDate || !toDate) {
            document.getElementById('send-bill-btn').disabled = true;
            return;
        }

        try {
            const response = await api.request(`/teams/${teamId}/stats?startDate=${fromDate}&endDate=${toDate}`);
            
            const buyers = response.buyers || [];
            let totalSpent = 0;
            let totalCards = 0;
            const EUR_TO_USD = 1.03;

            buyers.forEach(buyer => {
                if (buyer.currency_breakdown) {
                    Object.entries(buyer.currency_breakdown).forEach(([currency, data]) => {
                        if (currency === 'USD') {
                            totalSpent += parseFloat(data.spent || 0);
                        } else if (currency === 'EUR') {
                            totalSpent += parseFloat(data.spent || 0) * EUR_TO_USD;
                        }
                        totalCards += parseInt(data.cards_count || 0);
                    });
                }
            });

            document.getElementById('summary-buyers').textContent = buyers.length;
            document.getElementById('summary-cards').textContent = totalCards;
            document.getElementById('summary-spent').textContent = `${totalSpent.toFixed(2)} USD`;
            
            document.getElementById('team-summary').style.display = 'block';
            document.getElementById('send-bill-btn').disabled = totalSpent === 0;

        } catch (error) {
            console.error('Error loading team stats:', error);
            document.getElementById('send-bill-btn').disabled = true;
        }
    }

    async sendBill() {
        const teamId = document.getElementById('team-select').value;
        const fromDate = document.getElementById('period-from').value;
        const toDate = document.getElementById('period-to').value;
        
        const billData = {
            team_id: teamId,
            period_from: fromDate,
            period_to: toDate,
            buyers_count: parseInt(document.getElementById('summary-buyers').textContent),
            cards_count: parseInt(document.getElementById('summary-cards').textContent),
            amount: parseFloat(document.getElementById('summary-spent').textContent.replace(' USD', ''))
        };

        try {
            await api.request(`/clients/${this.currentClientId}/bills`, {
                method: 'POST',
                body: JSON.stringify(billData)
            });
            
            await this.loadBills(this.currentClientId);
            this.renderBills();
            this.hideCreateBillModal();

            notifications.success('Счет создан', 'Счет успешно отправлен клиенту');
            
        } catch (error) {
            console.error('Error sending bill:', error);
            notifications.error('Ошибка', 'Не удалось отправить счет');
        }
    }

    viewBill(billId) {
        console.log('Viewing bill ID:', billId);
        notifications.info('Просмотр счета', 'Функция просмотра в разработке');
    }

    async handleClientSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const clientData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            description: formData.get('description')
        };

        try {
            await api.request('/clients', {
                method: 'POST',
                body: JSON.stringify(clientData)
            });
            
            await this.loadClients();
            this.renderClients();
            this.hideModal();
            
            notifications.success('Клиент создан', 'Клиент успешно добавлен');
        } catch (error) {
            console.error('Error creating client:', error);
            notifications.error('Ошибка', 'Не удалось создать клиента');
        }
    }

    filterClients(searchTerm) {
        const term = searchTerm.toLowerCase();

        this.filteredClients = this.clients.filter(client =>
            client.name.toLowerCase().includes(term) ||
            (client.email && client.email.toLowerCase().includes(term)) ||
            (client.phone && client.phone.includes(term))
        );

        this.renderClients();
    }

    renderClients() {
        console.log('Rendering clients...', this.filteredClients.length);
        const container = document.getElementById('clients-container');

        if (!container) {
            console.error('Clients container not found');
            return;
        }

        if (this.filteredClients.length === 0) {
            container.innerHTML = `
                <div class="clients-empty">
                    <h3>Клиентов пока нет</h3>
                    <p>Добавьте первого клиента для начала работы</p>
                </div>
            `;
            return;
        }

        const clientsHtml = this.filteredClients.map(client => this.renderClientCard(client)).join('');
        container.innerHTML = clientsHtml;
        console.log('Clients rendered successfully');
    }

    renderClientCard(client) {
        const createdDate = new Date(client.created_at).toLocaleDateString('ru-RU');

        return `
            <div class="clients-card" data-client-id="${client.id}">
                <div class="clients-card-header">
                    <h3 class="clients-name" onclick="window.clientsModule?.openClientDetail(${client.id})" style="cursor: pointer;">${client.name}</h3>
                    <div class="clients-actions">
                        <button class="clients-action-btn edit" onclick="window.clientsModule?.editClient(${client.id})" title="Редактировать">
                            ✏️
                        </button>
                        <button class="clients-action-btn delete" onclick="window.clientsModule?.deleteClient(${client.id})" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="clients-card-body">
                    ${client.email ? `<div class="clients-info-item"><span class="label">Email:</span> ${client.email}</div>` : ''}
                    ${client.phone ? `<div class="clients-info-item"><span class="label">Телефон:</span> ${client.phone}</div>` : ''}
                    ${client.description ? `<div class="clients-info-item"><span class="label">Описание:</span> ${client.description}</div>` : ''}
                </div>
                <div class="clients-card-footer">
                    <span class="clients-created-date">Создан: ${createdDate}</span>
                </div>
            </div>
        `;
    }

    openClientDetail(clientId) {
        console.log('Opening client detail for ID:', clientId);
        this.showClientDetail(parseInt(clientId));
    }

    editClient(clientId) {
        console.log('Editing client ID:', clientId);
        notifications.info('Редактирование', 'Функция редактирования в разработке');
    }

    deleteClient(clientId) {
        if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;

        this.clients = this.clients.filter(client => client.id !== clientId);
        this.filteredClients = this.filteredClients.filter(client => client.id !== clientId);

        this.renderClients();
        notifications.success('Клиент удален', 'Клиент успешно удален');
    }

    destroy() {
        console.log('Destroying clients module...');
    }
}

window.ClientsModule = ClientsModule;