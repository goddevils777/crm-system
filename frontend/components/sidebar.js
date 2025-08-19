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
    container.innerHTML = this.render();
    this.setupEvents();
  }

  setupEvents() {
    const menu = document.getElementById('main-menu');
    
    menu?.addEventListener('click', (e) => {
      e.preventDefault();
      const link = e.target.closest('.menu-item');
      if (link) {
        const module = link.dataset.module;
        this.setActiveModule(module);
        
        // Вызываем callback для смены модуля
        if (this.onModuleChange) {
          this.onModuleChange(module);
        }
      }
    });
  }

  setActiveModule(moduleName) {
    this.activeModule = moduleName;
    localStorage.setItem('active_module', moduleName);
    
    // Обновляем активный пункт
    document.querySelectorAll('.menu-item').forEach(link => {
      link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[data-module="${moduleName}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  setModuleChangeCallback(callback) {
    this.onModuleChange = callback;
  }
}

window.SidebarComponent = SidebarComponent;