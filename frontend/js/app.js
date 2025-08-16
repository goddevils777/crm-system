// Основное приложение
class App {
    constructor() {
        this.currentUser = null;
        this.currentModule = null;
        this.init();
    }
    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.renderMenu();

        // ДОБАВЬ АВТОЗАГРУЗКУ ПОСЛЕДНЕГО МОДУЛЯ:
        const lastModule = localStorage.getItem('active_module');
        if (lastModule) {
            this.loadModule(lastModule);
            // Подсвечиваем активный пункт меню
            setTimeout(() => {
                const activeLink = document.querySelector(`[data-module="${lastModule}"]`);
                if (activeLink) this.setActiveMenuItem(activeLink);
            }, 100);
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.showLogin();
            return;
        }

        try {
            // Здесь можно добавить проверку валидности токена
            // Пока просто показываем интерфейс
            this.showMainInterface();
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            this.showLogin();
        }
    }

    setupEventListeners() {
        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    renderMenu() {
        const menu = document.getElementById('main-menu');
        if (!menu) return;

        const menuItems = [
            {
                id: 'cards', title: 'Карты', icon: `
      <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 632H136v-39.9l138.5-164.3 150.1 178L658.1 489 888 761.6V792zm0-129.8L664.2 396.8c-3.2-3.8-9.1-3.8-12.3 0L424.6 666.4l-144-170.7c-3.2-3.8-9.1-3.8-12.3 0L136 652.7V232h752v430.2z"/>
      </svg>
    ` },
            {
                id: 'expenses', title: 'Расходы', icon: `
      <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
        <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/>
      </svg>
    ` },
            {
                id: 'teams', title: 'Команды', icon: `
      <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M824.2 699.9a301.55 301.55 0 0 0-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a301.55 301.55 0 0 0-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 0 1 612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 839.9 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 0 0 8-8.2c-2-77-33-149.2-87.7-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 0 1-37.5-90.5c0-34.2 13.3-66.4 37.5-90.5C545.6 369.3 577.8 356 612 356s66.4 13.3 90.5 37.5C726.7 417.6 740 449.8 740 484s-13.3 66.4-37.5 90.5C678.4 598.7 646.2 612 612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-91.4c0-34.5 13.7-66.9 38.7-91.4C348.6 195.3 381 181.5 415.5 181.5s66.9 13.8 91.4 38.7c24.7 24.5 38.7 57.1 38.7 91.4 0 34.5-13.8 66.9-38.7 91.4a127.54 127.54 0 0 1-91.4 38.7c-22.4 0-43.8-5.7-62.8-15.7l-2.1-1.1c-3.8-2-8.4-.9-10.4 2.9a251.34 251.34 0 0 0-29.4 71.6c-.8 3.6 1.2 7.4 4.8 8.3 6.9 1.8 13.8 3.8 20.7 6.1-.2-2.8-.4-5.5-.7-8.3z"/>
      </svg>
    ` },
            {
                id: 'income', title: 'Доходы', icon: `
      <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M890.5 755.3L537.9 269.2c-12.8-17.6-39-17.6-51.7 0L133.5 755.3A8 8 0 0 0 140 768h75c5.1 0 9.9-2.5 12.9-6.6L512 369.8l284.1 391.6c3 4.1 7.8 6.6 12.9 6.6h75c6.5 0 10.3-7.4 6.5-12.7z"/>
        <path d="M890.5 755.3L537.9 269.2c-12.8-17.6-39-17.6-51.7 0L133.5 755.3A8 8 0 0 0 140 768h75c5.1 0 9.9-2.5 12.9-6.6L512 369.8l284.1 391.6c3 4.1 7.8 6.6 12.9 6.6h75c6.5 0 10.3-7.4 6.5-12.7z"/>
      </svg>
    ` },
            {
                id: 'analytics', title: 'Аналитика', icon: `
      <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M888 792H200V168c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h752c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8z"/>
        <path d="M288 604a64 64 0 1 0 128 0 64 64 0 1 0-128 0zm118-224a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm158 228a96 96 0 1 0 192 0 96 96 0 1 0-192 0zm148-314a56 56 0 1 0 112 0 56 56 0 1 0-112 0z"/>
      </svg>
    ` }
        ];

        menu.innerHTML = menuItems.map(item => `
    <li>
      <a href="#" data-module="${item.id}" class="menu-item">
        <span class="menu-icon">${item.icon}</span>
        <span class="menu-text">${item.title}</span>
      </a>
    </li>
  `).join('');

        // Обработчики клика по меню
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.menu-item');
            if (link) {
                const module = link.dataset.module;
                this.loadModule(module);
                this.setActiveMenuItem(link);
            }
        });
    }

    setActiveMenuItem(activeLink) {
        document.querySelectorAll('.menu-item').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

async loadModule(moduleName) {
  localStorage.setItem('active_module', moduleName);
  
  const contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  // Обновляем favicon и title в зависимости от модуля
  const moduleConfig = {
    'cards': { icon: '💳', title: 'Карты' },
    'expenses': { icon: '💰', title: 'Расходы' },
    'teams': { icon: '👥', title: 'Команды' },
    'income': { icon: '📈', title: 'Доходы' },
    'analytics': { icon: '📊', title: 'Аналитика' }
  };

  const config = moduleConfig[moduleName] || { icon: '📊', title: 'CRM' };
  
  // Обновляем только title БЕЗ иконки (иконка только в favicon)
  document.title = `${config.title} - CRM System`;
  
  // Обновляем только favicon
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${config.icon}</text></svg>`;
  }

  try {
    const response = await fetch(`modules/${moduleName}/${moduleName}.html`);
    const html = await response.text();
    contentArea.innerHTML = html;

    await this.loadModuleScript(moduleName);
  } catch (error) {
    console.error(`Ошибка загрузки модуля ${moduleName}:`, error);
    contentArea.innerHTML = `<h2>Ошибка загрузки</h2><p>Модуль "${moduleName}" временно недоступен</p>`;
  }
}

    async loadModuleScript(moduleName) {
        return new Promise((resolve, reject) => {
            // Удаляем предыдущий скрипт если есть
            const existingScript = document.querySelector(`script[src*="${moduleName}.js"]`);
            if (existingScript) {
                existingScript.remove();
            }

            const script = document.createElement('script');
            script.src = `modules/${moduleName}/${moduleName}.js`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    showLogin() {
        window.location.href = 'auth/login.html';
    }

    showMainInterface() {
        // Получаем данные пользователя из localStorage
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const loginUsername = userData.loginUsername || userData.username || 'Пользователь';
        const role = userData.role || 'buyer';

        // Иконка в зависимости от роли
        const roleIcons = {
            'admin': '👑',
            'manager': '⭐',
            'buyer': '😇'
        };

        const userIcon = roleIcons[role] || '😇';
        const roleText = {
            'admin': 'Администратор',
            'manager': 'Менеджер',
            'buyer': 'Байер'
        };

        document.getElementById('user-info').innerHTML = `
    <div class="user-profile">
      <span class="user-avatar">${userIcon}</span>
      <div class="user-details">
        <div class="user-name">${loginUsername}</div>
        <div class="user-role">${roleText[role] || role}</div>
      </div>
    </div>
  `;
    }

    logout() {
        api.removeToken();
        this.showLogin();
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new App();
});