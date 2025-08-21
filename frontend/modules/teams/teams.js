// Модуль команд
class TeamsModule {
    constructor() {
        this.teams = [];
        this.currentView = 'grid';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadTeams();
        this.renderTeams();
    }

    setupEventListeners() {
        // Кнопка добавления команды
        const addBtn = document.getElementById('add-team-btn');
        addBtn?.addEventListener('click', () => this.showAddModal());

        // Переключение видов - УЛУЧШЕННАЯ ВЕРСИЯ
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const view = e.currentTarget.dataset.view;
                if (view && view !== this.currentView) {
                    this.switchView(view);
                }
            });
        });

        // Модальное окно
        this.setupModalEvents();
    }

    setupModalEvents() {
        const modal = document.getElementById('team-modal');
        const form = document.getElementById('team-form');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');

        // Закрытие модального окна
        closeBtn?.addEventListener('click', () => this.hideModal());
        cancelBtn?.addEventListener('click', () => this.hideModal());

        // Закрытие по клику вне модального окна
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal();
        });

        // Отправка формы
        form?.addEventListener('submit', (e) => this.handleTeamSubmit(e));
    }

    showAddModal() {
        const modal = document.getElementById('team-modal');
        modal?.classList.add('show');
    }

    hideModal() {
        const modal = document.getElementById('team-modal');
        const form = document.getElementById('team-form');
        const title = modal.querySelector('.modal-header h3');
        const submitBtn = form.querySelector('button[type="submit"]');

        modal?.classList.remove('show');
        form?.reset();

        // Сбрасываем режим редактирования
        delete form.dataset.editTeamId;
        title.textContent = 'Добавить команду';
        submitBtn.textContent = 'Создать';
    }

    async handleTeamSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const teamData = {
            name: formData.get('name').trim()
        };

        if (!teamData.name) {
            notifications.error('Ошибка', 'Введите название команды');
            return;
        }

        const editTeamId = e.target.dataset.editTeamId;

        if (editTeamId) {
            // Редактирование существующей команды
            await this.handleEditSubmit(teamData, editTeamId);
        } else {
            // Создание новой команды
            try {
                await api.request('/teams', {
                    method: 'POST',
                    body: JSON.stringify(teamData)
                });

                this.hideModal();
                await this.loadTeams();
                this.renderTeams();
                notifications.success('Успех', 'Команда создана');
            } catch (error) {
                console.error('Ошибка создания команды:', error);
                notifications.error('Ошибка', 'Не удалось создать команду');
            }
        }
    }

    async loadTeams() {
        try {
            const response = await api.request('/teams');
            this.teams = response.teams || [];
            console.log('Загружено команд:', this.teams.length);
        } catch (error) {
            console.error('Ошибка загрузки команд:', error);
            this.teams = [];
            notifications.error('Ошибка', 'Не удалось загрузить команды');
        }
    }

    renderTeams() {
        if (this.currentView === 'grid') {
            this.renderGrid();
        } else {
            this.renderTable();
        }
    }



    renderGrid() {
        const container = document.getElementById('teams-container');

        if (this.teams.length === 0) {
            container.innerHTML = '<p>Команд пока нет. Добавьте первую команду.</p>';
            return;
        }

        const teamsHtml = this.teams.map(team => `
        <div class="team-card" data-team-id="${team.id}" onclick="teamsModule.openTeamDetail(${team.id})">
            <div class="team-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 class="team-title">${team.name}</h3>
<div class="team-card-actions">
    <button class="team-action-btn edit" onclick="event.stopPropagation(); teamsModule.editTeam(${team.id})" title="Редактировать">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-.4 2.2.1 4.5 1.4 6.2.9 1.2 2.2 1.9 3.8 1.9z"/>
        </svg>
    </button>
    <button class="team-action-btn delete" onclick="event.stopPropagation(); teamsModule.deleteTeam(${team.id})" title="Удалить">
        <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
        </svg>
    </button>
</div>
                </div>
            </div>
            <div class="team-stats">
                <div class="team-stat">
                    <div class="team-stat-value">${team.buyers_count || 0}</div>
                    <div class="team-stat-label">Баеров</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-value">${team.cards_count || 0}</div>
                    <div class="team-stat-label">Карт</div>
                </div>
            </div>
        </div>
    `).join('');

        container.innerHTML = teamsHtml;
    }

    switchView(view) {
        console.log('Switching to view:', view, 'from:', this.currentView);

        // Предотвращаем повторное переключение
        if (this.currentView === view) return;

        this.currentView = view;

        // Обновляем активную кнопку
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`.view-btn[data-view="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Показываем нужный контейнер
        const gridContainer = document.getElementById('teams-container');
        const tableContainer = document.getElementById('teams-table-container');

        if (view === 'grid') {
            if (gridContainer) gridContainer.style.display = 'grid';
            if (tableContainer) tableContainer.style.display = 'none';
        } else {
            if (gridContainer) gridContainer.style.display = 'none';
            if (tableContainer) tableContainer.style.display = 'block';
        }

        // Перерисовываем контент
        setTimeout(() => this.renderTeams(), 50);
    }
    renderTable() {
        const container = document.getElementById('teams-table-container');
        const tbody = container?.querySelector('#teams-table-body');

        if (!tbody) return;

        if (this.teams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Команд пока нет</td></tr>';
            return;
        }

        const teamsHtml = this.teams.map(team => `
        <tr data-team-id="${team.id}">
            <td>
                <a href="#" class="team-name-link" onclick="teamsModule.openTeamDetail(${team.id}); return false;">
                    ${team.name}
                </a>
            </td>
            <td>${team.buyers_count || 0}</td>
            <td>${team.cards_count || 0}</td>
            <td>${new Date(team.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
<div class="team-table-actions">
    <button class="team-table-action-btn secondary" onclick="teamsModule.editTeam(${team.id})" title="Изменить">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.9-3.9 3.9-10.2 0-14.1L694.9 114.9c-1.9-1.9-4.4-2.9-7.1-2.9s-5.2 1-7.1 2.9L256.8 538.8c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2c-.4 2.2.1 4.5 1.4 6.2.9 1.2 2.2 1.9 3.8 1.9z"/>
        </svg>
    </button>
    <button class="team-table-action-btn delete" onclick="teamsModule.deleteTeam(${team.id})" title="Удалить">
        <svg width="12" height="12" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9c-4.4 5.2-.7 13.1 6.1 13.1h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
        </svg>
    </button>
</div>
            </td>
        </tr>
    `).join('');

        tbody.innerHTML = teamsHtml;
    }

    openTeamDetail(teamId) {
        // Сохраняем ID команды
        localStorage.setItem('current_team_detail', teamId);

        // Обновляем URL
        window.history.pushState({ module: 'team-detail', teamId: teamId }, '', `#team/${teamId}`);

        // Загружаем детальную страницу
        this.loadTeamDetail(teamId);
    }

    async loadTeamDetail(teamId) {
        try {
            const contentArea = document.getElementById('content-area');
            contentArea.style.opacity = '0';

            // Показываем лоадер
            setTimeout(() => {
                contentArea.innerHTML = `
                <div class="module-loader">
                    <div class="loader-spinner"></div>
                    <p>Загрузка команды...</p>
                </div>
            `;
                contentArea.style.opacity = '1';
            }, 50);

            // Загружаем HTML детальной страницы
            const htmlResponse = await fetch('modules/teams/team-detail.html');
            const html = await htmlResponse.text();

            // Загружаем CSS если еще не загружен
            if (!document.querySelector('link[href*="team-detail.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'modules/teams/team-detail.css';
                document.head.appendChild(link);
            }

            // Загружаем JS модуль
            if (!window.TeamDetailModule) {
                const script = document.createElement('script');
                script.src = 'modules/teams/team-detail.js';
                document.head.appendChild(script);

                // Ждем загрузки скрипта
                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }

            // Вставляем HTML
            contentArea.style.opacity = '0';
            setTimeout(() => {
                contentArea.innerHTML = html;
                contentArea.style.opacity = '1';

                // Инициализируем модуль детальной страницы
                setTimeout(() => {
                    window.teamDetailModule = new window.TeamDetailModule();
                }, 100);
            }, 100);

        } catch (error) {
            console.error('Ошибка загрузки детальной страницы:', error);
            notifications.error('Ошибка', 'Не удалось загрузить страницу команды');
        }
    }


    async editTeam(teamId) {
        try {
            const response = await api.request(`/teams/${teamId}`);
            const team = response.team;
            this.showEditModal(team);
        } catch (error) {
            console.error('Ошибка получения данных команды:', error);
            notifications.error('Ошибка', 'Не удалось загрузить данные команды');
        }
    }


    showEditModal(team) {
        const modal = document.getElementById('team-modal');
        const form = document.getElementById('team-form');
        const title = modal.querySelector('.modal-header h3');
        const submitBtn = form.querySelector('button[type="submit"]');
        const nameInput = form.querySelector('input[name="name"]');

        // Меняем заголовок и кнопку
        title.textContent = 'Редактировать команду';
        submitBtn.textContent = 'Сохранить';

        // Заполняем форму данными команды
        nameInput.value = team.name;

        // Сохраняем ID команды для редактирования
        form.dataset.editTeamId = team.id;

        modal.classList.add('show');
    }

    async handleEditSubmit(teamData, teamId) {
        try {
            await api.request(`/teams/${teamId}`, {
                method: 'PUT',
                body: JSON.stringify(teamData)
            });

            this.hideModal();
            await this.loadTeams();
            this.renderTeams();
            notifications.success('Успех', 'Команда обновлена');
        } catch (error) {
            console.error('Ошибка редактирования команды:', error);
            notifications.error('Ошибка', 'Не удалось обновить команду');
        }
    }

    async deleteTeam(teamId) {
        const team = this.teams.find(t => t.id === teamId);
        if (!team) {
            notifications.error('Ошибка', 'Команда не найдена');
            return;
        }

        // Временно используем стандартный confirm пока не исправим showConfirm
        const confirmed = await confirmDelete(`Вы уверены, что хотите удалить команду "${team.name}"?`);
        if (!confirmed) return;

        try {
            await api.request(`/teams/${teamId}`, { method: 'DELETE' });
            await this.loadTeams();
            this.renderTeams();
            notifications.success('Успех', `Команда "${team.name}" удалена`);
        } catch (error) {
            console.error('Ошибка удаления команды:', error);
            notifications.error('Ошибка удаления', error.message || 'Не удалось удалить команду');
        }
    }
}



// Инициализация модуля
window.TeamsModule = TeamsModule;

console.log('TeamsModule script loaded, class available:', typeof TeamsModule);