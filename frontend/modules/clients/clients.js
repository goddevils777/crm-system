// Модуль списка клиентов - ТОЛЬКО список, БЕЗ детальных страниц
class ClientsModule {
    constructor() {
        this.clients = [];
        this.filteredClients = [];
        this.currentView = localStorage.getItem('clients_view') || 'grid';
        this.currentSort = localStorage.getItem('clients_sort') || 'created_desc';

        console.log('ClientsModule initialized');
        this.loadStyles();
        this.init();
    }
    async init() {
        console.log('Initializing clients module...');

        try {
            await this.loadClients();
            this.setupEventListeners();
            this.renderClients();

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
    }

    setupEventListeners() {
        // Кнопка добавления клиента
        const addBtn = document.getElementById('add-client-btn');
        addBtn?.addEventListener('click', () => this.showModal());

        // Поиск клиентов
        const searchInput = document.getElementById('search-clients');
        searchInput?.addEventListener('input', (e) => this.filterClients(e.target.value));

        // Переключатель вида
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });

        // Сортировка
        const sortSelect = document.getElementById('sort-clients');
        sortSelect?.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            localStorage.setItem('clients_sort', this.currentSort);
            this.sortClients();
            this.renderClients();
        });

        // Модальное окно
        const modal = document.getElementById('client-modal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');
        const form = document.getElementById('client-form');

        closeBtn?.addEventListener('click', () => this.hideModal());
        cancelBtn?.addEventListener('click', () => this.hideModal());
        form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Закрытие по клику вне модального окна
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal();
        });
    }

    async loadClients() {
        try {
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

    showModal() {
        const modal = document.getElementById('client-modal');
        modal?.classList.add('show');

        // Сброс формы
        const form = document.getElementById('client-form');
        form?.reset();
    }

    hideModal() {
        const modal = document.getElementById('client-modal');
        modal?.classList.remove('show');
    }

    async handleSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const clientData = {
            name: formData.get('name')?.trim(),
            email: formData.get('email')?.trim() || null,
            phone: formData.get('phone')?.trim() || null,
            description: formData.get('description')?.trim() || null
        };

        if (!clientData.name) {
            notifications.error('Ошибка', 'Название клиента обязательно');
            return;
        }

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

        // Устанавливаем правильное состояние переключателя
        this.setupViewToggle();

        // Сортируем перед отображением
        this.sortClients();

        // Переключаем видимость контейнеров
        const gridContainer = document.getElementById('clients-container');
        const tableContainer = document.getElementById('clients-table-container');

        if (this.currentView === 'table') {
            gridContainer.style.display = 'none';
            tableContainer.style.display = 'block';
            this.renderTable();
        } else {
            gridContainer.style.display = 'grid';
            tableContainer.style.display = 'none';
            this.renderGrid();
        }

        console.log('Clients rendered successfully');
    }

    renderGrid() {
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
    }

    renderTable() {
        const tbody = document.getElementById('clients-table-body');

        if (!tbody) {
            console.error('Clients table body not found');
            return;
        }

        if (this.filteredClients.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="clients-empty">
                        <h3>Клиентов пока нет</h3>
                        <p>Добавьте первого клиента для начала работы</p>
                    </div>
                </td>
            </tr>
        `;
            return;
        }

        const rowsHtml = this.filteredClients.map(client => this.renderClientRow(client)).join('');
        tbody.innerHTML = rowsHtml;
    }

    renderClientRow(client) {
        const createdDate = new Date(client.created_at).toLocaleDateString('ru-RU');

        // Контакты
        const contacts = [];
        if (client.email) contacts.push(client.email);
        if (client.phone) contacts.push(client.phone);
        const contactsText = contacts.join(', ') || 'Не указаны';

        return `
        <tr>
            <td>
                <div class="client-name-cell">
                    <span class="client-name-link" onclick="window.clientsModule?.openClientDetail(${client.id})" style="cursor: pointer; color: var(--primary-color); font-weight: 500;">
                        ${client.name}
                    </span>
                </div>
            </td>
            <td>
                <div class="client-contacts">
                    ${contactsText}
                </div>
            </td>
            <td>
                <div class="client-description">
                    ${client.description || 'Нет описания'}
                </div>
            </td>
            <td>
                <span class="client-date">${createdDate}</span>
            </td>
            <td>
<div class="table-actions">
    <button class="table-action-btn edit" onclick="window.clientsModule?.editClient(${client.id})" title="Редактировать">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-1.9 11.1 1.5 21.9 9.4 29.8 6.6 6.4 15.6 9.9 25.3 9.9z"/>
        </svg>
    </button>
    <button class="table-action-btn delete" onclick="window.clientsModule?.deleteClient(${client.id})" title="Удалить">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32z"/>
        </svg>
    </button>
</div>
            </td>
        </tr>
    `;
    }

    renderClientCard(client) {
        const createdDate = new Date(client.created_at).toLocaleDateString('ru-RU');

        return `
            <div class="clients-card" data-client-id="${client.id}">
                <div class="clients-card-header">
                    <h3 class="clients-name" onclick="window.clientsModule?.openClientDetail(${client.id})" style="cursor: pointer;">${client.name}</h3>

<div class="clients-actions">
    <button class="clients-action-btn edit" onclick="window.clientsModule?.editClient(${client.id})" title="Редактировать">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-1.9 11.1 1.5 21.9 9.4 29.8 6.6 6.4 15.6 9.9 25.3 9.9z"/>
        </svg>
    </button>
    <button class="clients-action-btn delete" onclick="window.clientsModule?.deleteClient(${client.id})" title="Удалить">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 523c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-523H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32z"/>
        </svg>
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

    // Переход к детальной странице клиента - КАК В ДРУГИХ МОДУЛЯХ
    async openClientDetail(clientId) {
        console.log('Opening client detail for ID:', clientId);
        localStorage.setItem('current_client_detail', clientId);
        window.location.hash = `#client/${clientId}`;

        await this.loadClientDetailPage(clientId);
    }

    async loadClientDetailPage(clientId) {
        try {
            // Сначала скрываем текущий контент
            const contentArea = document.getElementById('content-area');
            contentArea.style.transition = 'opacity 0.2s ease';
            contentArea.style.opacity = '0';

            // Показываем лоадер
            setTimeout(() => {
                contentArea.innerHTML = `
                    <div class="module-loader">
                        <div class="loader-spinner"></div>
                        <p>Загрузка клиента...</p>
                    </div>
                `;
                contentArea.style.opacity = '1';
            }, 50);

            // Загружаем CSS стили сначала
            if (!document.querySelector('link[href*="client-detail.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `modules/clients/client-detail.css?v=${Date.now()}`;
                document.head.appendChild(link);
            }

            // Загружаем HTML детальной страницы
            const response = await fetch('modules/clients/client-detail.html');
            const html = await response.text();

            // Загружаем скрипт детальной страницы если не загружен
            if (!window.ClientDetailModule) {
                const script = document.createElement('script');
                script.src = `modules/clients/client-detail.js?v=${Date.now()}`;
                document.head.appendChild(script);

                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }

            // Ждем загрузки стилей
            await new Promise(resolve => setTimeout(resolve, 100));

            // Скрываем перед вставкой нового контента
            contentArea.style.opacity = '0';

            // Вставляем HTML
            setTimeout(() => {
                contentArea.innerHTML = html;

                // Показываем готовый контент
                setTimeout(() => {
                    contentArea.style.opacity = '1';

                    // Инициализируем детальную страницу
                    if (window.ClientDetailModule) {
                        window.clientDetailModule = new window.ClientDetailModule(clientId);
                    } else {
                        console.error('ClientDetailModule не загружен');
                        notifications.error('Ошибка', 'Не удалось загрузить детальную страницу');
                    }
                }, 50);
            }, 100);

        } catch (error) {
            console.error('Ошибка загрузки детальной страницы клиента:', error);
            notifications.error('Ошибка', 'Не удалось загрузить страницу клиента');
        }
    }

    editClient(clientId) {
        console.log('Editing client ID:', clientId);
        notifications.info('Редактирование', 'Функция редактирования в разработке');
    }

    async deleteClient(clientId) {
        const confirmed = await confirmDelete('Вы уверены, что хотите удалить этого клиента?');
        if (!confirmed) return;

        try {
            await api.request(`/clients/${clientId}`, {
                method: 'DELETE'
            });

            await this.loadClients();
            this.renderClients();
            notifications.success('Клиент удален', 'Клиент успешно удален');
        } catch (error) {
            console.error('Error deleting client:', error);
            notifications.error('Ошибка', 'Не удалось удалить клиента');
        }
    }

    switchView(viewType) {
        this.currentView = viewType;
        localStorage.setItem('clients_view', viewType);

        // Обновляем активную кнопку
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });

        this.renderClients();
    }



    sortClients() {
        this.filteredClients.sort((a, b) => {
            switch (this.currentSort) {
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'created_asc':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'created_desc':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
    }
    setupViewToggle() {
        // Устанавливаем активный вид при загрузке
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === this.currentView);
        });

        // Устанавливаем значение сортировки
        const sortSelect = document.getElementById('sort-clients');
        if (sortSelect) {
            sortSelect.value = this.currentSort;
        }
    }

    destroy() {
        console.log('Destroying clients module...');
    }
}

window.ClientsModule = ClientsModule;