// Модуль расходов
class ExpensesModule {
    constructor() {
        this.expenses = [];
        this.filteredExpenses = [];
        this.init();
    }

    async init() {
        this.loadStyles();
        this.setupEventListeners();
        await this.loadExpenses();
        this.renderExpenses();
        this.updateSummary();
    }

    loadStyles() {
        const expensesCss = document.createElement('link');
        expensesCss.rel = 'stylesheet';
        expensesCss.href = `modules/expenses/expenses.css?v=${Date.now()}`;

        // Проверяем что стили не загружены уже
        const existingLink = document.querySelector('link[href*="expenses.css"]');
        if (!existingLink) {
            document.head.appendChild(expensesCss);
            console.log('Загружаем стили расходов:', expensesCss.href); // для отладки
        }
    }

    setupEventListeners() {
        // Кнопка добавления расхода
        const addBtn = document.getElementById('add-expense-btn');
        addBtn?.addEventListener('click', () => this.showAddModal());

        // Поиск и фильтры
        const searchInput = document.getElementById('search-expenses');
        searchInput?.addEventListener('input', () => this.filterExpenses());

        const categoryFilter = document.getElementById('category-filter');
        categoryFilter?.addEventListener('change', () => this.filterExpenses());

        const sortSelect = document.getElementById('sort-expenses');
        sortSelect?.addEventListener('change', (e) => {
            this.sortExpenses(e.target.value);
            this.renderExpenses();
        });
    }

    async loadExpenses() {
        try {
            const response = await api.request('/expenses');
            this.expenses = response.expenses || [];
            this.filteredExpenses = [...this.expenses];
        } catch (error) {
            console.error('Ошибка загрузки расходов:', error);
            this.showError('Не удалось загрузить расходы');
        }
    }

    filterExpenses() {
        const searchTerm = document.getElementById('search-expenses')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('category-filter')?.value || '';

        this.filteredExpenses = this.expenses.filter(expense => {
            const matchesSearch = expense.name.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || expense.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        this.renderExpenses();
        this.updateSummary();
    }

    sortExpenses(sortType) {
        this.filteredExpenses.sort((a, b) => {
            switch (sortType) {
                case 'date_desc':
                    return new Date(b.expense_date) - new Date(a.expense_date);
                case 'date_asc':
                    return new Date(a.expense_date) - new Date(b.expense_date);
                case 'amount_desc':
                    return b.amount - a.amount;
                case 'amount_asc':
                    return a.amount - b.amount;
                default:
                    return 0;
            }
        });
    }

    renderExpenses() {
        const tbody = document.getElementById('expenses-table-body');
        if (!tbody) return;

        if (this.filteredExpenses.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <div>
              <h4 style="margin-bottom: 8px;">Расходы не найдены</h4>
              <p>Попробуйте изменить параметры поиска</p>
            </div>
          </td>
        </tr>
      `;
            return;
        }

        tbody.innerHTML = this.filteredExpenses.map(expense => this.renderExpenseRow(expense)).join('');
    }

    renderExpenseRow(expense) {
        const categoryNames = {
            'cards_opening': 'Карты открытие',
            'cards_renewal': 'Карты продление',
            'employees': 'Сотрудники',
            'second_banks': 'Вторые банки',
            'sim_cards': 'Симки',
            'accounts': 'Аккаунты',
            'proxy': 'Прокси',
            'antidetect': 'Антидект',
            'other': 'Другие расходы',
            'card_topups': 'Пополнения карты',
            'office': 'Офис',
            'utilities': 'Коммунальные'
        };

        return `
      <tr data-expense-id="${expense.id}">
        <td><span class="expense-category">${categoryNames[expense.category] || expense.category}</span></td>
        <td>${expense.name}</td>
        <td><strong>${expense.amount} ${expense.currency}</strong></td>
        <td>${new Date(expense.expense_date).toLocaleDateString()}</td>
        <td>${expense.description || '—'}</td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn edit" title="Редактировать" onclick="expensesModule.editExpense(${expense.id})">
              ✏️
            </button>
            <button class="table-action-btn delete" title="Удалить" onclick="expensesModule.deleteExpense(${expense.id})">
              ×
            </button>
          </div>
        </td>
      </tr>
    `;
    }

    updateSummary() {
        const total = this.filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

        const weekExpenses = this.filteredExpenses
            .filter(expense => new Date(expense.expense_date) >= weekAgo)
            .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

        const monthExpenses = this.filteredExpenses
            .filter(expense => new Date(expense.expense_date) >= monthAgo)
            .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

        document.getElementById('total-expenses').textContent = `${total.toFixed(2)} UAH`;
        document.getElementById('month-expenses').textContent = `${monthExpenses.toFixed(2)} UAH`;
        document.getElementById('week-expenses').textContent = `${weekExpenses.toFixed(2)} UAH`;
    }

    showAddModal() {
        // Пока заглушка
        alert('Модальное окно добавления расхода в разработке');
    }

    editExpense(expenseId) {
        alert(`Редактирование расхода ${expenseId} в разработке`);
    }

    async deleteExpense(expenseId) {
        // Заменяем системный confirm на красивый модал
        const confirmed = await confirmDelete('Вы уверены, что хотите удалить этот расход?');

        if (!confirmed) {
            return;
        }

        try {
            await api.request(`/expenses/${expenseId}`, { method: 'DELETE' });
            await this.loadExpenses();
            this.renderExpenses();
            this.updateSummary();
            notifications.success('Расход удален', 'Запись о расходе удалена из системы');
        } catch (error) {
            console.error('Ошибка удаления расхода:', error);
            notifications.error('Ошибка удаления', 'Не удалось удалить расход');
        }
    }

    showError(message) {
        notifications.error('Ошибка', message);
    }

    showSuccess(message) {
        notifications.success('Успех', message);
    }
}

// Инициализация только при первой загрузке
if (typeof window.expensesModule === 'undefined') {
    window.expensesModule = new ExpensesModule();
} else {
    // Переинициализация существующего модуля
    window.expensesModule.loadExpenses().then(() => {
        window.expensesModule.renderExpenses();
        window.expensesModule.updateSummary();
    });
}

