class CardEditModal {
    constructor() {
        this.modalId = 'card-edit-modal';
    }

    async open(cardId) {
        try {
            // Загружаем данные карты
            const response = await api.request(`/cards/${cardId}`);
            const card = response.card;

            // Загружаем команды
            const teamsResponse = await api.request('/teams');
            const teams = teamsResponse.teams || [];

            this.createModal(card, teams);
        } catch (error) {
            console.error('Error loading card for edit:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные карты');
        }
    }

    createModal(card, teams) {
    // Удаляем существующий модал если есть
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = this.modalId;

    const teamsOptions = teams.map(team =>
        `<option value="${team.id}" ${card.team_id == team.id ? 'selected' : ''}>${team.name}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Редактировать карту: ${card.name}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <form id="edit-card-form">
                <div class="form-tabs">
                    <button type="button" class="tab-btn active" data-tab="basic">Основные</button>
                    <button type="button" class="tab-btn" data-tab="requisites">Реквизиты</button>
                    <button type="button" class="tab-btn" data-tab="personal">Личные данные</button>
                    <button type="button" class="tab-btn" data-tab="second-bank">Второй банк</button>
                    <button type="button" class="tab-btn" data-tab="contractor">Подрядчик</button>
                </div>

                <!-- Основные -->
                <div class="tab-content active" data-tab="basic">
                    <div class="form-group">
                        <label class="form-label">Название карты</label>
                        <input type="text" name="name" class="form-input" required value="${card.name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Валюта</label>
                        <select name="currency" class="form-select">
                            <option value="USD" ${card.currency === 'USD' ? 'selected' : ''}>USD - Доллары США</option>
                            <option value="EUR" ${card.currency === 'EUR' ? 'selected' : ''}>EUR - Евро</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Команда</label>
                        <select name="team_id" class="form-select" id="edit-team-select">
                            <option value="">Без команды</option>
                            ${teamsOptions}
                        </select>
                    </div>
                    <div class="form-group" id="buyer-select-group" style="display: none;">
                        <label class="form-label">Баер</label>
                        <select name="buyer_id" class="form-select" id="edit-buyer-select">
                            <option value="">Без баера</option>
                        </select>
                    </div>
                </div>

                <!-- Реквизиты -->
                <div class="tab-content" data-tab="requisites">
                    <div class="form-group">
                        <label class="form-label">Номер карты</label>
                        <input type="text" name="card_number" class="form-input" value="${card.card_number || ''}" maxlength="16">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата завершения (MM/YY)</label>
                        <input type="text" name="expiry_date" class="form-input" value="${card.expiry_date || ''}" maxlength="5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">CVV код</label>
                        <input type="text" name="cvv_code" class="form-input" value="${card.cvv_code || ''}" maxlength="3">
                    </div>
                    <div class="form-group">
                        <label class="form-label">IBAN</label>
                        <input type="text" name="iban" class="form-input" value="${card.iban || ''}">
                    </div>
                </div>

                <!-- Личные данные -->
                <div class="tab-content" data-tab="personal">
                    <div class="form-group">
                        <label class="form-label">ПІБ</label>
                        <input type="text" name="full_name" class="form-input" value="${card.full_name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль банк</label>
                        <input type="password" name="bank_password" class="form-input" value="${card.bank_password || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль карты</label>
                        <input type="password" name="card_password" class="form-input" value="${card.card_password || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Телефон</label>
                        <input type="tel" name="phone" class="form-input" value="${card.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Почта</label>
                        <input type="email" name="email" class="form-input" value="${card.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль почты</label>
                        <input type="password" name="email_password" class="form-input" value="${card.email_password || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата рождения</label>
                        <input type="date" name="birth_date" class="form-input" value="${card.birth_date || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата выдачи паспорта</label>
                        <input type="date" name="passport_issue_date" class="form-input" value="${card.passport_issue_date || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ІПН</label>
                        <input type="text" name="ipn" class="form-input" value="${card.ipn || ''}">
                    </div>
                </div>

                <!-- Второй банк -->
                <div class="tab-content" data-tab="second-bank">
                    <div class="form-group">
                        <label class="form-label">Телефон второго банка</label>
                        <input type="tel" name="second_bank_phone" class="form-input" value="${card.second_bank_phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пин второго банка</label>
                        <input type="text" name="second_bank_pin" class="form-input" value="${card.second_bank_pin || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Почта второго банка</label>
                        <input type="email" name="second_bank_email" class="form-input" value="${card.second_bank_email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль второго банка</label>
                        <input type="password" name="second_bank_password" class="form-input" value="${card.second_bank_password || ''}">
                    </div>
                </div>

                <!-- Подрядчик -->
                <div class="tab-content" data-tab="contractor">
                    <div class="form-group">
                        <label class="form-label">Имя подрядчика</label>
                        <input type="text" name="contractor_name" class="form-input" value="${card.contractor_name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата запуска карты</label>
                        <input type="date" name="launch_date" class="form-input" value="${card.launch_date || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата следующей оплаты</label>
                        <input type="date" name="next_payment_date" class="form-input" value="${card.next_payment_date || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Счет подрядчика</label>
                        <input type="text" name="contractor_account" class="form-input" value="${card.contractor_account || ''}">
                    </div>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel" onclick="this.closest('.modal').remove()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    // Обработчик закрытия по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
    });

    // Обработчик переключения вкладок
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = e.target.dataset.tab;

            // Убираем активные классы
            modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Добавляем активные классы
            e.target.classList.add('active');
            modal.querySelector(`.tab-content[data-tab="${tab}"]`).classList.add('active');
        });
    });

    // Обработчик смены команды
    const teamSelect = modal.querySelector('#edit-team-select');
    const buyerSelect = modal.querySelector('#edit-buyer-select');
    const buyerGroup = modal.querySelector('#buyer-select-group');

teamSelect?.addEventListener('change', async (e) => {
    const teamId = e.target.value;
    
    console.log('=== TEAM CHANGE DEBUG ===');
    console.log('Selected team ID:', teamId);
    
    if (teamId) {
        buyerGroup.style.display = 'block';
        
        try {
            const buyersResponse = await api.request(`/teams/${teamId}/buyers`);
            console.log('Buyers API response:', buyersResponse);
            console.log('Buyers array:', buyersResponse.buyers);
            
            const buyers = buyersResponse.buyers || [];
            console.log('Final buyers array:', buyers);
            
            if (buyers.length > 0) {
                buyers.forEach((buyer, index) => {
                    console.log(`Buyer ${index}:`, buyer);
                    console.log(`- ID: ${buyer.id}`);
                    console.log(`- Name: ${buyer.name || buyer.username}`);
                });
            }
            
            // Заполняем список баеров
            const buyersOptions = buyers.map(buyer => 
                `<option value="${buyer.id}" ${card.buyer_id == buyer.id ? 'selected' : ''}>${buyer.name || buyer.username}</option>`
            ).join('');
            
            console.log('Generated options HTML:', buyersOptions);
            
            buyerSelect.innerHTML = '<option value="">Без баера</option>' + buyersOptions;
            
        } catch (error) {
            console.error('Error loading buyers:', error);
            notifications.error('Ошибка', 'Не удалось загрузить список баеров');
        }
    } else {
        buyerGroup.style.display = 'none';
        buyerSelect.value = '';
    }
});

    // Инициализируем при загрузке если команда уже выбрана
    if (card.team_id) {
        teamSelect.dispatchEvent(new Event('change'));
    }

    // Инициализация форматирования поля даты
    this.initEditFormFormatting(modal);

    // Обработчик формы
    document.getElementById('edit-card-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit(card.id);
    });
}

    // ДОБАВИТЬ: Метод для инициализации форматирования в модале редактирования
    initEditFormFormatting(modal) {
        const expiryInput = modal.querySelector('input[name="expiry_date"]');
        if (expiryInput) {
            expiryInput.addEventListener('input', function (e) {
                let value = e.target.value.replace(/[^\d]/g, '');

                if (value.length > 4) {
                    value = value.substring(0, 4);
                }

                if (value.length >= 3) {
                    value = value.substring(0, 2) + '/' + value.substring(2);
                }

                e.target.value = value;
            });

            expiryInput.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace') {
                    const cursorPos = e.target.selectionStart;
                    if (cursorPos === 3 && e.target.value.charAt(2) === '/') {
                        e.target.value = e.target.value.substring(0, 1) + e.target.value.substring(3);
                        e.target.setSelectionRange(1, 1);
                        e.preventDefault();
                    }
                }

                if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                }
            });
        }
    }

    async handleSubmit(cardId) {
        try {
            const form = document.getElementById('edit-card-form');
            const formData = new FormData(form);

            const updateData = {
                name: formData.get('name'),
                currency: formData.get('currency'),
                team_id: formData.get('team_id') || null,
                buyer_id: formData.get('buyer_id') || null,
                full_name: formData.get('full_name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                bank_password: formData.get('bank_password'),
                card_password: formData.get('card_password'),
                email_password: formData.get('email_password'),
                birth_date: formData.get('birth_date'),
                passport_issue_date: formData.get('passport_issue_date'),
                ipn: formData.get('ipn'),
                second_bank_phone: formData.get('second_bank_phone'),
                second_bank_pin: formData.get('second_bank_pin'),
                second_bank_email: formData.get('second_bank_email'),
                second_bank_password: formData.get('second_bank_password'),
                contractor_name: formData.get('contractor_name'),
                contractor_account: formData.get('contractor_account'),
                launch_date: formData.get('launch_date'),
                next_payment_date: formData.get('next_payment_date'),
                card_number: formData.get('card_number'),
                expiry_date: formData.get('expiry_date'),
                cvv_code: formData.get('cvv_code'),
                iban: formData.get('iban')
            };

            await api.request(`/cards/${cardId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            notifications.success('Карта обновлена', 'Изменения успешно сохранены');
            this.close();

            // Обновляем данные если модули активны
            if (window.cardDetailModule && window.location.hash.includes('#card/')) {
                await window.cardDetailModule.loadCard();
                window.cardDetailModule.fillCardInfo();
            }

            if (window.cardsModule) {
                await window.cardsModule.loadCards();
                window.cardsModule.renderCards();
            }

        } catch (error) {
            console.error('Error updating card:', error);
            notifications.error('Ошибка', 'Не удалось сохранить изменения');
        }
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.remove();
    }
}

window.CardEditModal = CardEditModal;