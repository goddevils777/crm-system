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

    show(type, title, message, duration = 3000) { // Уменьшили с 4000 до 3000ms
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
    // Методы для быстрого вызова
    success(title, message, duration = 2500) { // 2.5 секунды для успеха
        return this.show('success', title, message, duration);
    }

    error(title, message, duration = 4000) { // 4 секунды для ошибок (чуть дольше)
        return this.show('error', title, message, duration);
    }

    warning(title, message, duration = 3500) { // 3.5 секунды для предупреждений
        return this.show('warning', title, message, duration);
    }

    info(title, message, duration = 3000) { // 3 секунды для информации
        return this.show('info', title, message, duration);
    }

    // Очистить все уведомления
    clear() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(notification => this.hide(notification));
    }
}


// Красивые модальные окна подтверждения в стиле Ant Design
class ConfirmModal {
    constructor() {
        this.modal = null;
        this.createModal();
    }
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'confirm-modal';
        this.modal.style.display = 'none'; // ДОБАВЬ ЭТУ СТРОКУ
        this.modal.innerHTML = `
    <div class="confirm-modal-content">
      <div class="confirm-modal-header">
        <div class="confirm-icon">⚠️</div>
        <h3 class="confirm-title">Подтверждение действия</h3>
      </div>
      <div class="confirm-modal-body">
        <p class="confirm-message">Вы уверены?</p>
      </div>
      <div class="confirm-modal-actions">
        <button class="btn btn-secondary confirm-cancel">Отмена</button>
        <button class="btn btn-primary confirm-ok">Подтвердить</button>
      </div>
    </div>
  `;
        document.body.appendChild(this.modal);
    }

    show(title, message, type = 'warning') {
        return new Promise((resolve) => {
            const titleEl = this.modal.querySelector('.confirm-title');
            const messageEl = this.modal.querySelector('.confirm-message');
            const iconEl = this.modal.querySelector('.confirm-icon');
            const okBtn = this.modal.querySelector('.confirm-ok');
            const cancelBtn = this.modal.querySelector('.confirm-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;

            const icons = {
                warning: '⚠️',
                danger: '🗑️',
                info: 'ℹ️',
                question: '❓'
            };
            iconEl.textContent = icons[type] || icons.warning;

            if (type === 'danger') {
                okBtn.className = 'btn btn-danger confirm-ok';
                okBtn.textContent = 'Удалить';
            } else {
                okBtn.className = 'btn btn-primary confirm-ok';
                okBtn.textContent = 'Подтвердить';
            }

            this.modal.style.display = 'flex';
            setTimeout(() => this.modal.classList.add('show'), 10);

            // Фокус на кнопку подтверждения для работы Enter
            setTimeout(() => okBtn.focus(), 100);

            const handleConfirm = () => {
                this.hide();
                resolve(true);
                cleanup();
            };

            const handleCancel = () => {
                this.hide();
                resolve(false);
                cleanup();
            };

            // ДОБАВЬ: Обработчик клавиатуры
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
            };

            const cleanup = () => {
                okBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                this.modal.removeEventListener('click', handleModalClick);
                document.removeEventListener('keydown', handleKeyDown); // ДОБАВЬ
            };

            const handleModalClick = (e) => {
                if (e.target === this.modal) handleCancel();
            };

            okBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            this.modal.addEventListener('click', handleModalClick);
            document.addEventListener('keydown', handleKeyDown); // ДОБАВЬ
        });
    }

    hide() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
    }
}

// Создаем глобальные экземпляры
window.notifications = new NotificationSystem();
window.confirmModal = new ConfirmModal();

// Быстрые функции
window.confirmDelete = (message = 'Это действие нельзя отменить') => {
    return confirmModal.show('Удаление', message, 'danger');
};

window.confirmAction = (message = 'Вы уверены?') => {
    return confirmModal.show('Подтверждение', message, 'question');
};