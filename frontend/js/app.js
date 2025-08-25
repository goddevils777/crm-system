// Основное приложение с компонентами
class App {
  constructor() {
    this.header = null;
    this.sidebar = null;
    this.currentModule = null;
    this.init();
  }

  async init() {
    await this.checkAuth();
    this.initComponents();
    this.setupNavigation();

    // Загружаем последний активный модуль
    const lastModule = localStorage.getItem('active_module') || 'cards';
    this.loadModule(lastModule);

    // ЗАМЕНИ: Более надежная защита от возврата на логин
    this.setupHistoryProtection();
  }

  setupHistoryProtection() {
    // Добавляем текущую страницу в историю несколько раз
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('popstate', (e) => {
      const token = localStorage.getItem('authToken');

      if (token) {
        // Если авторизован - не даем уйти с главной страницы
        window.history.pushState(null, '', window.location.href);
        console.log('Prevented navigation back while authenticated');
      } else {
        // Если не авторизован - перенаправляем на логин
        this.showLogin();
      }
    });

    console.log('History protection enabled');
  }

  async checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.showLogin();
      return;
    }

    try {
      // Здесь можно добавить проверку валидности токена
      this.showMainInterface();

      // ДОБАВЬ: Заменяем текущую запись в истории чтобы нельзя было вернуться на логин
      if (window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('/')) {
        window.history.replaceState(null, '', 'index.html');
      }

    } catch (error) {
      console.error('Ошибка авторизации:', error);
      this.showLogin();
    }
  }

  initComponents() {
    // Создаем компоненты
    this.header = new HeaderComponent();
    this.sidebar = new SidebarComponent();

    // Заменяем существующую шапку
    const existingHeader = document.querySelector('.header');
    if (existingHeader) {
      const headerParent = existingHeader.parentNode;
      existingHeader.remove();
      this.header.mount(headerParent);
    }

    // Заменяем существующий сайдбар
    const existingSidebar = document.querySelector('.sidebar');
    if (existingSidebar) {
      const sidebarParent = existingSidebar.parentNode;
      existingSidebar.remove();
      this.sidebar.mount(sidebarParent);
    }
  }

  setupNavigation() {
    // Настраиваем callback для смены модулей через сайдбар
    this.sidebar.setModuleChangeCallback((module) => {
      this.loadModule(module);
    });
  }

  async loadModule(moduleName) {

    // Проверяем URL для детальной страницы карты
    if (window.location.hash.startsWith('#card/')) {
      const cardId = window.location.hash.replace('#card/', '');
      localStorage.setItem('current_card_detail', cardId);
      moduleName = 'cards'; // Принудительно загружаем модуль карт
    }
    localStorage.setItem('active_module', moduleName);

    console.log('=== APP LOAD MODULE ===');
    console.log('Loading module:', moduleName);
    console.log('Current hash before:', window.location.hash);

    // НОВАЯ ЛОГИКА: Улучшенная система сохранения позиции
    const currentHash = window.location.hash;
    const isCardDetail = currentHash.startsWith('#card/');

    if (moduleName === 'cards') {
      // Для модуля карт - НЕ меняем URL если это детальная страница
      if (!isCardDetail) {
        // Только если мы НЕ на детальной странице - устанавливаем #cards
        window.history.replaceState({ module: moduleName }, '', '#cards');
      }
      // Если детальная страница - оставляем URL как есть (#card/123)
    } else {
      // Для других модулей - всегда очищаем состояние карт
      console.log('Clearing card state for non-cards module');
      localStorage.removeItem('current_card_detail');
      window.history.replaceState({ module: moduleName }, '', `#${moduleName}`);
    }

    console.log('Current hash after:', window.location.hash);

    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    // Обновляем favicon и title
    this.updatePageMeta(moduleName);

    try {
      // СНАЧАЛА загружаем модуль
      await window.moduleLoader.loadModule(moduleName);

      // ПОТОМ устанавливаем активный модуль в сайдбаре
      console.log('Module loaded successfully, setting active in sidebar');
      this.sidebar.setActiveModule(moduleName);

    } catch (error) {
      console.error(`Ошибка загрузки модуля ${moduleName}:`, error);
      contentArea.innerHTML = `
       <div class="module-error">
         <h2>Ошибка загрузки</h2>
         <p>Модуль временно недоступен</p>
         <button class="btn btn-primary" onclick="app.loadModule('${moduleName}')">Попробовать снова</button>
       </div>
     `;
      notifications.error('Ошибка загрузки', `Не удалось загрузить модуль`);
    }
  }

  updatePageMeta(moduleName) {
    const moduleConfig = {
      'cards': { icon: '💳', title: 'Карты' },
      'expenses': { icon: '💰', title: 'Расходы' },
      'teams': { icon: '👥', title: 'Команды' },
      'income': { icon: '📈', title: 'Доходы' },
      'analytics': { icon: '📊', title: 'Аналитика' }
    };

    const config = moduleConfig[moduleName] || { icon: '📊', title: 'CRM' };
    document.title = `${config.title} - CRM System`;

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${config.icon}</text></svg>`;
    }
  }

  showLogin() {
    window.location.href = 'auth/login.html';
  }

  showMainInterface() {
    // Информация о пользователе будет обновляться через компонент шапки
    console.log('Main interface initialized');
  }

  logout() {
    api.removeToken();
    localStorage.removeItem('userData');
    this.showLogin();
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
  window.app = new App();
});