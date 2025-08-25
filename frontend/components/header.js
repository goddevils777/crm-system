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
    const sidebar = document.querySelector('.sidebar');
    const mainContainer = document.querySelector('.main .container');

    // ДОБАВИЛИ: Состояние сайдбара с сохранением в localStorage
    let isManuallyOpened = localStorage.getItem('sidebar_manually_opened') === 'true';

    // Восстанавливаем состояние при загрузке
    if (window.innerWidth > 768) {
        if (isManuallyOpened) {
            sidebar?.classList.remove('hide');
            mainContainer?.classList.remove('sidebar-hidden');
        } else {
            sidebar?.classList.add('hide');
            mainContainer?.classList.add('sidebar-hidden');
        }
    }

    // Создаем overlay для мобильных
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', () => {
            sidebar?.classList.remove('show');
            overlay.classList.remove('show');
        });
        document.body.appendChild(overlay);
    }

    if (burgerBtn) {
        let hoverTimeout;

        const showSidebar = () => {
            if (window.innerWidth > 768 && !isManuallyOpened) {
                sidebar?.classList.remove('hide');
                mainContainer?.classList.remove('sidebar-hidden');
            }
        };

        const hideSidebar = () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                if (window.innerWidth > 768 && !isManuallyOpened) {
                    sidebar?.classList.add('hide');
                    mainContainer?.classList.add('sidebar-hidden');
                }
            }, 400);
        };

        const cancelHide = () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
        };

        // Hover на бургере
        burgerBtn.addEventListener('mouseenter', showSidebar);
        burgerBtn.addEventListener('mouseleave', hideSidebar);

        // Hover на сайдбаре (вся область sidebar)
        const sidebarContainer = document.getElementById('sidebar-container');
        sidebarContainer?.addEventListener('mouseenter', cancelHide);
        sidebarContainer?.addEventListener('mouseleave', hideSidebar);

        // Дополнительно на самом sidebar элементе
        sidebar?.addEventListener('mouseenter', cancelHide);
        sidebar?.addEventListener('mouseleave', hideSidebar);

        // Клик на бургер - для мобильных и переключения постоянного состояния на десктопе
        burgerBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                // На мобильных - показать/скрыть сайдбар
                const sidebarContainer = document.getElementById('sidebar-container');
                sidebar?.classList.toggle('show');
                sidebarContainer?.classList.toggle('show');
                overlay.classList.toggle('show');
            } else {
                // На десктопе - переключить постоянное состояние
                isManuallyOpened = !isManuallyOpened;
                localStorage.setItem('sidebar_manually_opened', isManuallyOpened.toString());
                
                if (isManuallyOpened) {
                    sidebar?.classList.remove('hide');
                    mainContainer?.classList.remove('sidebar-hidden');
                } else {
                    sidebar?.classList.add('hide');
                    mainContainer?.classList.add('sidebar-hidden');
                }
            }
        });
    }

    // НОВОЕ: Автозакрытие на мобильных при выборе модуля
    sidebar?.addEventListener('click', (e) => {
        const menuItem = e.target.closest('[data-module]');
        if (menuItem && window.innerWidth <= 768) {
            // Закрываем сайдбар на мобильных после выбора модуля
            setTimeout(() => {
                const sidebarContainer = document.getElementById('sidebar-container');
                sidebar.classList.remove('show');
                sidebarContainer?.classList.remove('show');
                overlay.classList.remove('show');
            }, 150);
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