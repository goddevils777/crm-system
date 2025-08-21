class ConfirmModal {
    constructor() {
        this.currentResolve = null;
        this.createModal();
        this.setupEvents();
    }

    createModal() {
        const existing = document.getElementById('universal-confirm-modal');
        if (existing) existing.remove();

        const modalHTML = `
        <div id="universal-confirm-modal" class="confirm-modal-overlay">
            <div class="confirm-modal-content">
                <div class="confirm-modal-header">
                    <h3 id="confirm-title">Подтверждение</h3>
                </div>
                <div class="confirm-modal-body">
                    <p id="confirm-message">Вы уверены?</p>
                    <p id="confirm-warning" style="display: none;">Это действие нельзя отменить.</p>
                </div>
                <div class="confirm-modal-actions">
                    <button type="button" class="btn btn-secondary" id="confirm-cancel">Отмена</button>
                    <button type="button" class="btn btn-danger" id="confirm-ok">Подтвердить</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    setupEvents() {
        const modal = document.getElementById('universal-confirm-modal');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        cancelBtn.addEventListener('click', () => this.close(false));
        okBtn.addEventListener('click', () => this.close(true));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close(false);
        });
    }

    show(options = {}) {
        return new Promise((resolve) => {
            this.currentResolve = resolve;
            const modal = document.getElementById('universal-confirm-modal');
            const title = document.getElementById('confirm-title');
            const message = document.getElementById('confirm-message');
            const warning = document.getElementById('confirm-warning');
            const okBtn = document.getElementById('confirm-ok');

            title.textContent = options.title || 'Подтверждение';
            message.textContent = options.message || 'Вы уверены?';
            okBtn.textContent = options.confirmText || 'Подтвердить';
            okBtn.className = `btn ${options.dangerConfirm ? 'btn-danger' : 'btn-primary'}`;

            if (options.warning) {
                warning.textContent = options.warning;
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }
            modal.classList.add('show');
        });
    }

    close(result) {
        const modal = document.getElementById('universal-confirm-modal');
        modal.classList.remove('show');
        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
        }
    }
}

window.confirmModal = new ConfirmModal();
window.showConfirm = (options) => window.confirmModal.show(options);