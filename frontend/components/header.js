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
            <div class="theme-toggle" id="theme-toggle" title="Переключить тему">
              <input type="checkbox" id="theme-checkbox" class="theme-checkbox">
              <label for="theme-checkbox" class="theme-slider">
                <span class="theme-icon sun">☀️</span>
                <span class="theme-icon moon">🌙</span>
              </label>
            </div>
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
    
    // Применяем сохраненную тему при загрузке
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButton(savedTheme);
}


    toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        // Сохраняем выбор
        localStorage.setItem('theme', newTheme);

        // Применяем тему
        document.documentElement.setAttribute('data-theme', newTheme);

        // Обновляем кнопку
        this.updateThemeButton(newTheme);

        console.log(`Тема переключена на: ${newTheme}`);
    }

    // ДОБАВИТЬ метод updateThemeButton:

updateThemeButton(theme) {
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        themeCheckbox.checked = theme === 'dark';
    }
}

    setupEvents() {
        console.log('=== HEADER SETUP EVENTS ===');
        const burgerBtn = document.getElementById('burger-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const sidebar = document.querySelector('.sidebar');
        const mainContainer = document.querySelector('.main .container');

        console.log('Elements found:');
        console.log('- Burger button:', !!burgerBtn);
        console.log('- Sidebar:', !!sidebar);
        console.log('- Main container:', !!mainContainer);
        console.log('- Window width:', window.innerWidth);

        // Состояние сайдбара с сохранением в localStorage
        let isManuallyOpened = localStorage.getItem('sidebar_manually_opened') === 'true';
        console.log('- Manual opened state:', isManuallyOpened);

        // Восстанавливаем состояние при загрузке только для десктопа
        if (window.innerWidth > 768) {
            console.log('Desktop mode - restoring sidebar state');
            if (isManuallyOpened) {
                sidebar?.classList.remove('hide');
                mainContainer?.classList.remove('sidebar-hidden');
            } else {
                sidebar?.classList.add('hide');
                mainContainer?.classList.add('sidebar-hidden');
            }
        } else {
            console.log('Mobile mode detected');
        }

        // Создаем overlay для мобильных
        let overlay = document.querySelector('.sidebar-overlay');
        console.log('Existing overlay:', !!overlay);

        if (!overlay) {
            console.log('Creating new overlay');
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => {
                console.log('Overlay clicked - closing sidebar');
                sidebar?.classList.remove('show');
                document.getElementById('sidebar-container')?.classList.remove('show');
                overlay.classList.remove('show');
            });
            document.body.appendChild(overlay);
            console.log('Overlay created and added to body');
        }

        if (burgerBtn) {
            console.log('Setting up burger button events');

            let hoverTimeout;

            const showSidebar = () => {
                if (window.innerWidth > 768 && !isManuallyOpened) {
                    console.log('Showing sidebar on hover (desktop)');
                    sidebar?.classList.remove('hide');
                    mainContainer?.classList.remove('sidebar-hidden');
                }
            };

            const hideSidebar = () => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    if (window.innerWidth > 768 && !isManuallyOpened) {
                        console.log('Hiding sidebar after hover timeout (desktop)');
                        sidebar?.classList.add('hide');
                        mainContainer?.classList.add('sidebar-hidden');
                    }
                }, 400);
            };

            const cancelHide = () => {
                if (hoverTimeout) {
                    console.log('Canceling sidebar hide timeout');
                    clearTimeout(hoverTimeout);
                }
            };

            // Hover эффекты только для десктопа
            if (window.innerWidth > 768) {
                console.log('Setting up desktop hover effects');
                burgerBtn.addEventListener('mouseenter', showSidebar);
                burgerBtn.addEventListener('mouseleave', hideSidebar);

                const sidebarContainer = document.getElementById('sidebar-container');
                sidebarContainer?.addEventListener('mouseenter', cancelHide);
                sidebarContainer?.addEventListener('mouseleave', hideSidebar);
                sidebar?.addEventListener('mouseenter', cancelHide);
                sidebar?.addEventListener('mouseleave', hideSidebar);
            }

            // Клик на бургер
            burgerBtn.addEventListener('click', () => {
                console.log('=== BURGER CLICKED ===');
                console.log('Window width:', window.innerWidth);

                if (window.innerWidth <= 768) {
                    console.log('Mobile burger click detected');

                    const sidebarContainer = document.getElementById('sidebar-container');

                    // ДОБАВИТЬ: Принудительная очистка состояния перед проверкой
                    console.log('Classes before cleanup:');
                    console.log('- Sidebar:', sidebar?.className);
                    console.log('- Container:', sidebarContainer?.className);
                    console.log('- Overlay:', overlay?.className);

                    const isVisible = sidebar?.classList.contains('show');
                    console.log('Sidebar is currently visible:', isVisible);

                    if (isVisible) {
                        console.log('Hiding sidebar');
                        sidebar?.classList.remove('show');
                        sidebarContainer?.classList.remove('show');
                        overlay.classList.remove('show');
                    } else {
                        console.log('Showing sidebar');
                        // Принудительно очищаем все возможные классы перед показом
                        sidebar?.classList.remove('hide', 'show');
                        sidebarContainer?.classList.remove('show');
                        overlay?.classList.remove('show');

                        // Принудительное обновление DOM
                        requestAnimationFrame(() => {
                            // Добавляем нужные классы
                            sidebar?.classList.add('show');
                            sidebarContainer?.classList.add('show');
                            overlay?.classList.add('show');

                            console.log('Force DOM update completed');
                            console.log('- Sidebar after force update:', sidebar?.className);
                            console.log('- Container after force update:', sidebarContainer?.className);
                            console.log('- Overlay after force update:', overlay?.className);
                        });
                    }

                    console.log('Classes after operation:');
                    console.log('- Sidebar:', sidebar?.className);
                    console.log('- Container:', sidebarContainer?.className);
                    console.log('- Overlay:', overlay?.className);

                } else {
                    console.log('Desktop burger click - toggling permanent state');
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

        } else {
            console.error('Burger button not found!');
        }


        logoutBtn?.addEventListener('click', () => {
            console.log('Logout button clicked');
            if (window.app) {
                window.app.logout();
            }
        });

        // Тумблер переключения темы
        const themeCheckbox = document.getElementById('theme-checkbox');
        themeCheckbox?.addEventListener('change', () => {
            this.toggleTheme();
        });

        window.addEventListener('mobileSidebarClosed', () => {
            console.log('Received mobile sidebar closed event - sidebar state reset');
        });

        console.log('=== HEADER SETUP COMPLETE ===');

        document.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem && window.innerWidth <= 768) {
                console.log('Menu item clicked - closing mobile sidebar');
                setTimeout(() => {
                    sidebar?.classList.remove('show');
                    document.getElementById('sidebar-container')?.classList.remove('show');
                    overlay?.classList.remove('show');
                }, 100);
            }
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