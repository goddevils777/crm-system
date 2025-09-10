// Модальное окно для добавления/редактирования расходов
class ExpenseModal {
  constructor() {
    this.isOpen = false;
    this.employees = [];
    this.contractors = []; // ДОБАВИТЬ
    this.editingExpenseId = null;
  }
  async open(expenseId = null) {
    this.editingExpenseId = expenseId;
    this.isOpen = true;

    // Загружаем сотрудников и подрядчиков
    await this.loadEmployees();
    await this.loadContractors(); // ДОБАВИТЬ

    // Создаем модалку
    this.render();
    this.setupEvents();

    // Если редактируем - загружаем данные
    if (expenseId) {
      await this.loadExpenseData(expenseId);
    }
  }

  async loadEmployees() {
    try {
      const response = await api.request('/employees');
      this.employees = response.employees || [];
      console.log('Загружено сотрудников:', this.employees.length);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      this.employees = [];
    }
  }

  async loadContractors() {
    try {
      const response = await api.request('/contractors');
      this.contractors = response.contractors || [];
      console.log('Загружено подрядчиков:', this.contractors.length);
    } catch (error) {
      console.error('Ошибка загрузки подрядчиков:', error);
      this.contractors = [];
    }
  }

  render() {
    const categories = [
      { id: 'cards_opening', name: 'Карты открытие', icon: '💳' },
      { id: 'cards_renewal', name: 'Карты продление', icon: '🔄' },
      { id: 'employees', name: 'Сотрудники', icon: '👥' },
      { id: 'second_banks', name: 'Вторые банки', icon: '🏦' },
      { id: 'sim_cards', name: 'Симки', icon: '📱' },
      { id: 'accounts', name: 'Аккаунты', icon: '👤' },
      { id: 'proxy', name: 'Прокси', icon: '🌐' },
      { id: 'antidetect', name: 'Антидект', icon: '🔒' },
      { id: 'other', name: 'Другие расходы', icon: '📦' },
      { id: 'card_topups', name: 'Пополнения карты', icon: '💰' },
      { id: 'office', name: 'Офис', icon: '🏢' },
      { id: 'utilities', name: 'Коммунальные', icon: '⚡' }
    ];

    const modalHtml = `
      <div class="modal-overlay" id="expense-modal-overlay">
        <div class="modal-container wide">
          <div class="modal-header">
            <h3>${this.editingExpenseId ? 'Редактировать расход' : 'Добавить расход'}</h3>
            <button class="modal-close" id="close-expense-modal">×</button>
          </div>
          
          <form class="modal-form" id="expense-form">
            <div class="form-section">
              <label class="section-label">Выберите категорию расхода *</label>
              <div class="category-grid">
                ${categories.map(cat => `
                  <div class="category-card" data-category="${cat.id}">
                    <div class="category-icon">${cat.icon}</div>
                    <div class="category-name">${cat.name}</div>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="expense-category" name="category" required>
            </div>

            <!-- Блок сотрудников -->
            <div class="form-section" id="employee-selection" style="display: none;">
              <label class="section-label">Сотрудники</label>
              
              <!-- Список существующих сотрудников -->
              <div class="chips-container" id="employees-chips">
                ${this.employees.map(emp => `
                  <div class="chip employee-chip" data-employee-id="${emp.id}" 
                       data-salary="${emp.salary_amount}" data-currency="${emp.salary_currency}">
                    <span class="chip-text">${emp.name} - ${emp.salary_amount} ${emp.salary_currency}</span>
                  </div>
                `).join('')}
              </div>
              
              <!-- Форма добавления нового сотрудника -->
              <div class="add-form" id="add-employee-form" style="display: none;">
                <div class="form-row">
                  <div class="form-group">
                    <input type="text" id="new-employee-name" class="form-input" placeholder="Имя сотрудника">
                  </div>
                  <div class="form-group">
                    <input type="number" id="new-employee-salary" class="form-input" placeholder="Зарплата" step="0.01">
                  </div>
                  <div class="form-group">
                    <select id="new-employee-currency" class="form-select">
                    <option value="USD">USD</option>
                      <option value="UAH">UAH</option>
                      
        
                    </select>
                  </div>
                  <div class="form-group">
                    <button type="button" id="save-employee-btn" class="btn btn-primary btn-small">Сохранить</button>
                    <button type="button" id="cancel-employee-btn" class="btn btn-secondary btn-small">Отмена</button>
                  </div>
                </div>
              </div>
              
              <button type="button" id="add-employee-btn" class="btn btn-secondary btn-small">
                + Добавить сотрудника
              </button>
            </div>

            <!-- Блок подрядчиков -->
            <div class="form-section" id="contractor-selection" style="display: none;">
              <label class="section-label">Подрядчики</label>
              
              <!-- Список существующих подрядчиков -->
              <div class="chips-container" id="contractors-chips">
                <!-- Будет заполняться через filterContractors -->
              </div>
              
              <!-- Форма добавления нового подрядчика -->
              <div class="add-form" id="add-contractor-form" style="display: none;">
                <div class="form-row">
                  <div class="form-group">
                    <input type="text" id="new-contractor-name" class="form-input" placeholder="Название подрядчика">
                  </div>
                  <div class="form-group">
                    <button type="button" id="save-contractor-btn" class="btn btn-primary btn-small">Сохранить</button>
                    <button type="button" id="cancel-contractor-btn" class="btn btn-secondary btn-small">Отмена</button>
                  </div>
                </div>
              </div>
              
              <button type="button" id="add-contractor-btn" class="btn btn-secondary btn-small">
                + Добавить подрядчика
              </button>
            </div>

            <div class="form-section">
              <div class="form-row">
                <div class="form-group">
                  <label for="expense-name">Название *</label>
                  <input type="text" id="expense-name" name="name" class="form-input" placeholder="Название расхода" required>
                </div>
                
                <div class="form-group">
                  <label for="expense-amount">Сумма *</label>
                  <input type="number" id="expense-amount" name="amount" class="form-input" placeholder="0.00" step="0.01" min="0" required>
                </div>
                
                <div class="form-group">
                  <label for="expense-currency">Валюта</label>
                    <select id="expense-currency" name="currency" class="form-select">
                      <option value="USD" selected>USD</option>
                      <option value="UAH">UAH</option>
                    </select>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="expense-date">Дата</label>
                  <input type="date" id="expense-date" name="expense_date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="expense-description">Описание</label>
              <textarea id="expense-description" name="description" class="form-textarea" placeholder="Дополнительная информация" rows="3"></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="cancel-expense">Отмена</button>
              <button type="submit" class="btn btn-primary">${this.editingExpenseId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  setupEvents() {
    const modal = document.getElementById('expense-modal-overlay');
    const form = document.getElementById('expense-form');
    const categoryCards = document.querySelectorAll('.category-card');
    const categoryInput = document.getElementById('expense-category');
    const nameInput = document.getElementById('expense-name');
    const amountInput = document.getElementById('expense-amount');

    // Закрытие модалки
    document.getElementById('close-expense-modal').addEventListener('click', () => this.close());
    document.getElementById('cancel-expense').addEventListener('click', () => this.close());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Выбор категории через карточки
    // Выбор категории через карточки
    categoryCards.forEach(card => {
      card.addEventListener('click', (e) => {
        categoryCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const selectedCategory = card.dataset.category;
        categoryInput.value = selectedCategory;

        // Автозаполнение названия по категории
        this.fillCategoryName(selectedCategory);

        const employeeSection = document.getElementById('employee-selection');
        const contractorSection = document.getElementById('contractor-selection');

        if (selectedCategory === 'employees') {
          employeeSection.style.display = 'block';
          contractorSection.style.display = 'none';
          this.setupEmployeeChips();
        } else if (selectedCategory === 'cards_opening' || selectedCategory === 'cards_renewal') {
          employeeSection.style.display = 'none';
          contractorSection.style.display = 'block';
          this.setupContractorChips(selectedCategory === 'cards_opening' ? 'opening' : 'renewal');
        } else {
          employeeSection.style.display = 'none';
          contractorSection.style.display = 'none';
        }
      });
    });

    // Обработчики для сотрудников
    this.setupEmployeeHandlers();

    // Обработчики для подрядчиков
    this.setupContractorHandlers();

    // Отправка формы
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitForm();
    });
  }

  clearEmployeeData() {
    // Очищаем только если это был автозаполненный расход сотрудника
    const nameInput = document.getElementById('expense-name');
    if (nameInput.value.startsWith('Зарплата -')) {
      nameInput.value = '';
      document.getElementById('expense-amount').value = '';
    }
  }

  filterContractors(type) {
    const contractorSelect = document.getElementById('expense-contractor');
    contractorSelect.innerHTML = '<option value="">Выберите подрядчика</option>';

    const filteredContractors = this.contractors.filter(contractor => contractor.type === type);
    filteredContractors.forEach(contractor => {
      contractorSelect.innerHTML += `<option value="${contractor.id}">${contractor.name}</option>`;
    });
  }


  setupEmployeeChips() {
    const container = document.getElementById('employees-chips');
    container.innerHTML = this.employees.map(emp => `
      <div class="chip employee-chip" data-employee-id="${emp.id}" 
           data-salary="${emp.salary_amount}" data-currency="${emp.salary_currency}">
        <span class="chip-text">${emp.name} - ${emp.salary_amount} ${emp.salary_currency}</span>
        <span class="chip-delete" data-employee-id="${emp.id}">×</span>
      </div>
    `).join('');

    const chips = container.querySelectorAll('.employee-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-delete')) return;
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');

        const employeeName = chip.querySelector('.chip-text').textContent.split(' - ')[0];
        const salary = chip.dataset.salary;
        const currency = chip.dataset.currency;

        document.getElementById('expense-name').value = `Зарплата - ${employeeName}`;
        document.getElementById('expense-amount').value = salary;
        document.getElementById('expense-currency').value = currency;
      });
    });

    // Обработчики удаления
    const deleteButtons = container.querySelectorAll('.chip-delete');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteEmployee(btn.dataset.employeeId);
      });
    });
  }

  async deleteEmployee(employeeId) {
    try {
      await api.request(`/employees/${employeeId}`, { method: 'DELETE' });

      this.employees = this.employees.filter(e => e.id != employeeId);
      this.setupEmployeeChips();

      notifications.success('Удалено', 'Сотрудник удален');
    } catch (error) {
      notifications.error('Ошибка', 'Не удалось удалить сотрудника');
    }
  }


  setupContractorChips(type) {
    const container = document.getElementById('contractors-chips');
    const filteredContractors = this.contractors.filter(contractor => contractor.type === type);

    container.innerHTML = filteredContractors.map(contractor => `
      <div class="chip contractor-chip" data-contractor-id="${contractor.id}">
        <span class="chip-text">${contractor.name}</span>
        <span class="chip-delete" data-contractor-id="${contractor.id}">×</span>
      </div>
    `).join('');

    const chips = container.querySelectorAll('.contractor-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-delete')) return; // Не выбираем при клике на крестик
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });

    // Обработчики удаления
    const deleteButtons = container.querySelectorAll('.chip-delete');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteContractor(btn.dataset.contractorId);
      });
    });
  }

  async deleteContractor(contractorId) {
    try {
      await api.request(`/contractors/${contractorId}`, { method: 'DELETE' });

      // Убираем из локального массива
      this.contractors = this.contractors.filter(c => c.id != contractorId);

      // Обновляем отображение
      const category = document.getElementById('expense-category').value;
      const type = category === 'cards_opening' ? 'opening' : 'renewal';
      this.setupContractorChips(type);

      notifications.success('Удалено', 'Подрядчик удален');
    } catch (error) {
      notifications.error('Ошибка', 'Не удалось удалить подрядчика');
    }
  }

  setupEmployeeHandlers() {
    const addBtn = document.getElementById('add-employee-btn');
    const form = document.getElementById('add-employee-form');
    const saveBtn = document.getElementById('save-employee-btn');
    const cancelBtn = document.getElementById('cancel-employee-btn');

    addBtn.addEventListener('click', () => {
      form.style.display = 'block';
      addBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
      addBtn.style.display = 'block';
      this.clearEmployeeForm();
    });

    saveBtn.addEventListener('click', () => {
      this.saveNewEmployee();
    });
  }

  setupContractorHandlers() {
    const addBtn = document.getElementById('add-contractor-btn');
    const form = document.getElementById('add-contractor-form');
    const saveBtn = document.getElementById('save-contractor-btn');
    const cancelBtn = document.getElementById('cancel-contractor-btn');

    addBtn.addEventListener('click', () => {
      form.style.display = 'block';
      addBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
      addBtn.style.display = 'block';
      this.clearContractorForm();
    });

    saveBtn.addEventListener('click', () => {
      this.saveNewContractor();
    });
  }

  async saveNewEmployee() {
    const name = document.getElementById('new-employee-name').value;
    const salary = document.getElementById('new-employee-salary').value;
    const currency = document.getElementById('new-employee-currency').value;

    if (!name || !salary) {
      notifications.error('Ошибка', 'Заполните все поля');
      return;
    }

    try {
      const response = await api.request('/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, salary_amount: salary, salary_currency: currency })
      });

      this.employees.push(response.employee);
      this.clearEmployeeForm();
      document.getElementById('add-employee-form').style.display = 'none';
      document.getElementById('add-employee-btn').style.display = 'block';
      this.setupEmployeeChips();
      notifications.success('Успех', 'Сотрудник добавлен');
    } catch (error) {
      notifications.error('Ошибка', 'Не удалось добавить сотрудника');
    }
  }

  async saveNewContractor() {
    const name = document.getElementById('new-contractor-name').value;
    const category = document.getElementById('expense-category').value;
    const type = category === 'cards_opening' ? 'opening' : 'renewal';

    if (!name) {
      notifications.error('Ошибка', 'Введите название подрядчика');
      return;
    }

    try {
      const response = await api.request('/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type })
      });

      this.contractors.push(response.contractor);
      this.clearContractorForm();
      document.getElementById('add-contractor-form').style.display = 'none';
      document.getElementById('add-contractor-btn').style.display = 'block';
      this.setupContractorChips(type);
      notifications.success('Успех', 'Подрядчик добавлен');
    } catch (error) {
      notifications.error('Ошибка', 'Не удалось добавить подрядчика');
    }
  }

  clearEmployeeForm() {
    document.getElementById('new-employee-name').value = '';
    document.getElementById('new-employee-salary').value = '';
    document.getElementById('new-employee-currency').value = 'USD';
  }

  clearContractorForm() {
    document.getElementById('new-contractor-name').value = '';
  }

  async loadExpenseData(expenseId) {
    try {
      // Загружаем данные расхода для редактирования
      // Пока заглушка, реализуем позже если нужно
    } catch (error) {
      console.error('Ошибка загрузки данных расхода:', error);
    }
  }

  async submitForm() {
    try {
      const formData = new FormData(document.getElementById('expense-form'));
      const expenseData = Object.fromEntries(formData.entries());

      // Валидация
      if (!expenseData.category || !expenseData.name || !expenseData.amount) {
        notifications.error('Ошибка', 'Заполните все обязательные поля');
        return;
      }

      if (parseFloat(expenseData.amount) <= 0) {
        notifications.error('Ошибка', 'Сумма должна быть больше 0');
        return;
      }

      const method = this.editingExpenseId ? 'PUT' : 'POST';
      const url = this.editingExpenseId ? `/expenses/${this.editingExpenseId}` : '/expenses';

      await api.request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      });

      notifications.success('Успех', this.editingExpenseId ? 'Расход обновлен' : 'Расход создан');

      // Обновляем список расходов
      if (window.expensesModule) {
        await window.expensesModule.loadExpenses();
        window.expensesModule.renderExpenses();
        window.expensesModule.updateSummary();
      }

      this.close();

    } catch (error) {
      console.error('Ошибка сохранения расхода:', error);
      notifications.error('Ошибка', 'Не удалось сохранить расход');
    }
  }

  showEmployeeModal() {
    // Пока заглушка для добавления нового сотрудника
    // Реализуем в следующем шаге если понадобится
    alert('Модалка добавления сотрудника - следующий шаг');
  }

  close() {
    const modal = document.getElementById('expense-modal-overlay');
    if (modal) {
      modal.remove();
    }
    this.isOpen = false;
    this.editingExpenseId = null;
  }
}

// Глобальный экземпляр
window.expenseModal = new ExpenseModal();