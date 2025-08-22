class CardEditModal {
    constructor() {
        this.modalId = 'card-edit-modal';
    }

    async open(cardId) {
        try {
            // Загружаем данные карты
            const response = await api.request(`/cards/${cardId}`);
            const card = response.card;

            console.log('Loaded card data for editing:', card);
            console.log('Card team_id:', card.team_id, '(type:', typeof card.team_id, ')');

            // Сохраняем оригинальные данные для сравнения
            this.originalCard = card;

            // Загружаем список команд
            const teamsResponse = await api.request('/teams');
            const teams = teamsResponse.teams;

            // Создаем модальное окно
            this.create(card, teams);
            this.setupEvents(cardId);

        } catch (error) {
            console.error('Error opening card edit modal:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные карты');
        }
    }

    create(card, teams = []) {
        // Удаляем существующее модальное окно
        const existing = document.getElementById(this.modalId);
        if (existing) existing.remove();

        const modalHTML = `
        <div id="${this.modalId}" class="modal show">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Редактировать карту</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <form id="card-edit-form">
                    <div class="form-tabs">
                        <button type="button" class="tab-btn active" data-tab="basic">Основные</button>
                        <button type="button" class="tab-btn" data-tab="personal">Личные данные</button>
                        <button type="button" class="tab-btn" data-tab="second-bank">Второй банк</button>
                        <button type="button" class="tab-btn" data-tab="contractor">Подрядчик</button>
                    </div>

                    <!-- Основные данные -->
                    <div class="tab-content active" data-tab="basic">
                        <div class="form-group">
                            <label class="form-label">Название карты</label>
                            <input type="text" name="name" class="form-input" value="${card.name || ''}" required>
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
                            <select name="team_id" class="form-select">
                                <option value="">Без команды</option>
                                ${teams.map(team =>
            `<option value="${team.id}" ${card.team_id == team.id ? 'selected' : ''}>${team.name}</option>`
        ).join('')}
                            </select>
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
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" value="${card.email || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Пароль email</label>
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
                            <label class="form-label">ИНН</label>
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
                            <label class="form-label">Дата запуска</label>
                            <input type="date" name="launch_date" class="form-input" value="${card.launch_date || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Дата следующего платежа</label>
                            <input type="date" name="next_payment_date" class="form-input" value="${card.next_payment_date || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Счет подрядчика</label>
                            <input type="text" name="contractor_account" class="form-input" value="${card.contractor_account || ''}">
                        </div>
                    </div>

                    

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary modal-cancel">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                    </div>
                </form>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    setupEvents(cardId) {
        const modal = document.getElementById(this.modalId);
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        const form = modal.querySelector('#card-edit-form');

        // Закрытие модального окна
        [closeBtn, cancelBtn].forEach(btn => {
            btn?.addEventListener('click', () => this.close());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // Вкладки
        this.setupTabs();

        // Отправка формы
        form.addEventListener('submit', (e) => this.handleSubmit(e, cardId));
    }

    setupTabs() {
        const modal = document.getElementById(this.modalId);
        const tabBtns = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                modal.querySelector(`[data-tab="${targetTab}"].tab-content`).classList.add('active');
            });
        });
    }

    async handleSubmit(e, cardId) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);

            const updateData = {
                name: formData.get('name'),
                currency: formData.get('currency'),
                team_id: formData.get('team_id') || null,
                full_name: formData.get('full_name'),
                bank_password: formData.get('bank_password'),
                card_password: formData.get('card_password'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                email_password: formData.get('email_password'),
                birth_date: formData.get('birth_date'),
                passport_issue_date: formData.get('passport_issue_date'),
                ipn: formData.get('ipn'),
                second_bank_phone: formData.get('second_bank_phone'),
                second_bank_pin: formData.get('second_bank_pin'),
                second_bank_email: formData.get('second_bank_email'),
                second_bank_password: formData.get('second_bank_password'),
                contractor_name: formData.get('contractor_name'),
                launch_date: formData.get('launch_date'),
                next_payment_date: formData.get('next_payment_date'),
                contractor_account: formData.get('contractor_account'),
                remaining_balance: formData.get('remaining_balance'),
                commission_amount: formData.get('commission_amount')
            };

            // Проверяем изменилась ли команда
            const currentTeamId = this.originalCard.team_id;
            const newTeamId = updateData.team_id;

            // Приводим к одному типу для сравнения
            const normalizedCurrent = currentTeamId ? String(currentTeamId) : null;
            const normalizedNew = newTeamId ? String(newTeamId) : null;

            console.log('Team comparison:');
            console.log('- Current team ID:', currentTeamId, '(type:', typeof currentTeamId, ')');
            console.log('- New team ID:', newTeamId, '(type:', typeof newTeamId, ')');
            console.log('- Normalized current:', normalizedCurrent);
            console.log('- Normalized new:', normalizedNew);

            if (normalizedCurrent !== normalizedNew) {
                console.log('Team changed, calling change-team API');
                // Сначала меняем команду (это снимет назначение с баера)
                const changeTeamResponse = await api.request(`/cards/${cardId}/change-team`, {
                    method: 'PUT',
                    body: JSON.stringify({ team_id: newTeamId })
                });
                console.log('Change team API response:', changeTeamResponse);
            }

            // Обновляем все данные карты (включая team_id)
            const updateResponse = await api.request(`/cards/${cardId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            console.log('Card update API response:', updateResponse);

            notifications.success('Карта обновлена', 'Изменения успешно сохранены');
            this.close();

            // Безопасное обновление данных - только если соответствующие модули активны
            if (window.cardDetailModule && window.location.hash.includes('#card/')) {
                try {
                    await window.cardDetailModule.loadCard();
                    window.cardDetailModule.fillCardInfo();
                } catch (error) {
                    console.log('Card detail update skipped:', error.message);
                }
            }

            // Обновляем список карт если модуль загружен
            if (window.cardsModule) {
                try {
                    await window.cardsModule.loadCards();
                    window.cardsModule.renderCards();
                } catch (error) {
                    console.log('Cards list update skipped:', error.message);
                }
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