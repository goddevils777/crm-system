// Компонент шапки
class HeaderComponent {
    constructor() {
        this.currentUser = null;
    }

    render() {
        return `
      <header class="header">
        <div class="container">
          <div class="header-left">
            <button class="burger-btn" id="burger-btn">
              <span class="burger-line"></span>
              <span class="burger-line"></span>
              <span class="burger-line"></span>
            </button>
            <h1 class="logo">CRM System</h1>
          </div>
          <nav class="nav">
            <span id="user-info"></span>
            <button id="logout-btn" class="btn btn-secondary">Выйти</button>
          </nav>
        </div>
      </header>
    `;
    }

    mount(container) {
        container.innerHTML = this.render();
        this.setupEvents();
        this.updateUserInfo();
    }

    setupEvents() {
        const burgerBtn = document.getElementById('burger-btn');
        const logoutBtn = document.getElementById('logout-btn');

        burgerBtn?.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            const mainContainer = document.querySelector('.main .container');
            const overlay = document.querySelector('.sidebar-overlay');

            // Создаем overlay если его нет
            if (!overlay) {
                const newOverlay = document.createElement('div');
                newOverlay.className = 'sidebar-overlay';
                newOverlay.addEventListener('click', () => {
                    sidebar?.classList.remove('show');
                    newOverlay.classList.remove('show');
                });
                document.body.appendChild(newOverlay);
            }

            // На мобильных - показываем/скрываем сайдбар
            if (window.innerWidth <= 768) {
                sidebar?.classList.toggle('show');
                document.querySelector('.sidebar-overlay')?.classList.toggle('show');
            } else {
                // На десктопе - скрываем/показываем как раньше
                sidebar?.classList.toggle('hide');
                mainContainer?.classList.toggle('sidebar-hidden');
            }
        });

        logoutBtn?.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = 'auth/login.html';
        });
    }
    updateUserInfo() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const loginUsername = userData.loginUsername || userData.username || 'Пользователь';
        const role = userData.role || 'buyer';

        const roleIcons = { 'admin': '👑', 'manager': '⭐', 'buyer': '😇' };
        const roleText = { 'admin': 'Администратор', 'manager': 'Менеджер', 'buyer': 'Байер' };

        document.getElementById('user-info').innerHTML = `
      <div class="user-profile">
        <span class="user-avatar">${roleIcons[role]}</span>
        <div class="user-details">
          <div class="user-name">${loginUsername}</div>
          <div class="user-role">${roleText[role] || role}</div>
        </div>
      </div>
    `;
    }
}

window.HeaderComponent = HeaderComponent;