// Компонент сайдбара
class SidebarComponent {
  constructor() {
    this.activeModule = localStorage.getItem('active_module') || 'cards';
    this.onModuleChange = null; // Callback для смены модуля
  }

  render() {
    const menuItems = [
      { id: 'cards', title: 'Карты', icon: '💳' },
      { id: 'expenses', title: 'Расходы', icon: '💰' },
      { id: 'teams', title: 'Команды', icon: '👥' },
      { id: 'clients', title: 'Клиенты', icon: '📌' }, // ДОБАВИТЬ ЭТУ СТРОКУ
      { id: 'income', title: 'Доходы', icon: '📈' },
      { id: 'analytics', title: 'Аналитика', icon: '📊' }
    ];

    const menuHtml = menuItems.map(item => `
     <li>
       <a href="#" data-module="${item.id}" class="menu-item ${item.id === this.activeModule ? 'active' : ''}">
         <span class="menu-icon">${item.icon}</span>
         <span class="menu-text">${item.title}</span>
       </a>
     </li>
   `).join('');

    return `
     <aside class="sidebar">
       <ul class="menu" id="main-menu">
         ${menuHtml}
       </ul>
     </aside>
   `;
  }

  mount(container) {
    // Проверяем актуальный модуль перед рендером
    this.activeModule = localStorage.getItem('active_module') || 'cards';

    container.innerHTML = this.render();
    this.setupEvents();

    // Принудительно устанавливаем активный класс после рендера
    setTimeout(() => {
      this.setActiveModule(this.activeModule);
    }, 10);
  }

  setupEvents() {
    const menu = document.getElementById('main-menu');

    menu?.addEventListener('click', (e) => {
      e.preventDefault();
      const link = e.target.closest('.menu-item');
      if (link) {
        const module = link.dataset.module;

        // УБРАТЬ ВСЮ СЕКЦИЮ АВТОЗАКРЫТИЯ:
        // if (window.innerWidth <= 768) { ... }

        // Принудительная очистка состояния карты при переходе в команды
        if (module === 'teams') {
          console.log('Forcing clear card state when clicking teams');
          localStorage.removeItem('current_card_detail');
          window.history.replaceState({ module: 'teams' }, '', '#teams');
          if (window.moduleLoader && window.moduleLoader.loadedModules.has('teams')) {
            window.moduleLoader.loadedModules.delete('teams');
          }
        }

        if (module === 'cards' && window.location.hash.startsWith('#card/')) {
          console.log('Forcing return to cards list from detail page');
          localStorage.removeItem('current_card_detail');
          window.history.replaceState({ module: 'cards' }, '', '#cards');
          if (window.moduleLoader) {
            window.moduleLoader.loadedModules.delete('cards');
          }
        }

        this.setActiveModule(module);

        if (this.onModuleChange) {
          this.onModuleChange(module);
        }
      }
    });
  }

  setActiveModule(moduleName) {
    console.log('Setting active module:', moduleName);
    this.activeModule = moduleName;
    localStorage.setItem('active_module', moduleName);

    // ИСПРАВЛЕННЫЙ СЕЛЕКТОР - ищем только ссылки меню
    document.querySelectorAll('.menu-item').forEach(link => {
      link.classList.remove('active');
    });

    // ИСПРАВЛЕННЫЙ СЕЛЕКТОР - более точный поиск
    const activeLink = document.querySelector(`.menu-item[data-module="${moduleName}"]`);
    console.log('Found active link:', activeLink);
    if (activeLink) {
      activeLink.classList.add('active');
      console.log('Added active class to:', moduleName);
    } else {
      console.error('Active link not found for module:', moduleName);
    }
  }

  setModuleChangeCallback(callback) {
    this.onModuleChange = callback;
  }
}

window.SidebarComponent = SidebarComponent;