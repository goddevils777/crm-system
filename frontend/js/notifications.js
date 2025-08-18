// Система уведомлений в стиле Ant Design
class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.createContainer();
    this.loadStyles();
  }

  createContainer() {
    // Создаем контейнер для уведомлений
    this.container = document.createElement('div');
    this.container.id = 'notifications-container';
    this.container.className = 'notifications-container';
    document.body.appendChild(this.container);
  }

  loadStyles() {
    const notificationsCss = document.createElement('link');
    notificationsCss.rel = 'stylesheet';
    notificationsCss.href = `css/notifications.css?v=${Date.now()}`;
    
    if (!document.querySelector('link[href*="notifications.css"]')) {
      document.head.appendChild(notificationsCss);
    }
  }

  show(type, title, message, duration = 4000) {
    const notification = this.createNotification(type, title, message, duration);
    this.container.appendChild(notification);

    // Анимация появления
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Автоматическое скрытие
    if (duration > 0) {
      setTimeout(() => {
        this.hide(notification);
      }, duration);
    }

    return notification;
  }

  createNotification(type, title, message, duration) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    notification.innerHTML = `
      <div class="notification-icon">
        ${icons[type] || icons.info}
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        ${message ? `<div class="notification-message">${message}</div>` : ''}
      </div>
      <button class="notification-close" onclick="notifications.hide(this.closest('.notification'))">
        ×
      </button>
      ${duration > 0 ? `<div class="notification-progress"></div>` : ''}
    `;

    // Прогресс бар
    if (duration > 0) {
      const progressBar = notification.querySelector('.notification-progress');
      progressBar.style.animationDuration = `${duration}ms`;
    }

    return notification;
  }

  hide(notification) {
    notification.classList.add('hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // Методы для быстрого вызова
  success(title, message, duration) {
    return this.show('success', title, message, duration);
  }

  error(title, message, duration) {
    return this.show('error', title, message, duration);
  }

  warning(title, message, duration) {
    return this.show('warning', title, message, duration);
  }

  info(title, message, duration) {
    return this.show('info', title, message, duration);
  }

  // Очистить все уведомления
  clear() {
    const notifications = this.container.querySelectorAll('.notification');
    notifications.forEach(notification => this.hide(notification));
  }
}

// Создаем глобальный экземпляр
window.notifications = new NotificationSystem();