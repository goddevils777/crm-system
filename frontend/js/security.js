// Защита от XSS атак
class SecurityUtils {
  // Экранирование HTML символов
  static escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Валидация данных перед отправкой
  static validateCardInput(data) {
    const errors = [];
    
    if (!data.name || data.name.length > 100) {
      errors.push('Название карты должно быть от 1 до 100 символов');
    }
    
    if (data.currency && !['USD', 'EUR', 'UAH'].includes(data.currency)) {
      errors.push('Недопустимая валюта');
    }
    
    return errors;
  }

  // Безопасное обновление DOM
  static safeSetTextContent(element, text) {
    if (element && typeof text === 'string') {
      element.textContent = this.escapeHtml(text);
    }
  }
}

window.SecurityUtils = SecurityUtils;