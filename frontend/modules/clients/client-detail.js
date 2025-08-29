// Модуль детальной страницы клиента - ОТДЕЛЬНЫЙ модуль
class ClientDetailModule {
    constructor(clientId) {
        this.clientId = parseInt(clientId);
        this.client = null;
        this.teams = [];
        this.bills = [];

        console.log('ClientDetailModule initialized for client ID:', this.clientId);
        this.init();
    }

    async init() {
        console.log('Initializing client detail module...');

        try {
            await this.loadClient();
            await this.loadTeams();
            await this.loadBills();
            this.renderHTML();
            this.setupEventListeners();
            this.renderClientInfo();
            this.renderBills();

            console.log('Client detail module initialization complete');
        } catch (error) {
            console.error('Error initializing client detail:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные клиента');
        }
    }


    renderHTML() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = this.getClientDetailHTML();
    }

    getClientDetailHTML() {
        return `
            <div class="client-detail-container">
                <div class="client-detail-header">
                    <button class="btn btn-secondary back-btn" id="back-to-clients-btn">
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
        `;
    }

    setupEventListeners() {
        // Кнопка "Назад к клиентам"
        const backBtn = document.getElementById('back-to-clients-btn');
        backBtn?.addEventListener('click', () => this.goBackToClients());

        // Кнопка создания счета
        const createBillBtn = document.getElementById('create-bill-btn');
        createBillBtn?.addEventListener('click', () => this.createBill());
    }

    async loadClient() {
        try {
            const response = await api.request(`/clients/${this.clientId}`);
            this.client = response.client;
            console.log('Client loaded:', this.client);
        } catch (error) {
            console.error('Error loading client:', error);
            // Fallback
            this.client = {
                id: this.clientId,
                name: 'Клиент не найден',
                email: null,
                phone: null,
                created_at: new Date().toISOString()
            };
        }
    }

    async loadBills() {
        try {
            const response = await api.request(`/clients/${this.clientId}/bills`);
            this.bills = response.bills || [];
            console.log('Bills loaded:', this.bills.length);
        } catch (error) {
            console.error('Error loading bills:', error);
            this.bills = [];
        }
    }

    async loadTeams() {
        try {
            const response = await api.request('/teams');
            this.teams = response.teams || [];
            console.log('Teams loaded:', this.teams.length);
        } catch (error) {
            console.error('Error loading teams:', error);
            this.teams = [];
        }
    }

    renderClientInfo() {
        if (!this.client) return;

        // Название клиента
        const nameElement = document.getElementById('client-name');
        if (nameElement) {
            nameElement.textContent = this.client.name;
        }

        // Контактная информация
        const contactElement = document.getElementById('client-contact');
        if (contactElement) {
            const contacts = [];
            if (this.client.email) contacts.push(this.client.email);
            if (this.client.phone) contacts.push(this.client.phone);
            contactElement.textContent = contacts.join(' • ') || 'Контакты не указаны';
        }

        // Дата создания
        const createdElement = document.getElementById('client-created');
        if (createdElement) {
            const createdDate = new Date(this.client.created_at).toLocaleDateString('ru-RU');
            createdElement.textContent = `Создан: ${createdDate}`;
        }
    }

    renderBills() {
        const tbody = document.getElementById('bills-table-body');
        if (!tbody) return;

        if (this.bills.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="no-bills">
                            <h4>Счетов пока нет</h4>
                            <p>Сформируйте первый счет для клиента</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const billsHtml = this.bills.map(bill => this.renderBillRow(bill)).join('');
        tbody.innerHTML = billsHtml;
    }

    renderBillRow(bill) {
        const createdDate = new Date(bill.created_at).toLocaleDateString('ru-RU');
        const statusClass = bill.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = bill.status === 'paid' ? 'Оплачен' : 'Ожидает оплаты';

        // Формируем период
        let periodText = '-';
        if (bill.period_from && bill.period_to) {
            const fromDate = new Date(bill.period_from).toLocaleDateString('ru-RU');
            const toDate = new Date(bill.period_to).toLocaleDateString('ru-RU');
            periodText = `${fromDate} - ${toDate}`;
        }

        return `
        <tr>
            <td>${createdDate}</td>
            <td>${periodText}</td>
            <td>${bill.team_name || '-'}</td>
            <td>${parseInt(bill.buyers_count) || 0}</td>
            <td>${parseInt(bill.cards_count) || 0}</td>
            <td>${bill.amount ? `$${parseFloat(bill.amount).toFixed(2)}` : '$0.00'}</td>
            <td>
    <div class="status-dropdown-container" style="position: relative;">
        <span class="status-badge ${statusClass} clickable-status" 
              onclick="window.clientDetailModule?.toggleStatusDropdown(${bill.id}, this)">
            ${statusText}
            <span class="status-arrow">▼</span>
        </span>
        <div class="status-dropdown" id="status-dropdown-${bill.id}" style="display: none;">
            <div class="status-option ${bill.status === 'pending' ? 'current' : ''}" 
                 onclick="window.clientDetailModule?.changeStatus(${bill.id}, 'pending', this)">
                Ожидает оплаты
            </div>
            <div class="status-option ${bill.status === 'paid' ? 'current' : ''}" 
                 onclick="window.clientDetailModule?.changeStatus(${bill.id}, 'paid', this)">
                Оплачен
            </div>
        </div>
    </div>
</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="window.clientDetailModule?.generateClientLink(${bill.id})" title="Ссылка для клиента">
                    <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
                        <path d="M574 665.4a8.03 8.03 0 0 0-11.3 0L446.5 781.6c-53.8 53.8-144.6 59.5-204 0-59.5-59.5-53.8-150.2 0-204l116.2-116.2c3.1-3.1 3.1-8.2 0-11.3l-39.8-39.8a8.03 8.03 0 0 0-11.3 0L191.4 526.5c-84.6 84.6-84.6 221.5 0 306s221.5 84.6 306 0l116.2-116.2c3.1-3.1 3.1-8.2 0-11.3L574 665.4zm258.6-474c-84.6-84.6-221.5-84.6-306 0L410.3 307.6a8.03 8.03 0 0 0 0 11.3l39.7 39.7c3.1 3.1 8.2 3.1 11.3 0l116.2-116.2c53.8-53.8 144.6-59.5 204 0 59.5 59.5 53.8 150.2 0 204L665.3 562.6a8.03 8.03 0 0 0 0 11.3l39.8 39.8c3.1 3.1 8.2 3.1 11.3 0l116.2-116.2c84.5-84.6 84.5-221.5 0-306.1z"/>
                    </svg>
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.clientDetailModule?.deleteBill(${bill.id})" title="Удалить">
                    <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
                        <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32z"/>
                    </svg>
                </button>
            </td>
        </tr>
    `;
    }

    generateClientLink(billId) {
        const link = `${window.location.origin}/bill/${billId}`;
        navigator.clipboard.writeText(link);
        notifications.success('Ссылка скопирована', 'Ссылка на счет скопирована в буфер обмена');
    }

    toggleStatusDropdown(billId, element) {
    // Закрываем все открытые dropdown
    document.querySelectorAll('.status-dropdown').forEach(dropdown => {
        if (dropdown.id !== `status-dropdown-${billId}`) {
            dropdown.style.display = 'none';
        }
    });
    
    // Переключаем текущий dropdown
    const dropdown = document.getElementById(`status-dropdown-${billId}`);
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

async changeStatus(billId, newStatus, element) {
    try {
        await api.request(`/clients/${this.clientId}/bills/${billId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        // Перезагружаем счета
        await this.loadBills();
        this.renderBills();
        
        const statusText = newStatus === 'paid' ? 'Оплачен' : 'Ожидает оплаты';
        notifications.success('Статус изменен', `Статус счета изменен на "${statusText}"`);
        
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        notifications.error('Ошибка', 'Не удалось изменить статус счета');
    }
}

    async deleteBill(billId) {
        const confirmed = await confirmDelete('Вы уверены, что хотите удалить этот счет?');
        if (!confirmed) return;

        try {
            await api.request(`/clients/${this.clientId}/bills/${billId}`, { method: 'DELETE' });
            await this.loadBills();
            this.renderBills();
            notifications.success('Счет удален', 'Счет успешно удален');
        } catch (error) {
            console.error('Error deleting bill:', error);
            notifications.error('Ошибка', 'Не удалось удалить счет');
        }
    }

    goBackToClients() {
        console.log('Going back to clients list');
        localStorage.removeItem('current_client_detail');
        window.location.hash = '#clients';
        window.app.loadModule('clients');
    }

    createBill() {
        console.log('Creating bill for client:', this.clientId);
        notifications.info('Создание счета', 'Функция формирования счета в разработке');
    }

    viewBill(billId) {
        console.log('Viewing bill:', billId);
        notifications.info('Просмотр счета', 'Функция просмотра счета в разработке');
    }

    downloadBill(billId) {
        console.log('Downloading bill:', billId);
        notifications.info('Скачивание', 'Функция скачивания счета в разработке');
    }

    destroy() {
        console.log('Destroying client detail module...');
        localStorage.removeItem('current_client_detail');
    }
}

window.ClientDetailModule = ClientDetailModule;