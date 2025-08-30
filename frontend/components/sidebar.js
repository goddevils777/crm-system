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

// ЗАМЕНИТЬ метод setupEvents в frontend/components/sidebar.js:

setupEvents() {
  const menu = document.getElementById('main-menu');

  menu?.addEventListener('click', (e) => {
    e.preventDefault();
    const link = e.target.closest('.menu-item');
    if (link) {
      const module = link.dataset.module;
      
      console.log('=== SIDEBAR NAVIGATION ===');
      console.log('Clicked module:', module);
      console.log('Current hash:', window.location.hash);
      console.log('Is card detail page:', window.location.hash.startsWith('#card/'));

      // ПРИНУДИТЕЛЬНАЯ ОЧИСТКА состояния при переходе в любой модуль
      if (window.location.hash.startsWith('#card/')) {
        console.log('Clearing card detail state before navigation');
        localStorage.removeItem('current_card_detail');
        
        // Очищаем все модули из кеша
        if (window.moduleLoader) {
          window.moduleLoader.loadedModules.clear();
          console.log('Cleared module cache');
        }
      }

      // Устанавливаем новый хеш
      window.history.replaceState({ module: module }, '', `#${module}`);
      console.log('New hash set:', window.location.hash);

      // Устанавливаем активный модуль
      this.setActiveModule(module);

      // Вызываем колбэк для загрузки модуля
      if (this.onModuleChange) {
        console.log('Calling onModuleChange callback');
        this.onModuleChange(module);
      } else {
        console.error('onModuleChange callback not set');
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