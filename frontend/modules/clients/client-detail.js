class ClientDetailModule {
    constructor(clientId) {
        this.clientId = parseInt(clientId);
        this.client = null;
        this.teams = [];
        this.bills = [];
        
        console.log('ClientDetailModule initialized for client ID:', this.clientId);
        this.loadStyles();
        this.init();
    }

    async init() {
        try {
            await this.loadClient();
            await this.loadTeams();
            await this.loadBills();
            this.setupEventListeners();
            this.renderClientInfo();
            this.renderBills();
        } catch (error) {
            console.error('Error initializing client detail:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные клиента');
        }
    }

    loadStyles() {
        const timestamp = Date.now();
        
        const detailCss = document.createElement('link');
        detailCss.rel = 'stylesheet';
        detailCss.href = `modules/clients/client-detail.css?v=${timestamp}`;
        
        if (!document.querySelector('link[href*="client-detail.css"]')) {
            document.head.appendChild(detailCss);
        }
    }

async loadClient() {
    try {
        const response = await api.request(`/clients/${this.clientId}`);
        this.client = response.client;
    } catch (error) {
        console.error('Error loading client:', error);
        // Fallback
        this.client = {
            id: this.clientId,
            name: 'Клиент не найден',
            created_at: new Date().toISOString()
        };
    }
}

async loadBills() {
    try {
        const response = await api.request(`/clients/${this.clientId}/bills`);
        this.bills = response.bills || [];
    } catch (error) {
        console.error('Error loading bills:', error);
        this.bills = [];
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


    setupEventListeners() {
        // Кнопка создания счета
        const createBillBtn = document.getElementById('create-bill-btn');
        createBillBtn?.addEventListener('click', () => this.showCreateBillModal());

        // Модальное окно создания счета
        this.setupModalEvents();

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
        document.getElementById('client-name').textContent = this.client.name;
        
        const contactInfo = [];
        if (this.client.email) contactInfo.push(this.client.email);
        if (this.client.phone) contactInfo.push(this.client.phone);
        
        document.getElementById('client-contact').textContent = contactInfo.join(' • ');
        
        const createdDate = new Date(this.client.created_at).toLocaleDateString('ru-RU');
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
        const date = new Date(bill.date).toLocaleDateString('ru-RU');
        const statusText = this.getStatusText(bill.status);
        
        return `
            <tr>
                <td>${date}</td>
                <td>${bill.period}</td>
                <td>${bill.team_name}</td>
                <td>${bill.buyers_count}</td>
                <td>${bill.cards_count}</td>
                <td>${bill.amount.toFixed(2)} ${bill.currency}</td>
                <td><span class="bill-status ${bill.status}">${statusText}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.clientDetailModule?.viewBill(${bill.id})">
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
            // Получаем данные команды за период
            const response = await api.request(`/teams/${teamId}/stats?startDate=${fromDate}&endDate=${toDate}`);
            
            // Подсчитываем статистику
            const buyers = response.buyers || [];
            let totalSpent = 0;
            let totalCards = 0;
            const EUR_TO_USD = 1.03;

            buyers.forEach(buyer => {
                const usdSpent = parseFloat(buyer.usd_spent || 0);
                const eurSpent = parseFloat(buyer.eur_spent || 0);
                const usdCards = parseInt(buyer.usd_cards_count || 0);
                const eurCards = parseInt(buyer.eur_cards_count || 0);

                totalSpent += usdSpent + (eurSpent * EUR_TO_USD);
                totalCards += usdCards + eurCards;
            });

            // Показываем сводку
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
        await api.request(`/clients/${this.clientId}/bills`, {
            method: 'POST',
            body: JSON.stringify(billData)
        });
        
        // Перезагружаем счета
        await this.loadBills();
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

    destroy() {
        console.log('Destroying client detail module...');
    }
}

window.ClientDetailModule = ClientDetailModule;