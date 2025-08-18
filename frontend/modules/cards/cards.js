if (typeof CardsModule === 'undefined') {
  // Модуль управления картами
  class CardsModule {
    constructor() {
      this.cards = [];
      this.filteredCards = [];
      this.currentView = localStorage.getItem('cards_view') || 'grid'; // Читаем из storage
      this.currentSort = localStorage.getItem('cards_sort') || 'created_desc';
      this.init();
    }

    async init() {
      this.loadStyles();
      this.setupEventListeners();
      await this.loadCards();
      this.sortCards();

      // ДОБАВЬ ЭТИ СТРОКИ ДЛЯ ОТЛАДКИ:
      console.log('Cards loaded:', this.cards.length);
      console.log('Filtered cards:', this.filteredCards.length);

      this.setupViewToggle();
      this.renderCards();
    }

    loadStyles() {
      const timestamp = Date.now(); // Добавь это

      const cardsCss = document.createElement('link');
      cardsCss.rel = 'stylesheet';
      cardsCss.href = `modules/cards/cards.css?v=${timestamp}`; // Добавь версию

      const modalCss = document.createElement('link');
      modalCss.rel = 'stylesheet';
      modalCss.href = `css/modal.css?v=${timestamp}`; // Добавь версию

      if (!document.querySelector('link[href*="modules/cards/cards.css"]')) {
        document.head.appendChild(cardsCss);
      }
      if (!document.querySelector('link[href*="css/modal.css"]')) {
        document.head.appendChild(modalCss);
      }
    }

    setupEventListeners() {
      // Кнопка добавления карты
      const addBtn = document.getElementById('add-card-btn');
      addBtn?.addEventListener('click', () => this.showModal());

      // Поиск карт
      const searchInput = document.getElementById('search-cards');
      searchInput?.addEventListener('input', (e) => this.filterCards());

      // Фильтр по статусу
      const statusFilter = document.getElementById('status-filter');
      statusFilter?.addEventListener('change', (e) => this.filterCards());

      // Модальное окно
      this.setupModalEvents();
    }
    setupViewToggle() {
      console.log('Setting up view toggle, current view:', this.currentView);

      const viewBtns = document.querySelectorAll('.view-btn');
      console.log('Found view buttons:', viewBtns.length);

      // Устанавливаем сохраненный вид
      viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.currentView);
      });

      this.switchView(this.currentView);

      // ИСПРАВЬ ОТСТУПЫ - эти строки должны быть на том же уровне:
      viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          this.switchView(view);

          // Обновляем активную кнопку
          viewBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Сортировка
      const sortSelect = document.getElementById('sort-cards');
      sortSelect?.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        localStorage.setItem('cards_sort', e.target.value); // Добавь сохранение
        this.sortCards();
        this.renderCards();
      });
    }

    editCard(cardId) {
      console.log('Edit card:', cardId);
      // Пока заглушка - потом добавим редактирование
      alert('Редактирование карты в разработке');
    }

    switchView(view) {
      this.currentView = view;
      localStorage.setItem('cards_view', view); // Сохраняем выбор

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
          default:
            return 0;
        }
      });
    }

    renderCards() {
      console.log('renderCards called, current view:', this.currentView);
      this.sortCards();

      if (this.currentView === 'grid') {
        console.log('Calling renderGridView');
        this.renderGridView();
      } else if (this.currentView === 'table') {
        console.log('Calling renderTableView');
        this.renderTableView();
      } else {
        console.log('Unknown view:', this.currentView);
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
      console.log('Rendering table view, cards:', this.filteredCards);
      const tbody = document.getElementById('cards-table-body');
      console.log('Table body element:', tbody);

      if (!tbody) {
        console.error('Table body not found!');
        return;
      }

      if (this.filteredCards.length === 0) {
        console.log('No cards to display');
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

      console.log('Generating table rows for', this.filteredCards.length, 'cards');
      const rows = this.filteredCards.map(card => {
        console.log('Rendering card:', card.name);
        return this.renderTableRow(card);
      });

      tbody.innerHTML = rows.join('');
      console.log('Table HTML set, tbody children:', tbody.children.length);
    }

    renderTableRow(card) {
      const statusClass = card.status || 'active';
      const statusText = this.getStatusText(card.status);
      const totalSpent = card.total_spent_calculated || 0;
      const warmUp = card.warm_up_amount || 0;
      const daysSinceTransaction = this.calculateDaysSinceTransaction(card.last_transaction_date);

      return `
  <tr class="${daysSinceTransaction >= 3 ? 'warning-row' : ''}" data-card-id="${card.id}">
    <td title="${card.name}">
      <a href="#" class="card-name-link" onclick="cardsModule.openCardDetail(${card.id}); return false;">
        ${card.name}
      </a>
    </td>
    <td><span class="table-status ${statusClass}">${statusText}</span></td>
    <td>${card.currency}</td>
    <td>${card.balance || 0} ${card.currency}</td>
    <td>${totalSpent} ${card.currency}</td>
    <td>${warmUp} ${card.currency}</td>
    <td title="${card.contractor_name || ''}">${card.contractor_name || '—'}</td>
    <td>${new Date(card.created_at).toLocaleDateString()}</td>
    <td>
      <div class="table-actions">
        <button class="table-action-btn edit" title="Редактировать" onclick="cardsModule.editCard(${card.id})">
          ✏️
        </button>
        <button class="table-action-btn delete" title="Удалить" onclick="cardsModule.deleteCard(${card.id})">
          ×
        </button>
      </div>
    </td>
  </tr>
`;
    }

    setupModalEvents() {
      const modal = document.getElementById('card-modal');
      const closeBtn = modal?.querySelector('.modal-close');
      const cancelBtn = modal?.querySelector('.modal-cancel');
      const form = document.getElementById('card-form');

      closeBtn?.addEventListener('click', () => this.hideModal());
      cancelBtn?.addEventListener('click', () => this.hideModal());

      // Закрытие по клику вне модального окна
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.hideModal();
      });

      // Обработка формы
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCardSubmit(e);
      });

      // ДОБАВЬ СЮДА ↓↓↓
      // Обработка вкладок
      const tabBtns = modal?.querySelectorAll('.tab-btn');
      const tabContents = modal?.querySelectorAll('.tab-content');

      tabBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetTab = btn.dataset.tab;

          // Убираем активный класс со всех кнопок и контента
          tabBtns.forEach(b => b.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));

          // Добавляем активный класс к выбранной вкладке
          btn.classList.add('active');
          modal.querySelector(`[data-tab="${targetTab}"].tab-content`)?.classList.add('active');
        });
      });
    }

    async loadCards() {
      try {
        const response = await api.getCards();
        this.cards = response.cards || [];
        this.filteredCards = [...this.cards];
      } catch (error) {
        console.error('Ошибка загрузки карт:', error);
        this.showError('Не удалось загрузить карты');
      }
    }

    filterCards() {
      const searchTerm = document.getElementById('search-cards')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('status-filter')?.value || '';

      this.filteredCards = this.cards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusFilter || card.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

      this.renderCards();
    }
    renderCard(card) {
      const statusClass = card.status || 'active';
      const statusText = this.getStatusText(card.status);

      // Расчеты для отображения
      const totalSpent = card.total_spent_calculated || 0;
      const warmUp = card.warm_up_amount || 0;
      const balance = card.balance || 0;
      const daysSinceTransaction = this.calculateDaysSinceTransaction(card.last_transaction_date);

      return `
    <div class="card-item ${daysSinceTransaction >= 3 ? 'warning-card' : ''}" data-card-id="${card.id}">
      <div class="card-actions">
        <button class="card-action-btn edit" onclick="cardsModule.editCard(${card.id})" title="Редактировать карту">
          <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-.4 2.2.1 4.5 1.4 6.2.9 1.2 2.2 1.9 3.8 1.9z"/>
          </svg>
        </button>
        <button class="card-action-btn delete" onclick="cardsModule.deleteCard(${card.id})" title="Удалить карту">
          <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
          </svg>
        </button>
      </div>

      <div class="card-top">
        <div class="card-header">
          <h3 class="card-title">${card.name}</h3>
          <span class="card-status ${statusClass}">${statusText}</span>
        </div>
        <div class="card-currency">💳 ${card.currency}</div>
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
          <div class="stat-label">Прогрев</div>
          <div class="stat-value ${warmUp > 0 ? 'warning' : ''}">${warmUp} ${card.currency}</div>
        </div>
      </div>

      <div class="card-body">
        <div class="card-info">
          ${card.top_up_uah ? `
          <div class="card-info-item">
            <span class="card-info-label">Пополнений</span>
            <span class="card-info-value">${card.top_up_uah} ${card.currency}</span>
          </div>
          ` : ''}
          ${card.remaining_balance ? `
          <div class="card-info-item">
            <span class="card-info-label">Остаток</span>
            <span class="card-info-value">${card.remaining_balance} ${card.currency}</span>
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
          ${daysSinceTransaction >= 3 ? `
          <div class="card-info-item warning">
            <span class="card-info-label">⚠️ Без транзакций</span>
            <span class="card-info-value">${daysSinceTransaction} дней</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="card-footer">
        <div class="card-created">
          📅 ${new Date(card.created_at).toLocaleDateString()}
        </div>
        <div class="card-id">ID: ${card.id}</div>
      </div>
    </div>
  `;
    }

    calculateDaysSinceTransaction(lastTransactionDate) {
      if (!lastTransactionDate) return 0;

      const today = new Date();
      const lastDate = new Date(lastTransactionDate);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    }


    reinitializeEvents() {
      // НЕ вызываем setupEventListeners повторно
      // Только переустанавливаем кнопку добавления
      const addBtn = document.getElementById('add-card-btn');
      if (addBtn) {
        // Удаляем старые обработчики
        addBtn.replaceWith(addBtn.cloneNode(true));
        const newAddBtn = document.getElementById('add-card-btn');
        newAddBtn.addEventListener('click', () => this.showModal());
      }

      // Переинициализируем переключатель видов
      this.setupViewToggle();
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

    showModal() {
      const modal = document.getElementById('card-modal');
      modal?.classList.add('show');
    }

    hideModal() {
      const modal = document.getElementById('card-modal');
      modal?.classList.remove('show');
      document.getElementById('card-form')?.reset();
    }

    async handleCardSubmit(e) {
      try {
        const formData = new FormData(e.target);
        const cardData = {
          name: formData.get('name'),
          currency: formData.get('currency'),
          team_id: formData.get('team_id') || null,
          // Личные данные
          full_name: formData.get('full_name'),
          bank_password: formData.get('bank_password'),
          card_password: formData.get('card_password'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          email_password: formData.get('email_password'),
          birth_date: formData.get('birth_date'),
          passport_issue_date: formData.get('passport_issue_date'),
          ipn: formData.get('ipn'),
          // Второй банк
          second_bank_phone: formData.get('second_bank_phone'),
          second_bank_pin: formData.get('second_bank_pin'),
          second_bank_email: formData.get('second_bank_email'),
          second_bank_password: formData.get('second_bank_password'),
          // Подрядчик
          contractor_name: formData.get('contractor_name'),
          launch_date: formData.get('launch_date'),
          next_payment_date: formData.get('next_payment_date'),
          contractor_account: formData.get('contractor_account'),
          // Финансы
          income_amount: formData.get('income_amount'),
          top_up_uah: formData.get('top_up_uah'),
          remaining_balance: formData.get('remaining_balance'),
          daily_limit: formData.get('daily_limit'),
          last_transaction_date: formData.get('last_transaction_date')
        };

        await api.createCard(cardData);
        await this.loadCards();
        this.renderCards();
        this.hideModal();
        this.showSuccess('Карта успешно создана');
      } catch (error) {
        console.error('Ошибка создания карты:', error);
        this.showError('Не удалось создать карту');
      }
    }

    showError(message) {
      // Временная реализация, можно улучшить
      alert('Ошибка: ' + message);
    }

    showSuccess(message) {
      // Временная реализация, можно улучшить
      alert('Успех: ' + message);
    }

    async deleteCard(cardId) {
      // Подтверждение удаления
      if (!confirm('Вы уверены, что хотите удалить эту карту? Это действие нельзя отменить.')) {
        return;
      }

      try {
        await api.deleteCard(cardId);
        await this.loadCards();
        this.renderCards();
        this.showSuccess('Карта успешно удалена');
      } catch (error) {
        console.error('Ошибка удаления карты:', error);
        this.showError('Не удалось удалить карту');
      }
    }

    async openCardDetail(cardId) {
      try {
        // Загружаем HTML детальной страницы
        const response = await fetch('modules/cards/card-detail.html');
        const html = await response.text();

        // Заменяем содержимое content-area
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = html;

        // Загружаем скрипт детальной страницы
        await this.loadCardDetailScript();

        // Ждем немного чтобы скрипт загрузился
        setTimeout(() => {
          if (window.CardDetailModule) {
            new window.CardDetailModule(cardId);
          } else {
            console.error('CardDetailModule не загружен');
          }
        }, 100);

      } catch (error) {
        console.error('Ошибка загрузки детальной страницы:', error);
        this.showError('Не удалось загрузить детальную страницу карты');
      }
    }

    async loadCardDetailScript() {
      return new Promise((resolve, reject) => {
        // Удаляем предыдущий скрипт если есть
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
  }



  // Инициализация только при первой загрузке
  window.cardsModule = new CardsModule();

} else {
  // Если класс уже существует, просто переинициализируем
  console.log('CardsModule already exists, reinitializing...');

  if (window.cardsModule) {
    // Переинициализируем существующий модуль
    window.cardsModule.setupEventListeners();
    window.cardsModule.setupViewToggle();

    // Перезагружаем данные
    window.cardsModule.loadCards().then(() => {
      window.cardsModule.sortCards();
      window.cardsModule.renderCards();
    });
  }
}