class BillViewer {
    constructor() {
        this.init();
    }
    
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
            this.showError('Неверная ссылка на счет');
            return;
        }
        
        this.loadBill(token);
    }
    
    async loadBill(token) {
        try {
            this.showLoading();
            
            const response = await fetch(`/api/clients/bills/public/${token}`);
            
            if (!response.ok) {
                throw new Error('Счет не найден');
            }
            
            const bill = await response.json();
            this.renderBill(bill);
            
        } catch (error) {
            console.error('Error loading bill:', error);
            this.showError('Счет не найден или недоступен');
        }
    }
    renderBill(bill) {
    console.log('Рендерим счет:', bill);
    console.log('Структура данных:', JSON.stringify(bill, null, 2));
    
    // Убираем loading перед рендером
    const contentElement = document.querySelector('.bill-content');
    if (contentElement && contentElement.innerHTML.includes('loading')) {
        console.log('Restoring original content structure');
        contentElement.innerHTML = `
            <div class="bill-amount" id="bill-amount">
                <span class="currency">$</span>
                <span class="amount">0.00</span>
            </div>
            
            <div class="bill-details">
                <div class="detail-item">
                    <span class="label">Период:</span>
                    <span class="value" id="bill-period">-</span>
                </div>
                <div class="detail-item">
                    <span class="label">Дата счета:</span>
                    <span class="value" id="bill-date">-</span>
                </div>
                <div class="detail-item">
                    <span class="label">Клиент:</span>
                    <span class="value" id="bill-client">-</span>
                </div>
                <div class="detail-item">
                    <span class="label">Статус:</span>
                    <span class="value status" id="bill-status">Ожидает оплаты</span>
                </div>
            </div>
            
            <div class="bill-payment" id="bill-payment" style="display: none;">
                <button class="payment-btn" id="payment-btn">
                    ✓ Отметить как оплаченный
                </button>
            </div>
        `;
    }
    
    // Теперь ищем элементы и обновляем данные
    const amountElement = document.querySelector('.bill-amount .amount');
    if (amountElement) {
        amountElement.textContent = parseFloat(bill.amount || 0).toFixed(2);
        console.log('Amount set to:', amountElement.textContent);
    }
    
    const periodElement = document.getElementById('bill-period');
    if (periodElement) {
        const periodText = `${this.formatDate(bill.period_from)} - ${this.formatDate(bill.period_to)}`;
        periodElement.textContent = periodText;
        console.log('Period set to:', periodText);
    }
    
    const dateElement = document.getElementById('bill-date');
    if (dateElement) {
        const dateText = this.formatDate(bill.created_at);
        dateElement.textContent = dateText;
        console.log('Date set to:', dateText);
    }
    
    const clientElement = document.getElementById('bill-client');
    if (clientElement) {
        clientElement.textContent = bill.client_name || 'Неизвестно';
        console.log('Client set to:', clientElement.textContent);
    }
    
    const statusElement = document.getElementById('bill-status');
    if (statusElement) {
        const statusText = bill.status === 'paid' ? 'Оплачен' : 'Ожидает оплаты';
        const statusClass = bill.status === 'paid' ? 'paid' : 'pending';
        
        statusElement.textContent = statusText;
        statusElement.className = `value status ${statusClass}`;
        console.log('Status set to:', statusText);
    }
    
    // Обрабатываем кнопку оплаты
    const paymentSection = document.getElementById('bill-payment');
    const paymentBtn = document.getElementById('payment-btn');
    
    console.log('Payment section found:', !!paymentSection);
    console.log('Payment button found:', !!paymentBtn);
    console.log('Bill status:', bill.status);
    
    if (paymentSection && paymentBtn) {
        if (bill.status === 'pending') {
            // Показываем кнопку только для неоплаченных счетов
            paymentSection.style.display = 'block';
            paymentBtn.onclick = () => this.markAsPaid(bill.public_token);
            console.log('Payment button activated');
        } else {
            paymentSection.style.display = 'none';
            console.log('Payment button hidden - bill already paid');
        }
    } else {
        console.error('Payment elements not found in DOM');
    }
    
    // Обновляем заголовок страницы
    document.title = `Счет ${bill.client_name || 'Клиент'} - ${parseFloat(bill.amount || 0).toFixed(2)} USD`;
    
    console.log('Рендеринг завершен');
}

async markAsPaid(token) {
    const paymentBtn = document.getElementById('payment-btn');
    const paymentSection = document.getElementById('bill-payment');
    
    try {
        paymentBtn.textContent = 'Обрабатываем...';
        paymentBtn.classList.add('loading');
        paymentBtn.disabled = true;
        
        const response = await fetch(`/api/clients/bills/public/${token}/pay`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Не удалось отметить как оплаченный');
        }
        
        // Показываем успешное сообщение
        paymentSection.innerHTML = `
            <div class="payment-success">
                ✓ Счет отмечен как оплаченный!
            </div>
        `;
        
        // Обновляем статус на странице
        const statusElement = document.getElementById('bill-status');
        if (statusElement) {
            statusElement.textContent = 'Оплачен';
            statusElement.className = 'value status paid';
        }
        
    } catch (error) {
        console.error('Ошибка оплаты:', error);
        paymentBtn.textContent = 'Ошибка. Попробуйте снова';
        paymentBtn.classList.remove('loading');
        paymentBtn.disabled = false;
        
        setTimeout(() => {
            paymentBtn.textContent = '✓ Отметить как оплаченный';
        }, 3000);
    }
}
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU');
    }

    
showLoading() {
    const contentElement = document.querySelector('.bill-content');
    if (contentElement) {
        contentElement.innerHTML = '<div class="loading">Загрузка счета...</div>';
    }
}

showError(message) {
    const contentElement = document.querySelector('.bill-content');
    if (contentElement) {
        contentElement.innerHTML = `<div class="error">${message}</div>`;
    }
}


}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new BillViewer();
});