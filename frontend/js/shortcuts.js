// Глобальные горячие клавиши для CRM системы
class KeyboardShortcuts {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        console.log('Keyboard shortcuts initialized');
    }

    handleKeydown(e) {
        // Проверяем что не находимся в поле ввода
        const isInputActive = this.isInputFieldActive(e.target);
        
        if (isInputActive) return;
        
        // Проверяем модальные окна - если открыто, игнорируем шорткаты
        const isModalOpen = document.querySelector('.modal.show, .modal-overlay.show');
        if (isModalOpen) return;

        const activeModule = localStorage.getItem('active_module');
        
        switch (e.code) {
            case 'Space':
                this.handleSpaceKey(e, activeModule);
                break;
            case 'KeyN':
                if (e.ctrlKey || e.metaKey) {
                    this.handleNewItem(e, activeModule);
                }
                break;
            case 'Escape':
                this.handleEscapeKey(e);
                break;
        }
    }

    isInputFieldActive(target) {
        const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTags.includes(target.tagName) || 
               target.isContentEditable || 
               target.closest('[contenteditable="true"]');
    }

    handleSpaceKey(e, activeModule) {
        e.preventDefault();
        
        switch (activeModule) {
            case 'cards':
                if (window.cardsModule && typeof window.cardsModule.showAddModal === 'function') {
                    window.cardsModule.showAddModal();
                    this.showShortcutFeedback('Добавление карты');
                }
                break;
            case 'teams':
                if (window.teamsModule && typeof window.teamsModule.showAddModal === 'function') {
                    window.teamsModule.showAddModal();
                    this.showShortcutFeedback('Добавление команды');
                }
                break;
            case 'team-detail':
                if (window.teamDetailModule && typeof window.teamDetailModule.showAddBuyerModal === 'function') {
                    window.teamDetailModule.showAddBuyerModal();
                    this.showShortcutFeedback('Добавление баера');
                }
                break;
            case 'buyer-detail':
                if (window.buyerDetailModule && typeof window.buyerDetailModule.openManageCardsModal === 'function') {
                    window.buyerDetailModule.openManageCardsModal();
                    this.showShortcutFeedback('Управление картами');
                }
                break;
            default:
                console.log('Пробел нажат, но нет доступных действий для модуля:', activeModule);
        }
    }

    handleNewItem(e, activeModule) {
        e.preventDefault();
        
        // Ctrl+N / Cmd+N - создать новый элемент
        switch (activeModule) {
            case 'cards':
                if (window.cardsModule && typeof window.cardsModule.showAddModal === 'function') {
                    window.cardsModule.showAddModal();
                    this.showShortcutFeedback('Новая карта (Ctrl+N)');
                }
                break;
            case 'teams':
                if (window.teamsModule && typeof window.teamsModule.showAddModal === 'function') {
                    window.teamsModule.showAddModal();
                    this.showShortcutFeedback('Новая команда (Ctrl+N)');
                }
                break;
            case 'team-detail':
                if (window.teamDetailModule && typeof window.teamDetailModule.showAddBuyerModal === 'function') {
                    window.teamDetailModule.showAddBuyerModal();
                    this.showShortcutFeedback('Новый баер (Ctrl+N)');
                }
                break;
            case 'buyer-detail':
                if (window.buyerDetailModule && typeof window.buyerDetailModule.openManageCardsModal === 'function') {
                    window.buyerDetailModule.openManageCardsModal();
                    this.showShortcutFeedback('Управление картами (Ctrl+N)');
                }
                break;
        }
    }

    handleEscapeKey(e) {
        // Закрытие модальных окон по Escape
        const openModal = document.querySelector('.modal.show, .modal-overlay.show');
        if (openModal) {
            openModal.classList.remove('show');
            this.showShortcutFeedback('Модальное окно закрыто');
        }
    }

    showShortcutFeedback(message) {
        // Показываем небольшое уведомление о выполненном действии
        const feedback = document.createElement('div');
        feedback.className = 'shortcut-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10001;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
            pointer-events: none;
        `;
        
        document.body.appendChild(feedback);
        
        // Показываем с анимацией
        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateY(0)';
        }, 10);
        
        // Скрываем через 2 секунды
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.remove();
                }
            }, 300);
        }, 2000);
    }
}

// Инициализируем горячие клавиши при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardShortcuts = new KeyboardShortcuts();
});

// Экспортируем класс для глобального использования
window.KeyboardShortcuts = KeyboardShortcuts;