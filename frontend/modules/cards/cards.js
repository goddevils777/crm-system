// Проверяем существует ли уже класс и не объявляем повторно
if (typeof window.CardsModule === 'undefined') {

  // Модуль управления картами
  class CardsModule {
    constructor() {
      this.cards = [];
      this.filteredCards = [];
      this.currentView = localStorage.getItem('cards_view') || 'grid';
      this.currentSort = localStorage.getItem('cards_sort') || 'created_desc';
      this.init();
    }

    async init() {
      console.log('CardsModule init started');
      this.loadStyles();
      this.setupEventListeners();

      try {
        await this.loadCards();
        await this.loadTeams();
        this.setupTeamsFilter();
        this.sortCards();
        this.setupViewToggle();

        // Проверяем нужно ли восстановить детальную страницу
        this.checkRestoreCardDetail();

        this.renderCards();

        // ПЕРЕНЕСЕНО В КОНЕЦ: Настройка действий в зависимости от роли
        await this.setupHeaderActions();

        console.log('CardsModule init completed');
      } catch (error) {
        console.error('Error in CardsModule init:', error);
        notifications.error('Ошибка загрузки', 'Не удалось загрузить модуль карт');
      }
    }

    // НОВАЯ функция для настройки действий по ролям
    async setupHeaderActions() {
      console.log('=== SETUP HEADER ACTIONS ===');
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      console.log('User role:', userData.role);

      const addBtn = document.getElementById('add-card-btn');
      console.log('Add button found:', !!addBtn);

      if (addBtn) {
        if (userData.role === 'buyer') {
          console.log('Hiding add button for buyer');
          addBtn.style.display = 'none';
        } else {
          console.log('Showing add button for admin/manager');
          addBtn.style.display = 'inline-flex';
        }
      } else {
        console.error('Add button not found in DOM');
      }
    }

    async loadStatuses() {
      try {
        const response = await api.request('/cards/statuses');
        this.availableStatuses = response.statuses;
        console.log('Available statuses loaded:', this.availableStatuses);
      } catch (error) {
        console.error('Error loading statuses:', error);
        // Fallback статусы если API недоступно
        this.availableStatuses = {
          'active': 'Активна (в работе)',
          'blocked': 'В блоке',
          'reissue': 'Перевыпуск',
          'error': 'Ошибка',
          'rebind': 'Переподвязать',
          'not_issued': 'Не выдана',
          'not_spinning': 'Не крутит'
        };
      }
    }

    checkRestoreCardDetail() {
      // Проверяем действительно ли нужно восстанавливать детальную страницу
      const hash = window.location.hash;
      const currentCardId = localStorage.getItem('current_card_detail');

      console.log('checkRestoreCardDetail called');
      console.log('- Hash:', hash);
      console.log('- Saved card ID:', currentCardId);
      console.log('- Should restore:', hash && hash.startsWith('#card/'));

      // Восстанавливаем ТОЛЬКО если URL содержит #card/
      if (hash && hash.startsWith('#card/')) {
        const cardIdFromHash = hash.replace('#card/', '');
        console.log('Restoring card detail for ID:', cardIdFromHash);
        this.openCardDetail(cardIdFromHash);
      } else {
        // Если хеша нет - очищаем сохраненное состояние
        console.log('No card hash found, clearing saved state');
        localStorage.removeItem('current_card_detail');
      }
    }

    loadStyles() {
      const timestamp = Date.now();

      const cardsCss = document.createElement('link');
      cardsCss.rel = 'stylesheet';
      cardsCss.href = `modules/cards/cards.css?v=${timestamp}`;

      const modalCss = document.createElement('link');
      modalCss.rel = 'stylesheet';
      modalCss.href = `css/modal.css?v=${timestamp}`;

      if (!document.querySelector('link[href*="modules/cards/cards.css"]')) {
        document.head.appendChild(cardsCss);
      }
      if (!document.querySelector('link[href*="css/modal.css"]')) {
        document.head.appendChild(modalCss);
      }
    }

    setupEventListeners() {
      const addBtn = document.getElementById('add-card-btn');
      addBtn?.addEventListener('click', () => this.showModal());

      const searchInput = document.getElementById('search-cards');
      searchInput?.addEventListener('input', (e) => this.filterCards());

      const statusFilter = document.getElementById('status-filter');
      statusFilter?.addEventListener('change', (e) => this.filterCards());

      // Новые обработчики для фильтра дат
      const dateFrom = document.getElementById('date-from');
      dateFrom?.addEventListener('change', () => this.filterCardsByPeriod());

      const dateTo = document.getElementById('date-to');
      dateTo?.addEventListener('change', () => this.filterCardsByPeriod());

      // Период фильтр
      const periodFilter = document.getElementById('period-filter');
      periodFilter?.addEventListener('change', (e) => {
        this.applyPeriodFilter(e.target.value);
      });

      this.setupModalEvents();
    }


    setupViewToggle() {
      console.log('Setting up view toggle, current view:', this.currentView);

      const viewBtns = document.querySelectorAll('.view-btn');
      console.log('Found view buttons:', viewBtns.length);

      if (viewBtns.length === 0) {
        console.error('View buttons not found in DOM');
        setTimeout(() => this.setupViewToggle(), 100);
        return;
      }

      viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.currentView);
      });

      const gridContainer = document.getElementById('cards-container');
      const tableContainer = document.getElementById('cards-table-container');

      if (!gridContainer || !tableContainer) {
        console.error('View containers not found in DOM');
        setTimeout(() => this.setupViewToggle(), 100);
        return;
      }

      this.switchView(this.currentView);

      viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          this.switchView(view);
          viewBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      const sortSelect = document.getElementById('sort-cards');
      sortSelect?.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        localStorage.setItem('cards_sort', e.target.value);
        this.sortCards();
        this.renderCards();
      });
    }

    switchView(view) {
      this.currentView = view;
      localStorage.setItem('cards_view', view);

      const gridContainer = document.getElementById('cards-container');
      const tableContainer = document.getElementById('cards-table-container');

      if (view === 'grid') {
        gridContainer.style.display = 'grid';
        tableContainer.style.display = 'none';
      } else {
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';
      }

      this.renderCards();
    }

    sortCards() {
      this.filteredCards.sort((a, b) => {
        switch (this.currentSort) {
          case 'created_desc':
            return new Date(b.created_at) - new Date(a.created_at);
          case 'created_asc':
            return new Date(a.created_at) - new Date(b.created_at);
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'balance_desc':
            return (b.balance || 0) - (a.balance || 0);
          case 'balance_asc':
            return (a.balance || 0) - (b.balance || 0);
          case 'spent_desc':
            return (b.total_spent_calculated || 0) - (a.total_spent_calculated || 0);
          case 'spent_asc':
            return (a.total_spent_calculated || 0) - (b.total_spent_calculated || 0);
          default:
            return 0;
        }
      });
    }

    renderCards() {
      console.log('renderCards called, current view:', this.currentView);
      this.sortCards();

      if (this.currentView === 'grid') {
        this.renderGridView();
      } else if (this.currentView === 'table') {
        this.renderTableView();
      }
    }

    renderGridView() {
      const container = document.getElementById('cards-container');
      if (!container) return;

      if (this.filteredCards.length === 0) {
        container.innerHTML = `
          <div class="cards-empty">
            <h3>Карты не найдены</h3>
            <p>Попробуйте изменить параметры поиска</p>
          </div>
        `;
        return;
      }

      container.innerHTML = this.filteredCards.map(card => this.renderCard(card)).join('');
    }

    renderTableView() {
      const tbody = document.getElementById('cards-table-body');
      if (!tbody) {
        console.error('Table body not found!');
        return;
      }

      if (this.filteredCards.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
              <div>
                <h4 style="margin-bottom: 8px;">Карты не найдены</h4>
                <p>Попробуйте изменить параметры поиска</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const rows = this.filteredCards.map(card => this.renderTableRow(card));
      tbody.innerHTML = rows.join('');
    }

    renderTableRow(card) {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isReadOnly = userData.role === 'buyer';

      const statusClass = card.status || 'active';
      const statusText = this.getStatusText(card.status);
      const totalSpent = card.total_spent_calculated || 0;
      const commissionPaid = card.commission_paid || 0;
      const totalTopUp = card.total_top_up || 0;
      const timeInfo = this.calculateTimeSinceTransaction(card.last_transaction_date);

      // НОВОЕ: Кнопки действий только для админов/менеджеров
      const actionButtons = isReadOnly ? '<div class="table-actions">—</div>' : `
    <div class="table-actions">
      <button class="table-action-btn edit" title="Редактировать" onclick="window.cardsModule?.editCard(${card.id})">
        ✏️
      </button>
      <button class="table-action-btn delete" title="Удалить" onclick="window.cardsModule?.deleteCard(${card.id})">
        ×
      </button>
    </div>
  `;

      return `
    <tr class="${timeInfo.days >= 3 ? 'warning-row' : ''}" data-card-id="${card.id}">
        <td title="${card.name}">
            <a href="#" class="card-name-link" onclick="window.cardsModule?.openCardDetail(${card.id}); return false;">
                ${card.name}
            </a>
        </td>
        <td>
            <span class="table-status ${statusClass}">${statusText}</span>
            ${timeInfo.days >= 3 ? `<br><small style="color: var(--error-color);">⚠️ ${timeInfo.text}</small>` : ''}
        </td>
        <td>${card.currency}</td>
        <td>${card.balance || 0} ${card.currency}</td>
        <td>${totalSpent} ${card.currency}</td>
        <td>${totalTopUp} ${card.currency}</td>
        <td title="${card.team_name || ''}">${card.team_name || '—'}</td>
        <td title="${card.buyer_name || ''}">${card.buyer_name || '—'}</td>
        <td>${new Date(card.created_at).toLocaleDateString()}</td>
        <td>${actionButtons}</td>
    </tr>
  `;
    }

    renderCard(card) {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const isReadOnly = userData.role === 'buyer';

      const statusClass = card.status || 'active';
      const statusText = this.getStatusText(card.status);
      const totalSpent = card.total_spent_calculated || 0;
      const commissionPaid = card.commission_paid || 0;
      const totalTopUp = card.total_top_up || 0;
      const balance = card.balance || 0;
      const timeInfo = this.calculateTimeSinceTransaction(card.last_transaction_date);

      // НОВОЕ: Кнопки действий только для админов/менеджеров  
      const actionButtons = isReadOnly ? '' : `
    <div class="card-actions">
      <button class="card-action-btn edit" onclick="window.cardsModule?.editCard(${card.id})" title="Редактировать карту">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
          <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-.4 2.2.1 4.5 1.4 6.2.9 1.2 2.2 1.9 3.8 1.9z"/>
        </svg>
      </button>
      <button class="card-action-btn delete" onclick="window.cardsModule?.deleteCard(${card.id})" title="Удалить карту">
        <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
          <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
        </svg>
      </button>
    </div>
  `;

      return `
    <div class="card-item ${timeInfo.days >= 3 ? 'warning-card' : ''}" data-card-id="${card.id}">
        ${actionButtons}
        <div class="card-top">
            <div class="card-header">
                <h3 class="card-title">
                    <a href="#" onclick="window.cardsModule?.openCardDetail(${card.id}); return false;" style="color: inherit; text-decoration: none;">
                        ${card.name}
                    </a>
                </h3>
            </div>
            <div class="card-currency-status">💳 ${card.currency} • • • <span class="card-status ${statusClass}">${statusText}</span></div>
        </div>
          <div class="card-stats">
              <div class="stat-item">
                  <div class="stat-label">Баланс</div>
                  <div class="stat-value ${balance > 0 ? 'positive' : ''}">${balance} ${card.currency}</div>
              </div>
              <div class="stat-item">
                  <div class="stat-label">Скручено</div>
                  <div class="stat-value ${totalSpent > 0 ? 'warning' : ''}">${totalSpent} ${card.currency}</div>
              </div>
              <div class="stat-item">
                  <div class="stat-label">Пополнено</div>
                  <div class="stat-value">${totalTopUp} ${card.currency}</div>
              </div>
          </div>
        <div class="card-body">
            <div class="card-info">
                ${card.team_name ? `
                <div class="card-info-item">
                    <span class="card-info-label">Команда</span>
                    <span class="card-info-value">${card.team_name}</span>
                </div>
                ` : ''}
                ${card.buyer_name ? `
                <div class="card-info-item">
                    <span class="card-info-label">Баер</span>
                    <span class="card-info-value">${card.buyer_name}</span>
                </div>
                ` : ''}
                ${card.full_name ? `
                <div class="card-info-item">
                    <span class="card-info-label">Владелец</span>
                    <span class="card-info-value">${card.full_name}</span>
                </div>
                ` : ''}
                ${card.contractor_name ? `
                <div class="card-info-item">
                    <span class="card-info-label">Подрядчик</span>
                    <span class="card-info-value">${card.contractor_name}</span>
                </div>
                ` : ''}
                ${timeInfo.days >= 3 ? `
                <div class="card-info-item warning">
                    <span class="card-info-label">⚠️ Без операций</span>
                    <span class="card-info-value">${timeInfo.text}</span>
                </div>
                ` : ''}
            </div>
        </div>
        <div class="card-footer">
            <div class="card-created">📅 ${new Date(card.created_at).toLocaleDateString()}</div>
            <div class="card-id">ID: ${card.id}</div>
        </div>
    </div>
  `;
    }

    setupModalEvents() {
      const modal = document.getElementById('card-modal');
      const closeBtn = modal?.querySelector('.modal-close');
      const cancelBtn = modal?.querySelector('.modal-cancel');
      const form = document.getElementById('card-form');

      closeBtn?.addEventListener('click', () => this.hideModal());
      cancelBtn?.addEventListener('click', () => this.hideModal());

      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.hideModal();
      });

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCardSubmit(e);
      });

      const tabBtns = modal?.querySelectorAll('.tab-btn');
      const tabContents = modal?.querySelectorAll('.tab-content');

      tabBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetTab = btn.dataset.tab;
          tabBtns.forEach(b => b.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          modal.querySelector(`[data-tab="${targetTab}"].tab-content`)?.classList.add('active');
        });
      });
    }

    async loadCards() {
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        // НОВОЕ: Для баеров загружаем только их карты
        let url = '/cards';
        if (userData.role === 'buyer') {
          // Получаем ID баера из таблицы team_buyers по user_id
          const buyerResponse = await api.request('/auth/buyer-info');
          if (buyerResponse.buyer_id) {
            url = `/cards?buyer_id=${buyerResponse.buyer_id}`;
          }
        }

        const response = await api.request(url);
        this.cards = response.cards || [];
        this.filteredCards = [...this.cards];
      } catch (error) {
        console.error('Ошибка загрузки карт:', error);
        notifications.error('Ошибка', 'Не удалось загрузить карты');
      }
    }

    filterCards() {
      const searchTerm = document.getElementById('search-cards')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('status-filter')?.value || '';
      const selectedTeams = this.getSelectedTeams();

      // ИЗМЕНЕНИЕ: Проверяем активен ли фильтр по дате
      const dateFrom = document.getElementById('date-from')?.value;
      const dateTo = document.getElementById('date-to')?.value;

      // Если активен фильтр по дате - вызываем фильтрацию по периоду
      if (dateFrom || dateTo) {
        this.filterCardsByPeriod();
        return;
      }

      // Обычная фильтрация без периода
      this.filteredCards = this.cards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusFilter || card.status === statusFilter;

        let matchesTeam = false;
        if (selectedTeams.all) {
          matchesTeam = true;
        } else {
          if (selectedTeams.teamIds.length > 0 && selectedTeams.teamIds.includes(card.team_id)) {
            matchesTeam = true;
          }
          if (selectedTeams.includeNoTeam && (!card.team_id || card.team_id === null)) {
            matchesTeam = true;
          }
        }

        return matchesSearch && matchesStatus && matchesTeam;
      });

      this.renderCards();
    }

    async filterCardsByPeriod() {
      const dateFrom = document.getElementById('date-from')?.value;
      const dateTo = document.getElementById('date-to')?.value;

      // Если обе даты пустые - показываем обычные данные
      if (!dateFrom && !dateTo) {
        this.renderCards();
        return;
      }

      // Если выбрана только дата "до" - ищем только за этот день
      let fromDate, toDate;
      if (!dateFrom && dateTo) {
        fromDate = dateTo;
        toDate = dateTo;
      } else if (dateFrom && !dateTo) {
        fromDate = dateFrom;
        toDate = new Date().toISOString().split('T')[0];
      } else {
        fromDate = dateFrom;
        toDate = dateTo;
      }

      try {
        // ИЗМЕНЕНИЕ: Добавляем текущие фильтры к запросу
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const selectedTeams = this.getSelectedTeams();

        let url = `/cards/period?from=${fromDate}&to=${toDate}`;

        // Добавляем фильтр по статусу
        if (statusFilter) {
          url += `&status=${statusFilter}`;
        }

        // Добавляем фильтр по командам
        if (!selectedTeams.all) {
          if (selectedTeams.teamIds.length > 0) {
            url += `&team_ids=${selectedTeams.teamIds.join(',')}`;
          }
          if (selectedTeams.includeNoTeam) {
            url += `&include_no_team=true`;
          }
        }

        // Запрашиваем пересчитанные данные с сервера с фильтрами
        const response = await api.request(url);

        // Временно сохраняем оригинальные карты
        this.originalCards = this.originalCards || [...this.cards];

        // Обновляем карты с пересчитанными данными за период
        this.cards = response.cards || [];
        this.filteredCards = [...this.cards];

        this.renderCards();

        // Показываем сводку по периоду
        this.showPeriodSummary(response.summary, response.period_from, response.period_to, response.total_cards);

      } catch (error) {
        console.error('Ошибка фильтрации по периоду:', error);
        notifications.error('Ошибка', 'Не удалось загрузить данные за период');
      }
    }

    calculateTimeSinceTransaction(lastTransactionDate) {
      if (!lastTransactionDate) return { days: 0, hours: 0, text: 'Нет транзакций' };

      const now = new Date();
      const lastDate = new Date(lastTransactionDate);
      const diffTime = now - lastDate;

      const totalHours = Math.floor(diffTime / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;

      let text = '';
      if (days > 0) {
        text = `${days} дн. ${hours} ч.`;
      } else if (hours > 0) {
        text = `${hours} ч.`;
      } else {
        const minutes = Math.floor(diffTime / (1000 * 60));
        text = minutes > 0 ? `${minutes} мин.` : 'Менее минуты';
      }

      return { days, hours, text };
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
        'limit_exceeded': 'Лимит достигнут',
        'deleted': 'Удалена'
      };

      return statusMap[status] || status;
    }
    showModal() {
      const modal = document.getElementById('card-modal');
      modal?.classList.add('show');

      const uniqueId = this.generateUniqueCardId();
      this.populateTeamsSelect();

      const nameField = document.querySelector('input[name="name"]');
      if (nameField && !nameField.value) {
        nameField.value = uniqueId;
        nameField.select();
      }

      // Инициализируем форматирование полей
      setTimeout(() => initCardFormFormatting(), 100);
    }

    // Псевдоним для shortcuts.js
    showAddModal() {
      this.showModal();
    }

    generateUniqueCardId() {
      // Находим максимальный номер среди существующих карт
      let maxNumber = 0;

      this.cards.forEach(card => {
        if (card.name && card.name.startsWith('CARD_')) {
          const numberPart = card.name.replace('CARD_', '');
          const number = parseInt(numberPart);
          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
          }
        }
      });

      // Следующий номер
      const nextNumber = maxNumber + 1;

      // Форматируем с ведущими нулями (11 цифр)
      return `CARD_${nextNumber.toString().padStart(11, '0')}`;
    }


    hideModal() {
      const modal = document.getElementById('card-modal');
      modal?.classList.remove('show');

      const form = document.getElementById('card-form');
      form?.reset();

      // Очищаем режим редактирования
      delete form.dataset.editCardId;

      // Возвращаем оригинальные тексты
      document.querySelector('.modal-header h3').textContent = 'Добавить новую карту';
      const submitBtn = document.querySelector('#card-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Создать';
      }

      // Возвращаемся на первую вкладку
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      const firstTab = document.querySelector('.tab-btn[data-tab="basic"]');
      const firstContent = document.querySelector('.tab-content[data-tab="basic"]');
      if (firstTab && firstContent) {
        firstTab.classList.add('active');
        firstContent.classList.add('active');
      }
    }

    async handleCardSubmit(e) {
      try {
        const formData = new FormData(e.target);
        const editCardId = e.target.dataset.editCardId;

        // Если это режим редактирования - закрываем старое окно и открываем новое
        if (editCardId) {
          this.hideModal();
          const modal = new CardEditModal();
          modal.open(editCardId);
          return;
        }

        // Логика создания новой карты остается без изменений
        const cardData = {
          name: SecurityUtils.escapeHtml(formData.get('name')),
          currency: formData.get('currency') || 'USD',
          team_id: formData.get('team_id') || null,
          buyer_id: formData.get('buyer_id') || null,
          full_name: SecurityUtils.escapeHtml(formData.get('full_name')),
          phone: SecurityUtils.escapeHtml(formData.get('phone')),
          email: SecurityUtils.escapeHtml(formData.get('email')),
          second_bank_phone: SecurityUtils.escapeHtml(formData.get('second_bank_phone')),
          second_bank_email: SecurityUtils.escapeHtml(formData.get('second_bank_email')),
          contractor_name: SecurityUtils.escapeHtml(formData.get('contractor_name')),
          contractor_account: SecurityUtils.escapeHtml(formData.get('contractor_account')),
          bank_password: formData.get('bank_password'),
          card_password: formData.get('card_password'),
          email_password: formData.get('email_password'),
          birth_date: formData.get('birth_date'),
          passport_issue_date: formData.get('passport_issue_date'),
          ipn: formData.get('ipn'),
          second_bank_pin: formData.get('second_bank_pin'),
          second_bank_password: formData.get('second_bank_password'),
          launch_date: formData.get('launch_date'),
          next_payment_date: formData.get('next_payment_date'),
          remaining_balance: formData.get('remaining_balance'),
          commission_amount: formData.get('commission_amount'),
          // ДОБАВИТЬ НОВЫЕ ПОЛЯ:
          card_number: SecurityUtils.escapeHtml(formData.get('card_number')),
          expiry_date: SecurityUtils.escapeHtml(formData.get('expiry_date')),
          cvv_code: SecurityUtils.escapeHtml(formData.get('cvv_code')),
          iban: SecurityUtils.escapeHtml(formData.get('iban'))
        };

        const errors = SecurityUtils.validateCardInput(cardData);
        if (errors.length > 0) {
          notifications.error('Ошибка валидации', errors.join('; '));
          return;
        }

        // Создание новой карты
        await api.createCard(cardData);
        notifications.success('Карта создана', 'Новая карта успешно добавлена в систему');

        await this.loadCards();
        this.renderCards();
        this.hideModal();

      } catch (error) {
        console.error('Ошибка сохранения карты:', error);
        notifications.error('Ошибка', 'Не удалось создать карту');
      }
    }

    async editCard(cardId) {
      const modal = new CardEditModal();
      modal.open(cardId);
    }


    async deleteCard(cardId) {
      const confirmed = await confirmDelete('Вы уверены, что хотите удалить эту карту? Это действие нельзя отменить.');
      if (!confirmed) return;

      try {
        await api.deleteCard(cardId);
        await this.loadCards();
        this.renderCards();
        notifications.success('Карта удалена', 'Карта успешно удалена из системы');
      } catch (error) {
        console.error('Ошибка удаления карты:', error);
        notifications.error('Ошибка удаления', 'Не удалось удалить карту');
      }
    }

    async openCardDetail(cardId) {
      try {
        // ДОБАВЬ: Сохраняем ID карты для восстановления после перезагрузки
        localStorage.setItem('current_card_detail', cardId);

        // ДОБАВЬ: Обновляем URL без перезагрузки страницы
        window.history.pushState({ module: 'card-detail', cardId: cardId }, '', `#card/${cardId}`);

        // Сначала скрываем текущий контент
        const contentArea = document.getElementById('content-area');
        contentArea.style.transition = 'opacity 0.2s ease';
        contentArea.style.opacity = '0';

        // Показываем лоадер
        setTimeout(() => {
          contentArea.innerHTML = `
                <div class="module-loader">
                    <div class="loader-spinner"></div>
                    <p>Загрузка карты...</p>
                </div>
            `;
          contentArea.style.opacity = '1';
        }, 50);

        // Загружаем HTML детальной страницы
        const response = await fetch('modules/cards/card-detail.html');
        const html = await response.text();

        // Загружаем скрипт детальной страницы
        await this.loadCardDetailScript();

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
            if (window.CardDetailModule) {
              window.cardDetailModule = new window.CardDetailModule(cardId);
            } else {
              console.error('CardDetailModule не загружен');
              notifications.error('Ошибка', 'Не удалось загрузить детальную страницу');
            }
          }, 50);
        }, 100);

      } catch (error) {
        console.error('Ошибка загрузки детальной страницы:', error);
        notifications.error('Ошибка', 'Не удалось загрузить детальную страницу карты');
      }
    }

    async loadCardDetailScript() {
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[src*="card-detail.js"]');
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.src = `modules/cards/card-detail.js?v=${Date.now()}`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    showPeriodSummary(summary, periodFrom, periodTo, totalCards) {
      // Создаем или обновляем блок сводки
      let summaryBlock = document.getElementById('period-summary');

      if (!summaryBlock) {
        summaryBlock = document.createElement('div');
        summaryBlock.id = 'period-summary';
        summaryBlock.className = 'period-summary-block';

        // Вставляем перед контейнером карт
        const cardsContainer = document.getElementById('cards-container').parentNode;
        cardsContainer.insertBefore(summaryBlock, document.getElementById('cards-container'));
      }

      const fromDate = new Date(periodFrom).toLocaleDateString();
      const toDate = new Date(periodTo).toLocaleDateString();

      // Проверяем есть ли операции за период
      const hasOperations = Object.values(summary).some(data =>
        data.total_spent > 0 || data.total_topup > 0
      );

      let content;
      if (Object.keys(summary).length === 0 || !hasOperations) {
        // Если нет операций за период
        content = `
            <div class="period-summary-content">
                <div class="period-info">
                    <h3>📊 ${fromDate} - ${toDate}</h3>
                    <p style="color: var(--text-secondary); margin: 8px 0 0 0;">
                        Нет операций за выбранный период
                    </p>
                </div>
                <button class="btn btn-secondary reset-period-btn" onclick="window.cardsModule?.resetPeriodFilter()">
                    Сбросить фильтр
                </button>
            </div>
        `;
      } else {
        // Создаем строки для каждой валюты
        const currencyRows = Object.keys(summary).map(currency => {
          const data = summary[currency];
          return `
                <div class="period-stats">
                    <div class="stat-item">
                        <span class="stat-label">Скручено:</span>
                        <span class="stat-value spent">${data.total_spent.toFixed(2)} ${currency}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Общие пополнения:</span>
                        <span class="stat-value topup">${data.total_topup.toFixed(2)} ${currency}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Карт с операциями:</span>
                        <span class="stat-value">${data.cards_count}</span>
                    </div>
                </div>
            `;
        }).join('');

        content = `
            <div class="period-summary-content">
                <div class="period-info">
                    <h3>📊 ${fromDate} - ${toDate}</h3>
                    ${currencyRows}
                </div>
                <button class="btn btn-secondary reset-period-btn" onclick="window.cardsModule?.resetPeriodFilter()">
                    Сбросить фильтр
                </button>
            </div>
        `;
      }

      summaryBlock.innerHTML = content;
    }

    resetPeriodFilter() {
      // Очищаем поля дат
      document.getElementById('date-from').value = '';
      document.getElementById('date-to').value = '';

      // Восстанавливаем оригинальные данные
      if (this.originalCards) {
        this.cards = [...this.originalCards];
        this.filteredCards = [...this.cards];
        this.originalCards = null;
      }

      // Убираем блок сводки
      const summaryBlock = document.getElementById('period-summary');
      if (summaryBlock) {
        summaryBlock.remove();
      }

      this.renderCards();
      notifications.info('Фильтр сброшен', 'Показаны все данные за всё время');
    }

    async loadTeams() {
      try {
        const response = await api.request('/teams');
        this.teams = response.teams || [];
        this.populateTeamsSelect(); // Заполняем после загрузки
      } catch (error) {
        console.error('Ошибка загрузки команд:', error);
        this.teams = [];
      }
    }


    populateTeamsSelect() {
      const teamSelect = document.querySelector('select[name="team_id"]');
      if (!teamSelect) return;

      // Очищаем текущие опции (кроме первой)
      teamSelect.innerHTML = '<option value="">Выберите команду</option>';

      // Проверяем что команды загружены
      if (!this.teams || this.teams.length === 0) {
        console.log('Teams not loaded yet, will populate when available');
        return;
      }

      // Добавляем команды
      this.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
      });

      // Добавляем обработчик изменения команды
      const buyerField = document.getElementById('buyer-field');
      const buyerSelect = document.getElementById('buyer_id');

      if (buyerField && buyerSelect) {
        // Удаляем старые обработчики если есть
        teamSelect.removeEventListener('change', this._teamChangeHandler);

        // Создаем новый обработчик
        this._teamChangeHandler = async (e) => {
          const teamId = e.target.value;

          if (teamId) {
            // Показываем поле баера
            buyerField.style.display = 'block';

            // Загружаем баеров команды
            try {
              const buyersResponse = await api.request(`/teams/${teamId}/buyers`);
              const buyers = buyersResponse.buyers || [];

              // Очищаем и заполняем список баеров
              buyerSelect.innerHTML = '<option value="">Выберите баера</option>';
              buyers.forEach(buyer => {
                buyerSelect.innerHTML += `<option value="${buyer.id}">${buyer.username}</option>`;
              });

            } catch (error) {
              console.error('Ошибка загрузки баеров:', error);
              buyerSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
            }
          } else {
            // Скрываем поле баера
            buyerField.style.display = 'none';
            buyerSelect.innerHTML = '<option value="">Выберите баера</option>';
          }
        };

        teamSelect.addEventListener('change', this._teamChangeHandler);
      }
    }


    setupTeamsFilter() {
      const filterButton = document.getElementById('teams-filter-button');
      const filterDropdown = document.getElementById('teams-filter-dropdown');

      console.log('Setting up teams filter');
      console.log('Button found:', !!filterButton);
      console.log('Dropdown found:', !!filterDropdown);

      if (!filterButton || !filterDropdown) {
        console.error('Teams filter elements not found');
        return;
      }

      // Открытие/закрытие dropdown
      filterButton.addEventListener('click', (e) => {
        console.log('Filter button clicked');
        e.stopPropagation();
        filterDropdown.classList.toggle('show');
        console.log('Dropdown classes:', filterDropdown.className);
      });

      // Закрытие при клике вне
      document.addEventListener('click', (e) => {
        if (!filterButton.contains(e.target) && !filterDropdown.contains(e.target)) {
          filterDropdown.classList.remove('show');
        }
      });

      this.populateTeamsFilter();
    }

    populateTeamsFilter() {
      const teamsList = document.getElementById('teams-filter-list');
      if (!teamsList || !this.teams) return;

      const html = this.teams.map(team => `
        <div class="filter-option" data-value="${team.id}">
            <label>
                <input type="checkbox" name="team-filter" value="${team.id}">
                ${team.name}
            </label>
        </div>
    `).join('');

      teamsList.innerHTML = html;
      this.setupTeamsFilterEvents();
    }

    setupTeamsFilterEvents() {
      const allCheckbox = document.querySelector('input[name="team-filter"][value="all"]');
      const teamCheckboxes = document.querySelectorAll('input[name="team-filter"]:not([value="all"])');

      allCheckbox?.addEventListener('change', () => {
        if (allCheckbox.checked) {
          teamCheckboxes.forEach(cb => cb.checked = false);
        }
        this.updateTeamsFilterText();
        this.filterCards();
      });

      teamCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            allCheckbox.checked = false;
          }

          const anySelected = Array.from(teamCheckboxes).some(cb => cb.checked);
          if (!anySelected) {
            allCheckbox.checked = true;
          }

          this.updateTeamsFilterText();
          this.filterCards();
        });
      });
    }

    updateTeamsFilterText() {
      const filterText = document.querySelector('.filter-text');
      const allCheckbox = document.querySelector('input[name="team-filter"][value="all"]');
      const selectedTeams = document.querySelectorAll('input[name="team-filter"]:not([value="all"]):checked');

      if (allCheckbox.checked || selectedTeams.length === 0) {
        filterText.textContent = 'Все команды';
      } else if (selectedTeams.length === 1) {
        const teamName = selectedTeams[0].closest('label').textContent.trim();
        filterText.textContent = teamName;
      } else {
        filterText.textContent = `Команд: ${selectedTeams.length}`;
      }
    }

    getSelectedTeams() {
      const allCheckbox = document.querySelector('input[name="team-filter"][value="all"]');
      if (allCheckbox?.checked) {
        return { all: true };
      }

      const selectedTeams = document.querySelectorAll('input[name="team-filter"]:not([value="all"]):checked');
      const teamIds = [];
      let includeNoTeam = false;

      selectedTeams.forEach(cb => {
        if (cb.value === 'no-team') {
          includeNoTeam = true;
        } else {
          teamIds.push(parseInt(cb.value));
        }
      });

      return { teamIds, includeNoTeam };
    }

    applyPeriodFilter(period) {
      if (!period) {
        // Очищаем поля дат если период не выбран
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        this.filterCardsByPeriod();
        return;
      }

      const today = new Date();
      let fromDate, toDate;

      switch (period) {
        case 'today':
          fromDate = toDate = today.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          fromDate = toDate = yesterday.toISOString().split('T')[0];
          break;
        case '3days':
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          fromDate = threeDaysAgo.toISOString().split('T')[0];
          toDate = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          fromDate = weekAgo.toISOString().split('T')[0];
          toDate = today.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          fromDate = monthAgo.toISOString().split('T')[0];
          toDate = today.toISOString().split('T')[0];
          break;
      }

      // Устанавливаем даты в поля
      document.getElementById('date-from').value = fromDate;
      document.getElementById('date-to').value = toDate;

      // Применяем фильтр
      this.filterCardsByPeriod();
    }
  }

  function formatExpiryDate(input) {
    let value = input.value.replace(/[^\d]/g, '');

    // Ограничиваем до 4 цифр
    if (value.length > 4) {
      value = value.substring(0, 4);
    }

    // Добавляем слеш после второй цифры
    if (value.length >= 3) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }

    input.value = value;
  }

  function initCardFormFormatting() {
    const expiryInput = document.querySelector('input[name="expiry_date"]');
    if (expiryInput) {
      expiryInput.addEventListener('input', function (e) {
        formatExpiryDate(e.target);
      });

      expiryInput.addEventListener('keydown', function (e) {
        // Если нажат Backspace и курсор стоит после слеша
        if (e.key === 'Backspace') {
          const cursorPos = e.target.selectionStart;
          if (cursorPos === 3 && e.target.value.charAt(2) === '/') {
            // Удаляем символ перед слешем
            e.target.value = e.target.value.substring(0, 1) + e.target.value.substring(3);
            e.target.setSelectionRange(1, 1);
            e.preventDefault();
          }
        }

        // Предотвращаем ввод нечисловых символов
        if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }
  }

  // Экспортируем класс для module-loader
  window.CardsModule = CardsModule;

} else {
  console.log('CardsModule already exists, skipping class definition');
}

// Сохраняем экземпляр в глобальной переменной для onclick обработчиков
window.cardsModule = null;

console.log('CardsModule class ready for module-loader');