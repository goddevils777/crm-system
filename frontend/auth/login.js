// Логика страницы входа - Ant Design стиль
class LoginPage {
  constructor() {
    this.checkExistingAuth();

    this.form = document.getElementById('login-form');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.loginBtn = document.getElementById('login-btn');
    this.btnText = this.loginBtn.querySelector('.btn-text');
    this.btnLoading = this.loginBtn.querySelector('.btn-loading');
    this.errorAlert = document.getElementById('error-alert');
    this.errorMessage = document.getElementById('error-message');

    this.init();
  }

  checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      console.log('User already authenticated, redirecting...');
      window.location.href = '../index.html';
      return;
    }
  }

  init() {
    this.setupEventListeners();
    this.checkAutoLogin();
  }

  setupValidation() {
    // Валидация полей формы
    [this.usernameInput, this.passwordInput].forEach(input => {
      input.addEventListener('input', () => this.removeFieldError(input));
    });
  }

  setupEventListeners() {
    // Обработка формы
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // УБЕРИ ЭТИ 2 СТРОКИ ↓↓↓
    // this.usernameInput.addEventListener('input', () => this.clearError());
    // this.passwordInput.addEventListener('input', () => this.clearError());

    // Enter для отправки формы
    [this.usernameInput, this.passwordInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit(e);
        }
      });
    });
  }



  validateField(field, message) {
    if (!field.value.trim()) {
      this.addFieldError(field, message);
      return false;
    } else {
      this.removeFieldError(field);
      return true;
    }
  }

  addFieldError(field, message) {
    field.style.borderColor = 'var(--error-color)';
    field.style.boxShadow = '0 0 0 2px rgba(245, 34, 45, 0.2)';

    // Добавляем текст ошибки если его нет
    let errorText = field.parentNode.querySelector('.field-error');
    if (!errorText) {
      errorText = document.createElement('div');
      errorText.className = 'field-error';
      errorText.style.cssText = `
      color: var(--error-color);
      font-size: 12px;
      margin-top: 4px;
      line-height: 1.5;
    `;
      field.parentNode.appendChild(errorText);
    }
    errorText.textContent = message;

    // НЕ показываем главный alert для валидации полей
  }

  removeFieldError(field) {
    field.style.borderColor = '';
    field.style.boxShadow = '';

    const errorText = field.parentNode.querySelector('.field-error');
    if (errorText) {
      errorText.remove();
    }
  }

  checkAutoLogin() {
    // Проверяем сохраненные данные
    const savedUsername = localStorage.getItem('rememberUsername');
    if (savedUsername) {
      this.usernameInput.value = savedUsername;
      document.querySelector('.checkbox').checked = true;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    // Валидация
    const isUsernameValid = this.validateField(this.usernameInput, 'Введите логин или email');
    const isPasswordValid = this.validateField(this.passwordInput, 'Введите пароль');

    if (!isUsernameValid || !isPasswordValid) {
      return;
    }

    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;
    const remember = document.querySelector('.checkbox').checked;

    try {
      this.setLoading(true);
      this.clearError();

      const response = await api.login(username, password);

      // Сохраняем токен
      api.setToken(response.token);

      // Сохраняем данные пользователя включая логин
      const userData = {
        ...response.user,
        loginUsername: username // Сохраняем введенный логин
      };
      localStorage.setItem('userData', JSON.stringify(userData));

      // Сохраняем логин если нужно
      if (remember) {
        localStorage.setItem('rememberUsername', username);
      } else {
        localStorage.removeItem('rememberUsername');
      }

      // Показываем успех
      this.showSuccess('Вход выполнен успешно! Перенаправление...');

      // Перенаправляем через секунду
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1000);

    } catch (error) {
      console.error('Ошибка входа:', error);

      // Показываем ошибку только если это реально ошибка авторизации
      if (error.message && !error.message.includes('successfully')) {
        this.showError(error.message || 'Ошибка соединения с сервером');
      }
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    this.loginBtn.disabled = loading;

    if (loading) {
      this.btnLoading.style.display = 'inline';
      this.btnText.textContent = 'Выполняется вход...';
      this.loginBtn.style.opacity = '0.7';
    } else {
      this.btnLoading.style.display = 'none';
      this.btnText.textContent = 'Войти в систему';
      this.loginBtn.style.opacity = '1';
    }
  }

  showError(message) {
    console.log('Показываем ошибку:', message); // ← ДОБАВЬ ЭТУ СТРОКУ
    this.errorMessage.textContent = message;
    this.errorAlert.style.display = 'flex';

    // Автоскрытие через 5 секунд
    setTimeout(() => this.clearError(), 5000);
  }

  showSuccess(message) {
    // Заменяем alert на успешное сообщение
    this.errorAlert.className = 'alert alert-success';
    this.errorAlert.style.cssText = `
      display: flex;
      background: #f6ffed;
      border: 1px solid #b7eb8f;
      color: var(--success-color);
    `;
    this.errorAlert.querySelector('.alert-icon').textContent = '✅';
    this.errorMessage.textContent = message;
  }

  clearError() {
    this.errorAlert.style.display = 'none';
    this.errorAlert.className = 'alert alert-error';
    this.errorAlert.style.cssText = '';

    // Очищаем ошибки полей
    [this.usernameInput, this.passwordInput].forEach(field => {
      this.removeFieldError(field);
    });
  }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  new LoginPage();
});